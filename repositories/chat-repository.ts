import type { ChatRoom, TransactionChatMessage } from "../types/transactions";
import { readCollection, subscribeToStorage, writeCollection } from "./storage";

export const CHAT_STORAGE_KEY = "car-master-chat-rooms";

/** Hours-ago ISO string — seed conversations stay relative for the same reason
 * the seed schedules do (see transaction-repository.ts). */
function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 3600000).toISOString();
}

/** Demo-only seed conversations for the showcase transactions in
 * transaction-repository.ts. CHAT-DEMO-0001 is deliberately absent — that room
 * lives in the shared demo_chat_* backend so 1/1 <-> 2/2 messaging still works
 * across browsers. Two deals (CM-DEMO-0004, CM-DEMO-0011) are deliberately
 * left without a room: both are brand-new 견적 requests, and a dealer really
 * does have deals nobody has written in yet — the Inbox needs to show that
 * state too, not only full conversations.
 *
 * Computed at read time and never written to storage: the moment the user
 * actually sends a message, addMessage() upserts a real stored room whose id
 * shadows the seed. */
const DEALER = "hanjaejin-dealer";

type SeedTurn = { from: "dealer" | "shop"; text: string; hoursAgo: number };
type SeedRoom = { n: string; shopId: string; unread?: number; turns: SeedTurn[] };

const SEED_ROOMS: SeedRoom[] = [
  {
    n: "0002",
    shopId: "INS-CN-001",
    turns: [
      { from: "dealer", text: "제네시스 G80 전면 + 측후면 썬팅 요청드립니다. 어제 입고했습니다.", hoursAgo: 26 },
      { from: "shop", text: "확인했습니다. 오늘 오후에 작업 들어갑니다.", hoursAgo: 22 },
      { from: "shop", text: "작업 진행 중 사진 보내드립니다.", hoursAgo: 3 },
    ],
  },
  {
    n: "0003",
    shopId: "SHOP-BS-001",
    unread: 1,
    turns: [
      { from: "dealer", text: "테슬라 모델 3 측후면 썬팅 문의드립니다. 다음 주 초 가능할까요?", hoursAgo: 30 },
      { from: "shop", text: "제안드린 날짜로 확정해 주시면 바로 잡아두겠습니다.", hoursAgo: 1 },
    ],
  },
  {
    n: "0005",
    shopId: "INS-JJ-001",
    turns: [
      { from: "dealer", text: "카니발 신차 썬팅 패키지 부탁드립니다. 고객 정보는 거래방에 등록해두었습니다.", hoursAgo: 300 },
      { from: "shop", text: "작업 마치고 출고 준비 끝났습니다. 최종 금액 62만원으로 정리했습니다.", hoursAgo: 220 },
      { from: "dealer", text: "확인했습니다. 출고 완료 처리하겠습니다.", hoursAgo: 216 },
    ],
  },
  {
    n: "0006",
    shopId: "INS-GN-001",
    unread: 1,
    turns: [
      { from: "dealer", text: "볼보 XC60 전면 유리 & 사이드 썬팅 진행 부탁드립니다.", hoursAgo: 80 },
      { from: "shop", text: "작업 완료했습니다. 출고 일정 알려주세요.", hoursAgo: 5 },
    ],
  },
  {
    n: "0007",
    shopId: "SHOP-SEOUL-REAL-001",
    turns: [
      { from: "dealer", text: "벤츠 E250 전면 썬팅 가능한 날짜 있을까요?", hoursAgo: 360 },
      { from: "dealer", text: "고객 출고 일정이 앞당겨져 이번 건은 취소하겠습니다. 다음에 다시 연락드리겠습니다.", hoursAgo: 264 },
    ],
  },
  {
    n: "0008",
    shopId: "INS-GB-001",
    turns: [
      { from: "dealer", text: "팰리세이드 신차 썬팅 패키지 요청드립니다. 차량번호는 아직 안 나왔습니다.", hoursAgo: 160 },
      { from: "shop", text: "차대번호로 먼저 확인하겠습니다. 번호 나오면 알려주세요.", hoursAgo: 150 },
      { from: "shop", text: "오늘 오전 입고 확인했습니다.", hoursAgo: 6 },
    ],
  },
  {
    n: "0009",
    shopId: "INS-GW-001",
    unread: 1,
    turns: [
      { from: "dealer", text: "쏘렌토 측후면 썬팅 요청드립니다. 다음 주 화요일 오전 가능할까요?", hoursAgo: 60 },
      { from: "shop", text: "화요일 오전 10시로 잡아두겠습니다.", hoursAgo: 20 },
    ],
  },
  {
    n: "0010",
    shopId: "SHOP-MISA-001",
    turns: [
      { from: "dealer", text: "아우디 Q5 전면 유리 & 사이드 썬팅 부탁드립니다.", hoursAgo: 200 },
      { from: "shop", text: "작업 완료했습니다. 확인 부탁드립니다.", hoursAgo: 26 },
    ],
  },
  {
    n: "0012",
    shopId: "SHOP-MISA-001",
    turns: [
      { from: "dealer", text: "K8 신차 썬팅 패키지 진행 부탁드립니다.", hoursAgo: 520 },
      { from: "shop", text: "작업 완료했습니다. 보증서 발급까지 마쳤습니다.", hoursAgo: 350 },
      { from: "dealer", text: "출고 완료되었습니다. 감사합니다.", hoursAgo: 340 },
    ],
  },
];

function demoSeedRooms(): ChatRoom[] {
  return SEED_ROOMS.map((room) => {
    const roomId = `CHAT-DEMO-${room.n}`;
    const unread = room.unread ?? 0;
    // The last `unread` messages are the ones this dealer hasn't opened yet.
    const firstUnreadIndex = room.turns.length - unread;
    return {
      id: roomId,
      transactionId: `CM-DEMO-${room.n}`,
      unreadCount: unread,
      createdAt: hoursAgo(room.turns[0].hoursAgo),
      updatedAt: hoursAgo(room.turns[room.turns.length - 1].hoursAgo),
      messages: room.turns.map((turn, index) => {
        const senderId = turn.from === "dealer" ? DEALER : room.shopId;
        return {
          id: `MSG-DEMO-${room.n}${index + 1}`,
          roomId,
          senderId,
          senderRole: turn.from,
          text: turn.text,
          createdAt: hoursAgo(turn.hoursAgo),
          readBy: index >= firstUnreadIndex ? [senderId] : [DEALER, room.shopId],
        };
      }),
    };
  });
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
