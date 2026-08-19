import type {
  PaymentStatus,
  Transaction,
  TransactionStage,
  TransactionStageEvent,
  WarrantyInfo,
  WarrantyStatus,
} from "../types/transactions";

export type TransactionActorRole = "dealer" | "shop" | "admin";

/** The five stages a transaction moves through, one step at a time. */
export const stageOrder: TransactionStage[] = ["견적", "시공예약", "입고", "작업완료", "출고"];

/**
 * Dealer-facing product spec is exactly 4 stages (입고 전/작업 중/작업 완료/출고) —
 * internal DB stage keys stay the granular 5-stage model above (Shop/Admin
 * still see and drive that directly). This is a display-only collapse for
 * the dealer role: 견적 and 시공예약 both read as "입고 전".
 */
export const DEALER_STAGE_LABELS = ["입고 전", "작업 중", "작업 완료", "출고"] as const;

export function dealerStageIndex(stage: TransactionStage): number {
  if (stage === "견적" || stage === "시공예약") return 0;
  if (stage === "입고") return 1;
  if (stage === "작업완료") return 2;
  return 3; // 출고 — 취소/시공불가 also fall back here but are handled separately by dealerStageLabel
}

export function dealerStageLabel(stage: TransactionStage): string {
  if (stage === "취소") return "취소";
  if (stage === "시공불가") return "시공 불가";
  return DEALER_STAGE_LABELS[dealerStageIndex(stage)];
}

/** 취소/시공불가 end the transaction outside the normal work-stage
 * progression — see end_transaction_outcome (not transition_transaction_stage). */
export const TERMINAL_OUTCOME_STAGES: TransactionStage[] = ["취소", "시공불가"];

export function isTerminalOutcome(stage: TransactionStage): boolean {
  return TERMINAL_OUTCOME_STAGES.includes(stage);
}

/** Button label for moving forward INTO this stage (the "다음 행동" CTA). */
export const STAGE_ACTION_LABEL: Record<TransactionStage, string> = {
  견적: "견적 확정",
  시공예약: "시공예약 확정",
  입고: "입고 처리",
  작업완료: "작업완료",
  출고: "출고 처리",
  취소: "취소 처리",
  시공불가: "시공 불가 처리",
};

/** Label for the small "이전 단계로" link when reverting back to this stage. */
export const STAGE_REVERT_LABEL: Record<TransactionStage, string> = {
  견적: "견적으로 되돌리기",
  시공예약: "시공예약으로 되돌리기",
  입고: "입고 상태로 되돌리기",
  작업완료: "작업완료로 되돌리기",
  출고: "출고로 되돌리기",
  취소: "취소로 되돌리기",
  시공불가: "시공불가로 되돌리기",
};

