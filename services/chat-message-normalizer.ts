import type { ChatAttachment, TransactionChatMessage } from "../types/transactions";

export type StoredChatMessage = {
  id: string;
  room_id: string;
  sender_id: string | null;
  sender_role: TransactionChatMessage["senderRole"];
  text: string;
  attachments: ChatAttachment[];
  created_at: string;
};

export function normalizeChatMessages(rows: StoredChatMessage[]): TransactionChatMessage[] {
  const unique = new Map(rows.map((row) => [row.id, row]));
  return [...unique.values()]
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
    .map((row) => ({
      id: row.id,
      roomId: row.room_id,
      senderId: row.sender_id ?? "system",
      senderRole: row.sender_role,
      text: row.text,
      attachments: row.attachments ?? [],
      createdAt: row.created_at,
      readBy: [],
    }));
}

