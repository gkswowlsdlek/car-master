import { createSupabaseBrowserClient } from "../lib/supabase/client";
import { normalizeChatMessages, type ReadCursor, type StoredChatMessage } from "../services/chat-message-normalizer";
import type { ChatRoom, TransactionChatMessage } from "../types/transactions";

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

export class SupabaseChatRepository {
  async getAll(): Promise<ChatRoom[]> {
    const client = createSupabaseBrowserClient();
    const [{ data, error }, { data: userData }] = await Promise.all([
      client
        .from("transaction_rooms")
        .select(
          "id,transaction_id,created_at,updated_at,chat_messages(id,room_id,sender_id,sender_role,text,attachments,created_at),room_reads(user_id,last_read_at)",
        )
        .order("created_at", { referencedTable: "chat_messages", ascending: true }),
      client.auth.getUser(),
    ]);
    if (error) throw error;
    const myId = userData?.user?.id ?? "";
    const rooms = ((data ?? []) as unknown as RoomRow[]).map((room) => {
      const reads: ReadCursor[] = (room.room_reads ?? []).map((read) => ({
        reader_id: read.user_id,
        last_read_at: read.last_read_at,
      }));
      const messages = normalizeChatMessages(room.chat_messages ?? [], reads);
      const myCursor = reads.find((read) => read.reader_id === myId)?.last_read_at ?? "";
      const unreadCount = messages.filter(
        (message) => message.senderId !== myId && message.createdAt > myCursor,
      ).length;
      return {
        id: room.id,
        transactionId: room.transaction_id,
        createdAt: room.created_at,
        updatedAt: room.updated_at,
        messages,
        unreadCount,
      };
    });
    const attachments = rooms
      .flatMap((room) => room.messages.flatMap((message) => message.attachments ?? []))
      .filter((item) => item.storagePath);
    await Promise.all(
      attachments.map(async (attachment) => {
        const { data: signed, error: signedError } = await client.storage
          .from("transaction-attachments")
          .createSignedUrl(attachment.storagePath!, 3600);
        attachment.url = signedError ? "" : (signed?.signedUrl ?? "");
      }),
    );
    return rooms;
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

  subscribe(listener: () => void) {
    const client = createSupabaseBrowserClient();
    const channel = client
      .channel("car-master-chat-messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, listener)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_reads" }, listener)
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }
}

export const supabaseChatRepository = new SupabaseChatRepository();
