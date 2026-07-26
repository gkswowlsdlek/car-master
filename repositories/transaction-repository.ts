import type { Transaction, TransactionStage } from "../types/transactions";
import { readCollection, subscribeToStorage, writeCollection } from "./storage";

export const TRANSACTION_STORAGE_KEY = "car-master-transactions";

// v0.3.9 renamed the stage model (접수/입고예정/시공중/완료 -> 견적/시공예약/(fold)/작업완료).
// Transactions already sitting in a browser's localStorage from before this
// change still carry the old literals and have no stageLog at all — normalize
// both on read so old demo data keeps working instead of breaking silently.
const LEGACY_STAGE_MAP: Partial<Record<string, TransactionStage>> = { 접수: "견적", 입고예정: "시공예약", 시공중: "입고", 완료: "작업완료" };
function normalizeTransaction(value: Transaction): Transaction {
  const mappedStage = LEGACY_STAGE_MAP[value.status.stage];
  return {
    ...value,
    status: mappedStage ? { ...value.status, stage: mappedStage } : value.status,
    stageLog: value.stageLog ?? [],
  };
}

// v0.3.10 messenger needs at least one transaction id both the demo dealer
// (hanjaejin-dealer) and demo installer (misa-starhills-shop) see by default,
// in ANY browser, with no dependency on one browser having created it — demo
// transactions otherwise live only in that one browser's localStorage. This
// fixed record is computed at read time (never itself written to storage);
// its chat lives in the shared Supabase-backed demo_chat_* tables (see
// repositories/demo-chat-repository.ts) so 1/1 <-> 2/2 messaging is testable
// across two separate browsers out of the box. Any real mutation (stage
// change, price, etc.) still lands in this browser's own localStorage via the
// normal update() path the moment it's touched, same as any other transaction.
const DEMO_SEED_CREATED_AT = "2026-07-27T01:00:00.000Z";
const DEMO_SEED_TRANSACTIONS: Transaction[] = [{
  id: "CM-DEMO-0001", dealerId: "hanjaejin-dealer", installerId: "SHOP-MISA-001", installerName: "미사 스타힐스 시공점",
  vehicle: { maker: "BMW", model: "X5", class: "수입 대형/SUV" },
  service: { brand: "버텍스", product: "카본 스텔스", workDescription: "전면 유리 & 사이드 썬팅", extraRequest: "" },
  pricing: { baseGuidePrice: 450000, surcharge: 0, paymentStatus: "미결제" },
  schedule: { requestedInboundAt: "2026-07-29", confirmedInboundAt: "2026-07-29T10:00:00.000Z" },
  status: { stage: "시공예약", createdAt: DEMO_SEED_CREATED_AT, updatedAt: DEMO_SEED_CREATED_AT },
  visibility: { hiddenByDealer: false, hiddenByInstaller: false },
  chatRoomId: "CHAT-DEMO-0001", lastMessage: "시공예약이 확정되었습니다. 7월 29일 오전 10:00",
  stageLog: [
    { id: "EVT-DEMO-0001", fromStage: null, toStage: "견적", actorRole: "dealer", direction: "forward", createdAt: DEMO_SEED_CREATED_AT },
    { id: "EVT-DEMO-0002", fromStage: "견적", toStage: "시공예약", actorRole: "shop", direction: "forward", createdAt: DEMO_SEED_CREATED_AT },
  ],
}];

/** Chat room ids whose messages live in the shared, anon-open demo_chat_* backend (see demo-chat-repository.ts) instead of this browser's own localStorage — currently just the fixed seed room above. */
export const SHARED_DEMO_ROOM_IDS = new Set(DEMO_SEED_TRANSACTIONS.map((item) => item.chatRoomId));

export interface TransactionRepository { getAll(): Transaction[]; getById(id: string): Transaction | null; create(value: Transaction): void; update(value: Transaction): void; upsert(value: Transaction): void; hideForDealer(id: string): void; hideForInstaller(id: string): void; subscribe(listener: () => void): () => void }
export class LocalTransactionRepository implements TransactionRepository {
  getAll = () => {
    const stored = readCollection<Transaction>(TRANSACTION_STORAGE_KEY).map(normalizeTransaction);
    const storedIds = new Set(stored.map((item) => item.id));
    return [...DEMO_SEED_TRANSACTIONS.filter((item) => !storedIds.has(item.id)), ...stored];
  };
  getById = (id: string) => this.getAll().find((item) => item.id === id) ?? null;
  create(value: Transaction) { if (this.getById(value.id)) throw new Error(`Transaction ${value.id} already exists.`); writeCollection(TRANSACTION_STORAGE_KEY, [value, ...this.getAll()]); }
  update(value: Transaction) { if (!this.getById(value.id)) throw new Error(`Transaction ${value.id} was not found.`); writeCollection(TRANSACTION_STORAGE_KEY, this.getAll().map((item) => item.id === value.id ? value : item)); }
  upsert(value: Transaction) { if (this.getById(value.id)) this.update(value); else this.create(value); }
  hideForDealer(id: string) { const item = this.getById(id); if (item) this.update({ ...item, visibility: { ...item.visibility, hiddenByDealer: true } }); }
  hideForInstaller(id: string) { const item = this.getById(id); if (item) this.update({ ...item, visibility: { ...item.visibility, hiddenByInstaller: true } }); }
  subscribe(listener: () => void) { return subscribeToStorage(TRANSACTION_STORAGE_KEY, listener); }
}
export const transactionRepository = new LocalTransactionRepository();
