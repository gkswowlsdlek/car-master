import { createSupabaseBrowserClient } from "../lib/supabase/client";
import { normalizeChatMessages, type ReadCursor, type StoredChatMessage } from "../services/chat-message-normalizer";
import type { ChatAttachment, ChatRoom, TransactionChatMessage } from "../types/transactions";

/** How many messages a room loads up front, and per "이전 메시지 보기" click. */
export const CHAT_PAGE_SIZE = 50;

type MessageRow = StoredChatMessage;
type ReadRow = { user_id: string; last_read_at: string };
type RoomRow = {
  id: string;
  transaction_id: string;
  created_at: string;
  updated_at: string;
  chat_messages: MessageRow[];
  room_reads: ReadRow[];
};

const MESSAGE_COLUMNS = "id,room_id,sender_id,sender_role,text,attachments,created_at";

/**
 * Signs every attachment in one pass, de-duplicated by storage path.
 * Previously each attachment was signed individually in a Promise.all fan-out,
 * so the same file appearing twice cost two round trips and a busy room cost
 * one per attachment. Paths are unique-d first and signed with a single
 * createSignedUrls() batch call.
 */
async function signAttachments(rooms: ChatRoom[]): Promise<void> {
  const attachments = rooms
    .flatMap((room) => room.messages.flatMap((message) => message.attachments ?? []))
    .filter((item): item is ChatAttachment & { storagePath: string } => Boolean(item.storagePath));
  if (attachments.length === 0) return;

  const paths = [...new Set(attachments.map((item) => item.storagePath))];
  const { data, error } = await createSupabaseBrowserClient()
    .storage.from("transaction-attachments")
    .createSignedUrls(paths, 3600);

  const urls = new Map<string, string>();
  if (!error) {
    for (const entry of data ?? []) {
      if (entry.path && entry.signedUrl) urls.set(entry.path, entry.signedUrl);
    }
  }
  for (const attachment of attachments) attachment.url = urls.get(attachment.storagePath) ?? "";
}

