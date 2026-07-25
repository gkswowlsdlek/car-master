import assert from "node:assert/strict";
import test from "node:test";
import { nextForwardStage, revertStage, transitionPayment, transitionStage } from "../services/transaction-state-service.ts";

function makeTransaction(stage = "견적") {
  return {
    id: "CM-TEST-0001",
    dealerId: "DEALER-001",
    installerId: "SHOP-001",
    installerName: "테스트 시공점",
    vehicle: { maker: "현대", model: "그랜저", class: "국산 승용" },
    service: { workDescription: "썬팅" },
    pricing: { paymentStatus: "미결제" },
    schedule: {},
    status: { stage, createdAt: "2026-07-17T00:00:00.000Z", updatedAt: "2026-07-17T00:00:00.000Z" },
    visibility: { hiddenByDealer: false, hiddenByInstaller: false },
    chatRoomId: "CHAT-001",
    lastMessage: "",
    stageLog: [],
  };
}

test("시공점은 거래 단계를 한 단계씩 순서대로 진행할 수 있다", () => {
  const updated = transitionStage(makeTransaction("견적"), "시공예약", "shop", "2026-07-17T01:00:00.000Z");
  assert.equal(updated.status.stage, "시공예약");
  assert.equal(updated.status.updatedAt, "2026-07-17T01:00:00.000Z");
  assert.equal(updated.stageLog.length, 1);
  assert.deepEqual(updated.stageLog[0], { id: updated.stageLog[0].id, fromStage: "견적", toStage: "시공예약", actorRole: "shop", direction: "forward", createdAt: "2026-07-17T01:00:00.000Z" });
});

test("딜러는 시공 진행 단계를 임의로 변경할 수 없다", () => {
  assert.throws(() => transitionStage(makeTransaction("견적"), "시공예약", "dealer"));
});

test("여러 단계를 한 번에 건너뛸 수 없다", () => {
  assert.throws(() => transitionStage(makeTransaction("견적"), "입고", "shop"));
  assert.throws(() => transitionStage(makeTransaction("견적"), "작업완료", "shop"));
});

test("바로 직전 단계로만 되돌릴 수 있다", () => {
  const reverted = transitionStage(makeTransaction("시공예약"), "견적", "shop", "2026-07-17T02:00:00.000Z");
  assert.equal(reverted.status.stage, "견적");
  assert.equal(reverted.stageLog[0].direction, "backward");
});

test("두 단계 이전으로는 되돌릴 수 없다", () => {
  assert.throws(() => transitionStage(makeTransaction("입고"), "견적", "shop"));
});

test("가장 첫 단계에서는 되돌릴 곳이 없고, 마지막 단계에는 다음 행동이 없다", () => {
  assert.equal(revertStage("견적"), undefined);
  assert.equal(nextForwardStage("작업완료"), undefined);
});

test("작업완료에 도달하면 완료 시각이 기록되고, 되돌리면 지워진다", () => {
  const completed = transitionStage(makeTransaction("입고"), "작업완료", "shop", "2026-07-17T05:00:00.000Z");
  assert.equal(completed.schedule.completedAt, "2026-07-17T05:00:00.000Z");
  const reverted = transitionStage(completed, "입고", "shop", "2026-07-17T06:00:00.000Z");
  assert.equal(reverted.status.stage, "입고");
  assert.equal(reverted.schedule.completedAt, undefined);
});

test("딜러 금액 확인 후 관리자 정산 완료까지 순차 전이한다", () => {
  const transaction = makeTransaction("견적");
  const waiting = transitionPayment(transaction, "결제대기", "dealer");
  const paid = transitionPayment(waiting, "결제완료", "admin");
  const settling = transitionPayment(paid, "정산대기", "admin");
  const settled = transitionPayment(settling, "정산완료", "admin");
  assert.equal(settled.pricing.paymentStatus, "정산완료");
});
