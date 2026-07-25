import type { PaymentStatus, Transaction, TransactionStage, TransactionStageEvent } from "../types/transactions";

export type TransactionActorRole = "dealer" | "shop" | "admin";

/** The only four stages a transaction moves through, one step at a time. */
export const stageOrder: TransactionStage[] = ["견적", "시공예약", "입고", "작업완료"];

/** Button label for moving forward INTO this stage (the "다음 행동" CTA). */
export const STAGE_ACTION_LABEL: Record<TransactionStage, string> = {
  견적: "견적 확정", 시공예약: "시공예약 확정", 입고: "입고 처리", 작업완료: "작업완료", 취소: "취소 처리",
};

/** Label for the small "이전 단계로" link when reverting back to this stage. */
export const STAGE_REVERT_LABEL: Record<TransactionStage, string> = {
  견적: "견적으로 되돌리기", 시공예약: "시공예약으로 되돌리기", 입고: "입고 상태로 되돌리기", 작업완료: "작업완료로 되돌리기", 취소: "취소로 되돌리기",
};

/** Past-tense form of the same label, used in the 거래 로그 list. */
export const STAGE_REVERT_LOG_LABEL: Record<TransactionStage, string> = {
  견적: "견적으로 되돌림", 시공예약: "시공예약으로 되돌림", 입고: "입고로 되돌림", 작업완료: "작업완료로 되돌림", 취소: "취소로 되돌림",
};

export function stageLogLabel(event: TransactionStageEvent): string {
  return event.direction === "forward" ? STAGE_ACTION_LABEL[event.toStage] : STAGE_REVERT_LOG_LABEL[event.toStage];
}

export function nextForwardStage(current: TransactionStage): TransactionStage | undefined {
  const index = stageOrder.indexOf(current);
  return index >= 0 ? stageOrder[index + 1] : undefined;
}

export function revertStage(current: TransactionStage): TransactionStage | undefined {
  const index = stageOrder.indexOf(current);
  return index > 0 ? stageOrder[index - 1] : undefined;
}

/**
 * Only the assigned installer (or an admin) can move the stage — this is a
 * "다음 행동" a shop performs, not something a dealer controls. Exactly one
 * step forward or one step back; no skipping and no jumping to an arbitrary
 * past stage. 취소 is kept only for backward compatibility with any
 * already-cancelled transaction and is reachable by dealer/admin from any
 * stage, but the new UI does not expose a way to trigger it.
 */
export function canTransitionStage(current: TransactionStage, next: TransactionStage, role: TransactionActorRole) {
  if (next === "취소") return role === "dealer" || role === "admin";
  if (role !== "shop" && role !== "admin") return false;
  const currentIndex = stageOrder.indexOf(current);
  const nextIndex = stageOrder.indexOf(next);
  if (currentIndex < 0 || nextIndex < 0) return false;
  return Math.abs(nextIndex - currentIndex) === 1;
}

export function transitionStage(transaction: Transaction, next: TransactionStage, role: TransactionActorRole, now = new Date().toISOString()): Transaction {
  const current = transaction.status.stage;
  if (!canTransitionStage(current, next, role)) throw new Error(`${role} cannot transition ${current} to ${next}.`);
  const currentIndex = stageOrder.indexOf(current);
  const nextIndex = stageOrder.indexOf(next);
  const direction: TransactionStageEvent["direction"] = nextIndex > currentIndex ? "forward" : "backward";
  const event: TransactionStageEvent = { id: `EVT-${now}-${Math.round(Math.random() * 1e6)}`, fromStage: current, toStage: next, actorRole: role, direction, createdAt: now };
  return {
    ...transaction,
    schedule: { ...transaction.schedule, completedAt: next === "작업완료" ? now : direction === "backward" && current === "작업완료" ? undefined : transaction.schedule.completedAt },
    status: { ...transaction.status, stage: next, updatedAt: now },
    stageLog: [...(transaction.stageLog ?? []), event],
  };
}

export function transitionPayment(transaction: Transaction, next: PaymentStatus, role: TransactionActorRole, now = new Date().toISOString()): Transaction {
  const allowed: Record<PaymentStatus, Partial<Record<TransactionActorRole, PaymentStatus[]>>> = {
    미결제: { dealer: ["결제대기"], shop: ["결제대기"] }, 결제대기: { dealer: ["결제완료"], admin: ["결제완료"] },
    결제완료: { admin: ["정산대기"] }, 정산대기: { admin: ["정산완료"] }, 정산완료: {},
  };
  if (!allowed[transaction.pricing.paymentStatus][role]?.includes(next)) throw new Error(`${role} cannot transition payment to ${next}.`);
  return { ...transaction, pricing: { ...transaction.pricing, paymentStatus: next, paymentAt: next === "결제완료" ? now : transaction.pricing.paymentAt }, status: { ...transaction.status, updatedAt: now } };
}