/** Past-tense form of the same label, used in the 거래 로그 list. */
export const STAGE_REVERT_LOG_LABEL: Record<TransactionStage, string> = {
  견적: "견적으로 되돌림",
  시공예약: "시공예약으로 되돌림",
  입고: "입고로 되돌림",
  작업완료: "작업완료로 되돌림",
  출고: "출고로 되돌림",
  취소: "취소로 되돌림",
  시공불가: "시공불가로 되돌림",
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
 * Beta core requirement: the flow must never stall waiting on an Installer
 * who may never open Car-Master, so the dealer can drive the work stage
 * forward/back on their own transaction too, same as the shop side — this
 * function only encodes "is this move shape allowed" (one step forward or
 * one step back, no skipping, no jumping to an arbitrary past stage); the
 * server RPC is what enforces "does this actor own this transaction." 취소
 * is kept only for backward compatibility with any already-cancelled
 * transaction and is reachable by dealer/admin from any stage, but the UI
 * does not expose a way to trigger it.
 */
export function canTransitionStage(current: TransactionStage, next: TransactionStage, role: TransactionActorRole) {
  if (next === "취소" || next === "시공불가") return role === "dealer" || role === "admin";
  const currentIndex = stageOrder.indexOf(current);
  const nextIndex = stageOrder.indexOf(next);
  if (currentIndex < 0 || nextIndex < 0) return false;
  return Math.abs(nextIndex - currentIndex) === 1;
}

export function transitionStage(
  transaction: Transaction,
  next: TransactionStage,
  role: TransactionActorRole,
  now = new Date().toISOString(),
): Transaction {
  const current = transaction.status.stage;
  if (!canTransitionStage(current, next, role)) throw new Error(`${role} cannot transition ${current} to ${next}.`);
  const currentIndex = stageOrder.indexOf(current);
  const nextIndex = stageOrder.indexOf(next);
  const direction: TransactionStageEvent["direction"] = nextIndex > currentIndex ? "forward" : "backward";
  const event: TransactionStageEvent = {
    id: `EVT-${now}-${Math.round(Math.random() * 1e6)}`,
    fromStage: current,
    toStage: next,
    actorRole: role,
    direction,
    createdAt: now,
  };
  return {
    ...transaction,
    schedule: {
      ...transaction.schedule,
      completedAt:
        next === "작업완료"
          ? now
          : direction === "backward" && current === "작업완료"
            ? undefined
            : transaction.schedule.completedAt,
    },
    status: { ...transaction.status, stage: next, updatedAt: now },
    stageLog: [...(transaction.stageLog ?? []), event],
  };
}

/** Never stored — see WarrantyStatus's doc comment. Pure function so
 * Supabase/shared-demo/local rows all compute the same label from whatever
 * fields they actually carry. */
export function warrantyStatus(warranty: WarrantyInfo): WarrantyStatus {
  if (warranty.issuedAt) return "ISSUED";
  if (warranty.customerName && warranty.customerPhone && warranty.vehicleNumber) return "READY";
  return "NOT_READY";
}

export const WARRANTY_STATUS_LABEL: Record<WarrantyStatus, string> = {
  NOT_READY: "보증서 정보 미입력",
  READY: "발급 대기",
  ISSUED: "발급 완료",
};

/** Small badge className suffix per warranty status — reuses existing
 * design-system color tokens (warning/primary/success), no new colors. */
export const WARRANTY_STATUS_BADGE_CLASS: Record<WarrantyStatus, string> = {
  NOT_READY: "warranty-badge-pending",
  READY: "warranty-badge-ready",
  ISSUED: "warranty-badge-issued",
};

/**
 * Simplified 6-value operational-status vocabulary shared by Dealer/Shop/
 * Admin transaction-management list & detail views (확인 필요/일정 확정/
 * 작업 중/완료/취소/시공불가) — collapses the 7 raw DB stage keys down to
 * what those screens need to scan at a glance (작업완료 and 출고 both read
 * as "완료"; the existing status-* CSS classes still key off the RAW stage
 * so 완료-작업중 vs 완료-출고 stay visually distinct even with the same text).
 * This is deliberately separate from dealerStageLabel/DEALER_STAGE_LABELS,
 * which drive the dealer-only 4-step progress rail inside the Room.
 */
export const OPERATIONAL_STATUS_LABEL: Record<TransactionStage, string> = {
  견적: "확인 필요",
  시공예약: "일정 확정",
  입고: "작업 중",
  작업완료: "완료",
  출고: "완료",
  취소: "취소",
  시공불가: "시공불가",
};

/** Plate first; falls back to the VIN(차대번호)'s last 6 characters — enough
 * to tell duplicate same-model vehicles apart in a list row without
 * printing the full VIN. Returns undefined when neither is registered yet. */
export function vehicleIdentityLabel(warranty: WarrantyInfo): string | undefined {
  if (warranty.vehicleNumber) return warranty.vehicleNumber;
  if (warranty.vin) return `차대번호 ${warranty.vin.slice(-6)}`;
  return undefined;
}

export function transitionPayment(
  transaction: Transaction,
  next: PaymentStatus,
  role: TransactionActorRole,
  now = new Date().toISOString(),
): Transaction {
  const allowed: Record<PaymentStatus, Partial<Record<TransactionActorRole, PaymentStatus[]>>> = {
    미결제: { dealer: ["결제대기"], shop: ["결제대기"] },
    결제대기: { dealer: ["결제완료"], admin: ["결제완료"] },
    결제완료: { admin: ["정산대기"] },
    정산대기: { admin: ["정산완료"] },
    정산완료: {},
  };
  if (!allowed[transaction.pricing.paymentStatus][role]?.includes(next))
    throw new Error(`${role} cannot transition payment to ${next}.`);
  return {
    ...transaction,
    pricing: {
      ...transaction.pricing,
      paymentStatus: next,
      paymentAt: next === "결제완료" ? now : transaction.pricing.paymentAt,
    },
    status: { ...transaction.status, updatedAt: now },
  };
}
