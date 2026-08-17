import { createSupabaseBrowserClient } from "../lib/supabase/client";
import { isSupabaseConfigured } from "../lib/supabase/config";
import { normalizeChatMessages, type ReadCursor, type StoredChatMessage } from "../services/chat-message-normalizer";
import type { ChatRoom, TransactionChatMessage } from "../types/transactions";
import { CHAT_PAGE_SIZE } from "./supabase-chat-repository";

// Demo-mode chat backend. Demo login never creates a real Supabase Auth
// session (it's a signed cookie only), so every request here reaches
// Postgres as `anon` against `demo_chat_rooms` / `demo_chat_messages` /
// `demo_chat_reads` — tables with zero FKs to `profiles`, `transactions` or
// `transaction_rooms`. That physical separation is what keeps demo traffic
// from ever touching or resembling real participant data; there is no
// auth.uid() involved anywhere in this file to confuse with a real user.
//
// This gives every demo session (any browser, any tab) a shared, realtime
// view of the same fixed demo transactions — see DEMO_SEED_TRANSACTIONS in
// repositories/transaction-repository.ts for the matching seed data.
//
// Every method degrades quietly (empty result / no-op) when Supabase isn't
// configured, instead of throwing — demo mode's other 99% (local
// transactions/chat) must keep working with zero Supabase dependency, in
// any environment (including one with no Supabase env vars at all).

type MessageRow = StoredChatMessage;
type ReadRow = { reader_id: string; last_read_at: string };
type RoomRow = {
  id: string;
  transaction_id: string;
  created_at: string;
  updated_at: string;
  demo_chat_messages: MessageRow[];
  demo_chat_reads: ReadRow[];
};

/**
 * Re-signs any attachment that carries a storagePath (uploaded through
 * DemoAttachmentProvider / app/api/demo-attachments) so the signed URL is
 * fresh on every load instead of a stale one going 403 after ~1h — same
 * reason supabase-chat-repository.ts re-signs Real attachments on every
 * room load, just routed through the server since Demo has no authenticated
 * session to call storage.createSignedUrl() from the browser. A no-op
 * (zero network calls) when no message carries a storagePath, which is the
 * common text-only case.
 */
async function resignAttachmentUrls(rooms: ChatRoom[]): Promise<ChatRoom[]> {
  const paths = Array.from(
    new Set(
      rooms.flatMap((room) =>
        room.messages.flatMap((message) =>
          (message.attachments ?? []).map((item) => item.storagePath).filter((path): path is string => Boolean(path)),
        ),
      ),
    ),
  );
  if (paths.length === 0) return rooms;
  try {
    const response = await fetch("/api/demo-attachments/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paths }),
    });
    if (!response.ok) return rooms;
    const { urls } = (await response.json()) as { urls: Record<string, string> };
    return rooms.map((room) => ({
      ...room,
      messages: room.messages.map((message) => ({
        ...message,
        attachments: message.attachments?.map((item) =>
          item.storagePath && urls[item.storagePath] ? { ...item, url: urls[item.storagePath] } : item,
        ),
      })),
    }));
  } catch {
    return rooms;
  }
}

export class DemoChatRepository {
  async getAll(myId: string): Promise<ChatRoom[]> {
    if (!isSupabaseConfigured) return [];
    const client = createSupabaseBrowserClient();
    const { data, error } = await client
      .from("demo_chat_rooms")
      .select(
        "id,transaction_id,created_at,updated_at,demo_chat_messages(id,room_id,sender_id,sender_role,text,attachments,created_at),demo_chat_reads(reader_id,last_read_at)",
      )
      // Newest-first plus a per-room limit makes this a window rather than the
      // whole history; each page is flipped back to oldest-first below.
      .order("created_at", { referencedTable: "demo_chat_messages", ascending: false })
      .limit(CHAT_PAGE_SIZE, { referencedTable: "demo_chat_messages" });
    if (error) throw error;
    const cursors = new Map<string, string>();
    const rooms = ((data ?? []) as unknown as RoomRow[]).map((room) => {
      const reads: ReadCursor[] = room.demo_chat_reads ?? [];
      cursors.set(room.id, reads.find((read) => read.reader_id === myId)?.last_read_at ?? "");
      const page = [...(room.demo_chat_messages ?? [])].reverse();
      return {
        id: room.id,
        transactionId: room.transaction_id,
        createdAt: room.created_at,
        updatedAt: room.updated_at,
        messages: normalizeChatMessages(page, reads),
        unreadCount: 0,
        hasMoreMessages: page.length === CHAT_PAGE_SIZE,
      } satisfies ChatRoom;
    });
    await this.applyUnreadCounts(rooms, cursors, myId);
    return resignAttachmentUrls(rooms);
  }

