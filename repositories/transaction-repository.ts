import type { Transaction } from "../types/transactions";
import { readCollection, subscribeToStorage, writeCollection } from "./storage";

export const TRANSACTION_STORAGE_KEY = "car-master-transactions";
export interface TransactionRepository { getAll(): Transaction[]; getById(id: string): Transaction | null; create(value: Transaction): void; update(value: Transaction): void; hideForDealer(id: string): void; hideForInstaller(id: string): void; subscribe(listener: () => void): () => void }
export class LocalTransactionRepository implements TransactionRepository {
  getAll = () => readCollection<Transaction>(TRANSACTION_STORAGE_KEY);
  getById = (id: string) => this.getAll().find((item) => item.id === id) ?? null;
  create(value: Transaction) { if (this.getById(value.id)) return; writeCollection(TRANSACTION_STORAGE_KEY, [value, ...this.getAll()]); }
  update(value: Transaction) { writeCollection(TRANSACTION_STORAGE_KEY, this.getAll().map((item) => item.id === value.id ? value : item)); }
  hideForDealer(id: string) { const item = this.getById(id); if (item) this.update({ ...item, visibility: { ...item.visibility, hiddenByDealer: true } }); }
  hideForInstaller(id: string) { const item = this.getById(id); if (item) this.update({ ...item, visibility: { ...item.visibility, hiddenByInstaller: true } }); }
  subscribe(listener: () => void) { return subscribeToStorage(TRANSACTION_STORAGE_KEY, listener); }
}
export const transactionRepository = new LocalTransactionRepository();
