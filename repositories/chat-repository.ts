import type { ChatRoom, TransactionChatMessage } from "../types/transactions";
import { readCollection, subscribeToStorage, writeCollection } from "./storage";

export const CHAT_STORAGE_KEY = "car-master-chat-rooms";
export interface ChatRepository { getAll(): ChatRoom[]; getByTransactionId(id: string): ChatRoom | null; create(room: ChatRoom): void; update(room: ChatRoom): void; upsert(room: ChatRoom): void; addMessage(roomId: string, message: TransactionChatMessage): void; subscribe(listener: () => void): () => void }
export class LocalChatRepository implements ChatRepository {
  getAll = () => readCollection<ChatRoom>(CHAT_STORAGE_KEY);
  getByTransactionId = (id: string) => this.getAll().find((room) => room.transactionId === id) ?? null;
  create(room: ChatRoom) { if (this.getAll().some((item) => item.id === room.id)) throw new Error(`Chat room ${room.id} already exists.`); writeCollection(CHAT_STORAGE_KEY, [room, ...this.getAll()]); }
  update(room: ChatRoom) { if (!this.getAll().some((item) => item.id === room.id)) throw new Error(`Chat room ${room.id} was not found.`); writeCollection(CHAT_STORAGE_KEY, this.getAll().map((item) => item.id === room.id ? room : item)); }
  upsert(room: ChatRoom) { if (this.getAll().some((item) => item.id === room.id)) this.update(room); else this.create(room); }
  addMessage(roomId: string, message: TransactionChatMessage) { const room = this.getAll().find((item) => item.id === roomId); if (!room) throw new Error(`Chat room ${roomId} was not found.`); this.update({ ...room, messages: [...room.messages, message], updatedAt: message.createdAt }); }
  subscribe(listener: () => void) { return subscribeToStorage(CHAT_STORAGE_KEY, listener); }
}
export const chatRepository = new LocalChatRepository();