export class SupabaseChatRepository {
  /**
   * Loads every room with only its most recent page of messages. Unread counts
   * are NOT derived from that page — a room with 200 unread would otherwise
   * report 50 — so they come from a second query that selects three light
   * columns (no text, no attachments JSON) and is counted per room here.
   */
  async getAll(): Promise<ChatRoom[]> {
    const client = createSupabaseBrowserClient();
    const [{ data, error }, { data: userData }] = await Promise.all([
      client
        .from("transaction_rooms")
        .select(`id,transaction_id,created_at,updated_at,chat_messages(${MESSAGE_COLUMNS}),room_reads(user_id,last_read_at)`)
        // Newest-first + a per-room limit is what makes this a window rather
        // than the whole history; the page is flipped back to oldest-first below.
        .order("created_at", { referencedTable: "chat_messages", ascending: false })
        .limit(CHAT_PAGE_SIZE, { referencedTable: "chat_messages" }),
      client.auth.getUser(),
    ]);
    if (error) throw error;
    const myId = userData?.user?.id ?? "";

    const rows = (data ?? []) as unknown as RoomRow[];
    const cursors = new Map<string, string>();
    const rooms = rows.map((room) => {
      const reads: ReadCursor[] = (room.room_reads ?? []).map((read) => ({
        reader_id: read.user_id,
        last_read_at: read.last_read_at,
      }));
      cursors.set(room.id, reads.find((read) => read.reader_id === myId)?.last_read_at ?? "");
      const page = [...(room.chat_messages ?? [])].reverse();
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

    await Promise.all([this.applyUnreadCounts(rooms, cursors, myId), signAttachments(rooms)]);
    return rooms;
  }

  /**
   * Exact unread counts, independent of the loaded window. Selects only the
   * three columns needed to decide "not mine, and after my cursor", so it
   * never transfers message text or attachment JSON.
   */
  private async applyUnreadCounts(rooms: ChatRoom[], cursors: Map<string, string>, myId: string): Promise<void> {
    if (rooms.length === 0) return;
    const { data, error } = await createSupabaseBrowserClient()
      .from("chat_messages")
      .select("room_id,sender_id,created_at");
    if (error) return; // a failed count must not blank out the rooms themselves
    const counts = new Map<string, number>();
    for (const row of (data ?? []) as { room_id: string; sender_id: string | null; created_at: string }[]) {
      if (row.sender_id === myId) continue;
      if (row.created_at <= (cursors.get(row.room_id) ?? "")) continue;
      counts.set(row.room_id, (counts.get(row.room_id) ?? 0) + 1);
    }
    for (const room of rooms) room.unreadCount = counts.get(room.id) ?? 0;
  }

  /**
   * One room's newest page plus its exact unread count. This is what a
   * realtime INSERT triggers, instead of rebuilding every room: a message
   * arriving in one conversation has no bearing on the other 499.
   */
  async getRoom(roomId: string): Promise<ChatRoom | null> {
    const client = createSupabaseBrowserClient();
    const [{ data, error }, { data: userData }] = await Promise.all([
      client
        .from("transaction_rooms")
        .select(`id,transaction_id,created_at,updated_at,chat_messages(${MESSAGE_COLUMNS}),room_reads(user_id,last_read_at)`)
        .eq("id", roomId)
        .order("created_at", { referencedTable: "chat_messages", ascending: false })
        .limit(CHAT_PAGE_SIZE, { referencedTable: "chat_messages" })
        .maybeSingle(),
      client.auth.getUser(),
    ]);
    if (error || !data) return null;
    const myId = userData?.user?.id ?? "";
    const row = data as unknown as RoomRow;
    const reads: ReadCursor[] = (row.room_reads ?? []).map((read) => ({
      reader_id: read.user_id,
      last_read_at: read.last_read_at,
    }));
    const page = [...(row.chat_messages ?? [])].reverse();
    const room: ChatRoom = {
      id: row.id,
      transactionId: row.transaction_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      messages: normalizeChatMessages(page, reads),
      unreadCount: 0,
      hasMoreMessages: page.length === CHAT_PAGE_SIZE,
    };
    const cursors = new Map([[row.id, reads.find((read) => read.reader_id === myId)?.last_read_at ?? ""]]);
    await Promise.all([this.applyUnreadCounts([room], cursors, myId), signAttachments([room])]);
    return room;
  }

  /** One room's next page of history, oldest-first, ending just before `before`. */
  async loadOlder(roomId: string, before: string): Promise<{ messages: TransactionChatMessage[]; hasMore: boolean }> {
    const client = createSupabaseBrowserClient();
    const [{ data, error }, { data: readData }] = await Promise.all([
      client
        .from("chat_messages")
        .select(MESSAGE_COLUMNS)
        .eq("room_id", roomId)
        .lt("created_at", before)
        .order("created_at", { ascending: false })
        .limit(CHAT_PAGE_SIZE),
      client.from("room_reads").select("user_id,last_read_at").eq("room_id", roomId),
    ]);
    if (error) throw error;
    const page = [...((data ?? []) as unknown as MessageRow[])].reverse();
    const reads: ReadCursor[] = ((readData ?? []) as ReadRow[]).map((read) => ({
      reader_id: read.user_id,
      last_read_at: read.last_read_at,
    }));
    const messages = normalizeChatMessages(page, reads);
    await signAttachments([{ id: roomId, transactionId: "", createdAt: "", updatedAt: "", messages, unreadCount: 0 }]);
    return { messages, hasMore: page.length === CHAT_PAGE_SIZE };
  }

  async addMessage(roomId: string, message: TransactionChatMessage) {
    const text = message.text.trim();
    if (!text && !message.attachments?.length) throw new Error("메시지 또는 첨부파일을 입력해 주세요.");
    if (text.length > 4000) throw new Error("메시지는 4,000자 이하로 입력해 주세요.");
    const { error } = await createSupabaseBrowserClient()
      .from("chat_messages")
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

  /** Called only while a room is genuinely open, visible and its messages rendered — never on a background Inbox fetch. */
  async markRead(roomId: string) {
    const client = createSupabaseBrowserClient();
    const { data: userData } = await client.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) return;
    const { error } = await client
      .from("room_reads")
      .upsert(
        { room_id: roomId, user_id: userId, last_read_at: new Date().toISOString() },
        { onConflict: "room_id,user_id" },
      );
    if (error) throw error;
  }

  /** The listener receives the affected room id so the store can refresh just
   * that conversation instead of rebuilding every room on every message. */
  subscribe(listener: (roomId?: string) => void) {
    const client = createSupabaseBrowserClient();
    const roomOf = (payload: { new?: Record<string, unknown> | null }) => (payload.new as { room_id?: string } | undefined)?.room_id;
    const channel = client
      .channel("car-master-chat-messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (payload: { new?: Record<string, unknown> | null }) =>
        listener(roomOf(payload)),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "room_reads" }, (payload: { new?: Record<string, unknown> | null }) =>
        listener(roomOf(payload)),
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }
}

export const supabaseChatRepository = new SupabaseChatRepository();
