import type { ChatRoom, TransactionChatMessage } from "../types/transactions";
import { readCollection, subscribeToStorage, writeCollection } from "./storage";

export const CHAT_STORAGE_KEY = "car-master-chat-rooms";

/** Hours-ago ISO string — seed conversations stay relative for the same reason
 * the seed schedules do (see transaction-repository.ts). */
function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 3600000).toISOString();
}

/** Demo-only seed conversations for the two showcase transactions in
 * transaction-repository.ts. CHAT-DEMO-0001 is deliberately absent — that room
 * lives in the shared demo_chat_* backend so 1/1 <-> 2/2 messaging still works
 * across browsers. Computed at read time and never written to storage: the
 * moment the user actually sends a message, addMessage() upserts a real stored
 * room whose id shadows the seed. */
function demoSeedRooms(): ChatRoom[] {
  return [
    {
      id: "CHAT-DEMO-0003",
      transactionId: "CM-DEMO-0003",
      unreadCount: 1,
      createdAt: hoursAgo(30),
      updatedAt: hoursAgo(1),
      messages: [
        {
          id: "MSG-DEMO-0301",
          roomId: "CHAT-DEMO-0003",
          senderId: "hanjaejin-dealer",
          senderRole: "dealer",
          text: "테슬라 모델 3 유리막 코팅 문의드립니다. 이번 주 금요일 오전 가능할까요?",
          createdAt: hoursAgo(30),
          readBy: ["hanjaejin-dealer", "SHOP-BS-001"],
        },
        {
          id: "MSG-DEMO-0302",
          roomId: "CHAT-DEMO-0003",
          senderId: "SHOP-BS-001",
          senderRole: "shop",
          text: "22일 오전 11시 가능합니다. 확정해 주세요.",
          createdAt: hoursAgo(1),
          readBy: ["SHOP-BS-001"],
        },
      ],
    },
    {
      id: "CHAT-DEMO-0002",
      transactionId: "CM-DEMO-0002",
      unreadCount: 1,
      createdAt: hoursAgo(72),
      updatedAt: hoursAgo(3),
      messages: [
        {
          id: "MSG-DEMO-0201",
          roomId: "CHAT-DEMO-0002",
          senderId: "hanjaejin-dealer",
          senderRole: "dealer",
          text: "제네시스 G80 어제 입고했습니다. 프론트 PPF 진행 부탁드립니다.",
          createdAt: hoursAgo(24),
          readBy: ["hanjaejin-dealer", "INS-CN-001"],
        },
        {
          id: "MSG-DEMO-0202",
          roomId: "CHAT-DEMO-0002",
          senderId: "INS-CN-001",
          senderRole: "shop",
          text: "프론트 작업 중 사진 보내드립니다.",
          createdAt: hoursAgo(3),
          readBy: ["INS-CN-001"],
        },
      ],
    },
  ];
}

export interface ChatRepository {
  getAll(): ChatRoom[];
  getByTransactionId(id: string): ChatRoom | null;
  create(room: ChatRoom): void;
  update(room: ChatRoom): void;
  upsert(room: ChatRoom): void;
  addMessage(roomId: string, message: TransactionChatMessage): void;
  subscribe(listener: () => void): () => void;
}
export class LocalChatRepository implements ChatRepository {
  // Single-browser localStorage chat has no cross-reader concept, so unread
  // tracking doesn't apply here — only shared (demo_chat_*-backed) rooms
  // compute a real unreadCount (see hooks/use-transaction-store.ts).
  getAll = () => {
    const stored = readCollection<ChatRoom>(CHAT_STORAGE_KEY).map((room) => ({
      ...room,
      unreadCount: room.unreadCount ?? 0,
    }));
    const storedIds = new Set(stored.map((room) => room.id));
    return [...demoSeedRooms().filter((room) => !storedIds.has(room.id)), ...stored];
  };
  getByTransactionId = (id: string) => this.getAll().find((room) => room.transactionId === id) ?? null;
  create(room: ChatRoom) {
    if (this.getAll().some((item) => item.id === room.id)) throw new Error(`Chat room ${room.id} already exists.`);
    writeCollection(CHAT_STORAGE_KEY, [room, ...this.getAll()]);
  }
  update(room: ChatRoom) {
    if (!this.getAll().some((item) => item.id === room.id)) throw new Error(`Chat room ${room.id} was not found.`);
    writeCollection(
      CHAT_STORAGE_KEY,
      this.getAll().map((item) => (item.id === room.id ? room : item)),
    );
  }
  upsert(room: ChatRoom) {
    if (this.getAll().some((item) => item.id === room.id)) this.update(room);
    else this.create(room);
  }
  addMessage(roomId: string, message: TransactionChatMessage) {
    const room = this.getAll().find((item) => item.id === roomId);
    if (!room) throw new Error(`Chat room ${roomId} was not found.`);
    this.update({ ...room, messages: [...room.messages, message], updatedAt: message.createdAt });
  }
  subscribe(listener: () => void) {
    return subscribeToStorage(CHAT_STORAGE_KEY, listener);
  }
}
export const chatRepository = new LocalChatRepository();
