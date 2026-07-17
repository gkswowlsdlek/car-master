import type { PaymentStatus, Transaction, TransactionStage } from "../types/transactions";

export type TransactionActorRole = "dealer" | "shop" | "admin";
const stageOrder: TransactionStage[] = ["접수", "입고예정", "입고", "시공중", "완료"];

export function canTransitionStage(current: TransactionStage, next: TransactionStage, role: TransactionActorRole) {
  if (next === "취소") return role === "dealer" || role === "admin";
  const currentIndex = stageOrder.indexOf(current);
  const nextIndex = stageOrder.indexOf(next);
  if (currentIndex < 0 || nextIndex < 0 || nextIndex !== currentIndex + 1) return false;
  if (current === "접수") return role === "shop";
  if (["입고예정", "입고", "시공중"].includes(current)) return role === "shop" || role === "admin";
  return false;
}

export function transitionStage(transaction: Transaction, next: TransactionStage, role: TransactionActorRole, now = new Date().toISOString()): Transaction {
  if (!canTransitionStage(transaction.status.stage, next, role)) throw new Error(`${role} cannot transition ${transaction.status.stage} to ${next}.`);
  return { ...transaction, schedule: { ...transaction.schedule, completedAt: next === "완료" ? now : transaction.schedule.completedAt }, status: { ...transaction.status, stage: next, updatedAt: now } };
}

export function transitionPayment(transaction: Transaction, next: PaymentStatus, role: TransactionActorRole, now = new Date().toISOString()): Transaction {
  const allowed: Record<PaymentStatus, Partial<Record<TransactionActorRole, PaymentStatus[]>>> = {
    미결제: { dealer: ["결제대기"], shop: ["결제대기"] }, 결제대기: { dealer: ["결제완료"], admin: ["결제완료"] },
    결제완료: { admin: ["정산대기"] }, 정산대기: { admin: ["정산완료"] }, 정산완료: {},
  };
  if (!allowed[transaction.pricing.paymentStatus][role]?.includes(next)) throw new Error(`${role} cannot transition payment to ${next}.`);
  return { ...transaction, pricing: { ...transaction.pricing, paymentStatus: next, paymentAt: next === "결제완료" ? now : transaction.pricing.paymentAt }, status: { ...transaction.status, updatedAt: now } };
}
