import type { ChatRoom, TransactionChatMessage } from "../types/transactions";
import { readCollection, subscribeToStorage, writeCollection } from "./storage";

export const CHAT_STORAGE_KEY = "car-master-chat-rooms";
export interface ChatRepository { getAll(): ChatRoom[]; getByTransactionId(id: string): ChatRoom | null; create(room: ChatRoom): void; addMessage(roomId: string, message: TransactionChatMessage): void; subscribe(listener: () => void): () => void }
export class LocalChatRepository implements ChatRepository {
  getAll = () => readCollection<ChatRoom>(CHAT_STORAGE_KEY);
  getByTransactionId = (id: string) => this.getAll().find((room) => room.transactionId === id) ?? null;
  create(room: ChatRoom) { if (this.getAll().some((item) => item.id === room.id)) return; writeCollection(CHAT_STORAGE_KEY, [room, ...this.getAll()]); }
  addMessage(roomId: string, message: TransactionChatMessage) { writeCollection(CHAT_STORAGE_KEY, this.getAll().map((room) => room.id === roomId ? { ...room, messages: [...room.messages, message], updatedAt: message.createdAt } : room)); }
  subscribe(listener: () => void) { return subscribeToStorage(CHAT_STORAGE_KEY, listener); }
}
export const chatRepository = new LocalChatRepository();
