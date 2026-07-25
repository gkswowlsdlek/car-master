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

export interface TransactionRepository { getAll(): Transaction[]; getById(id: string): Transaction | null; create(value: Transaction): void; update(value: Transaction): void; upsert(value: Transaction): void; hideForDealer(id: string): void; hideForInstaller(id: string): void; subscribe(listener: () => void): () => void }
export class LocalTransactionRepository implements TransactionRepository {
  getAll = () => readCollection<Transaction>(TRANSACTION_STORAGE_KEY).map(normalizeTransaction);
  getById = (id: string) => this.getAll().find((item) => item.id === id) ?? null;
  create(value: Transaction) { if (this.getById(value.id)) throw new Error(`Transaction ${value.id} already exists.`); writeCollection(TRANSACTION_STORAGE_KEY, [value, ...this.getAll()]); }
  update(value: Transaction) { if (!this.getById(value.id)) throw new Error(`Transaction ${value.id} was not found.`); writeCollection(TRANSACTION_STORAGE_KEY, this.getAll().map((item) => item.id === value.id ? value : item)); }
  upsert(value: Transaction) { if (this.getById(value.id)) this.update(value); else this.create(value); }
  hideForDealer(id: string) { const item = this.getById(id); if (item) this.update({ ...item, visibility: { ...item.visibility, hiddenByDealer: true } }); }
  hideForInstaller(id: string) { const item = this.getById(id); if (item) this.update({ ...item, visibility: { ...item.visibility, hiddenByInstaller: true } }); }
  subscribe(listener: () => void) { return subscribeToStorage(TRANSACTION_STORAGE_KEY, listener); }
}
export const transactionRepository = new LocalTransactionRepository();
