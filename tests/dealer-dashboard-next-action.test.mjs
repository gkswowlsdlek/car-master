import assert from "node:assert/strict";
import test from "node:test";
import { dealerDashboardNextAction } from "../services/transaction-state-service.ts";

function deal(stage, contactStatus) {
  return { status: { stage }, contactStatus };
}

test("전화 확인 전(견적)에는 딜러가 전화 확인을 해야 한다", () => {
  assert.deepEqual(dealerDashboardNextAction(deal("견적", undefined)), {
    label: "시공점에 전화 확인",
    actor: "dealer",
  });
});

test("전화 확인 전(시공예약)에도 딜러가 전화 확인을 해야 한다", () => {
  assert.deepEqual(dealerDashboardNextAction(deal("시공예약", undefined)), {
    label: "시공점에 전화 확인",
    actor: "dealer",
  });
});

test("견적 단계에서 전화 확인이 끝났으면 시공점 응답을 기다린다", () => {
  assert.deepEqual(dealerDashboardNextAction(deal("견적", "contacted")), {
    label: "시공점 응답 대기",
    actor: "counterpart",
  });
});

test("시공예약 단계에서 전화 확인이 끝났으면 딜러가 입고를 확정해야 한다", () => {
  assert.deepEqual(dealerDashboardNextAction(deal("시공예약", "contacted")), {
    label: "입고 확정하기",
    actor: "dealer",
  });
});

test("연락 불가(unreachable)는 이후 단계 판정으로 넘어간다 — 전화 확인에 계속 머무르지 않는다", () => {
  assert.deepEqual(dealerDashboardNextAction(deal("시공예약", "unreachable")), {
    label: "입고 확정하기",
    actor: "dealer",
  });
});

test("입고 단계는 전화 확인 여부와 무관하게 시공점 작업 완료를 기다린다", () => {
  assert.deepEqual(dealerDashboardNextAction(deal("입고", undefined)), {
    label: "시공점 작업 완료 대기",
    actor: "counterpart",
  });
});

test("작업완료 단계는 딜러가 출고 처리를 해야 한다", () => {
  assert.deepEqual(dealerDashboardNextAction(deal("작업완료", "contacted")), {
    label: "출고 처리하기",
    actor: "dealer",
  });
});

test("출고 단계는 더 이상 할 일이 없다", () => {
  assert.deepEqual(dealerDashboardNextAction(deal("출고", "contacted")), {
    label: "처리 완료",
    actor: "counterpart",
  });
});

test("취소/시공불가는 종료된 거래로 처리 완료를 보여준다", () => {
  assert.deepEqual(dealerDashboardNextAction(deal("취소", undefined)), {
    label: "처리 완료",
    actor: "counterpart",
  });
  assert.deepEqual(dealerDashboardNextAction(deal("시공불가", undefined)), {
    label: "처리 완료",
    actor: "counterpart",
  });
});
