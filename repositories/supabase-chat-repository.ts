import { createSupabaseBrowserClient } from "../lib/supabase/client";
import type { ChatAttachment, ChatRoom, TransactionChatMessage } from "../types/transactions";

type MessageRow = { id: string; room_id: string; sender_id: string | null; sender_role: TransactionChatMessage["senderRole"]; text: string; attachments: ChatAttachment[]; created_at: string };
type RoomRow = { id: string; transaction_id: string; created_at: string; updated_at: string; chat_messages: MessageRow[] };

const mapMessage = (row: MessageRow): TransactionChatMessage => ({
  id: row.id, roomId: row.room_id, senderId: row.sender_id ?? "system", senderRole: row.sender_role,
  text: row.text, attachments: row.attachments ?? [], createdAt: row.created_at, readBy: [],
});

export class SupabaseChatRepository {
  async getAll(): Promise<ChatRoom[]> {
    const { data, error } = await createSupabaseBrowserClient().from("transaction_rooms")
      .select("id,transaction_id,created_at,updated_at,chat_messages(id,room_id,sender_id,sender_role,text,attachments,created_at)")
      .order("created_at", { referencedTable: "chat_messages", ascending: true });
    if (error) throw error;
    const rooms = ((data ?? []) as unknown as RoomRow[]).map((room) => ({
      id: room.id, transactionId: room.transaction_id, createdAt: room.created_at, updatedAt: room.updated_at,
      messages: (room.chat_messages ?? []).map(mapMessage),
    }));
    const attachments = rooms.flatMap((room) => room.messages.flatMap((message) => message.attachments ?? [])).filter((item) => item.storagePath);
    await Promise.all(attachments.map(async (attachment) => {
      const { data: signed } = await createSupabaseBrowserClient().storage.from("transaction-attachments").createSignedUrl(attachment.storagePath!, 3600);
      attachment.url = signed?.signedUrl ?? "";
    }));
    return rooms;
  }

  async addMessage(roomId: string, message: TransactionChatMessage) {
    const { error } = await createSupabaseBrowserClient().from("chat_messages").insert({
      room_id: roomId, sender_id: message.senderId, sender_role: message.senderRole,
      text: message.text, attachments: message.attachments ?? [], created_at: message.createdAt,
    });
    if (error) throw error;
  }

  subscribe(listener: () => void) {
    const client = createSupabaseBrowserClient();
    const channel = client.channel("car-master-chat-messages").on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, listener).subscribe();
    return () => { void client.removeChannel(channel); };
  }
}

export const supabaseChatRepository = new SupabaseChatRepository();
