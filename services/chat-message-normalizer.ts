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

export type ReadCursor = { reader_id: string; last_read_at: string };

/**
 * `readBy` is derived, not stored: every reader whose cursor (`last_read_at`)
 * is at or after a message's `created_at` has read it, and a sender always
 * "has read" their own message. This lets the existing `readBy.length > 1`
 * read-receipt check work unchanged once real cursors are supplied.
 */
export function normalizeChatMessages(rows: StoredChatMessage[], reads: ReadCursor[] = []): TransactionChatMessage[] {
  const unique = new Map(rows.map((row) => [row.id, row]));
  return [...unique.values()]
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
    .map((row) => {
      const senderId = row.sender_id ?? "system";
      const readBy = [senderId, ...reads.filter((read) => read.reader_id !== senderId && read.last_read_at >= row.created_at).map((read) => read.reader_id)];
      return {
        id: row.id,
        roomId: row.room_id,
        senderId,
        senderRole: row.sender_role,
        text: row.text,
        attachments: row.attachments ?? [],
        createdAt: row.created_at,
        readBy: [...new Set(readBy)],
      };
    });
}