  /**
   * Exact unread counts, independent of the loaded window — a room with 200
   * unread must not report 50. Selects only the three columns needed to decide
   * "not mine, and after my cursor", so no message text or attachment JSON is
   * transferred.
   */
  private async applyUnreadCounts(rooms: ChatRoom[], cursors: Map<string, string>, myId: string): Promise<void> {
    if (rooms.length === 0) return;
    const { data, error } = await createSupabaseBrowserClient()
      .from("demo_chat_messages")
      .select("room_id,sender_id,created_at");
    if (error) return; // a failed count must never blank out the rooms themselves
    const counts = new Map<string, number>();
    for (const row of (data ?? []) as { room_id: string; sender_id: string | null; created_at: string }[]) {
      if (row.sender_id === myId) continue;
      if (row.created_at <= (cursors.get(row.room_id) ?? "")) continue;
      counts.set(row.room_id, (counts.get(row.room_id) ?? 0) + 1);
    }
    for (const room of rooms) room.unreadCount = counts.get(room.id) ?? 0;
  }

  /** One room's next page of history, oldest-first, ending just before `before`. */
  async loadOlder(roomId: string, before: string): Promise<{ messages: TransactionChatMessage[]; hasMore: boolean }> {
    if (!isSupabaseConfigured) return { messages: [], hasMore: false };
    const client = createSupabaseBrowserClient();
    const [{ data, error }, { data: readData }] = await Promise.all([
      client
        .from("demo_chat_messages")
        .select("id,room_id,sender_id,sender_role,text,attachments,created_at")
        .eq("room_id", roomId)
        .lt("created_at", before)
        .order("created_at", { ascending: false })
        .limit(CHAT_PAGE_SIZE),
      client.from("demo_chat_reads").select("reader_id,last_read_at").eq("room_id", roomId),
    ]);
    if (error) throw error;
    const page = [...((data ?? []) as unknown as MessageRow[])].reverse();
    const messages = normalizeChatMessages(page, (readData ?? []) as ReadCursor[]);
    const [signed] = await resignAttachmentUrls([
      { id: roomId, transactionId: "", createdAt: "", updatedAt: "", messages, unreadCount: 0 },
    ]);
    return { messages: signed.messages, hasMore: page.length === CHAT_PAGE_SIZE };
  }

  /** Idempotent — upserts so re-creating an already-seeded demo room (e.g. on a fresh browser) never throws. */
  async ensureRoom(room: Pick<ChatRoom, "id" | "transactionId" | "createdAt">) {
    if (!isSupabaseConfigured) return;
    const { error } = await createSupabaseBrowserClient()
      .from("demo_chat_rooms")
      .upsert(
        { id: room.id, transaction_id: room.transactionId, created_at: room.createdAt },
        { onConflict: "id", ignoreDuplicates: true },
      );
    if (error) throw error;
  }

  async addMessage(roomId: string, message: TransactionChatMessage) {
    const text = message.text.trim();
    if (!text && !message.attachments?.length) throw new Error("메시지 또는 첨부파일을 입력해 주세요.");
    if (text.length > 4000) throw new Error("메시지는 4,000자 이하로 입력해 주세요.");
    if (!isSupabaseConfigured) throw new Error("메시지를 보내지 못했습니다. 잠시 후 다시 시도해 주세요.");
    const { error } = await createSupabaseBrowserClient()
      .from("demo_chat_messages")
      .upsert(
        {
          room_id: roomId,
          sender_id: message.senderId,
          sender_role: message.senderRole,
          text,
          attachments: message.attachments ?? [],
          client_message_id: message.id,
        },
        { onConflict: "room_id,client_message_id", ignoreDuplicates: true },
      );
    if (error) throw error;
  }

  async markRead(roomId: string, readerId: string) {
    if (!isSupabaseConfigured) return;
    const { error } = await createSupabaseBrowserClient()
      .from("demo_chat_reads")
      .upsert(
        { room_id: roomId, reader_id: readerId, last_read_at: new Date().toISOString() },
        { onConflict: "room_id,reader_id" },
      );
    if (error) throw error;
  }

  subscribe(listener: () => void) {
    if (!isSupabaseConfigured) return () => {};
    const client = createSupabaseBrowserClient();
    const channel = client
      .channel("car-master-demo-chat")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "demo_chat_messages" }, listener)
      .on("postgres_changes", { event: "*", schema: "public", table: "demo_chat_reads" }, listener)
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }
}

export const demoChatRepository = new DemoChatRepository();
