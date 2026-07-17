import assert from "node:assert/strict";
import test from "node:test";
import { transitionPayment, transitionStage } from "../services/transaction-state-service.ts";

const transaction = {
  id: "CM-TEST-0001",
  dealerId: "DEALER-001",
  installerId: "SHOP-001",
  installerName: "테스트 시공점",
  vehicle: { maker: "현대", model: "그랜저", class: "국산 승용" },
  service: { workDescription: "썬팅" },
  pricing: { paymentStatus: "미결제" },
  schedule: {},
  status: { stage: "접수", createdAt: "2026-07-17T00:00:00.000Z", updatedAt: "2026-07-17T00:00:00.000Z" },
  visibility: { hiddenByDealer: false, hiddenByInstaller: false },
  chatRoomId: "CHAT-001",
  lastMessage: "",
};

test("시공점은 거래 단계를 순서대로 진행할 수 있다", () => {
  const updated = transitionStage(transaction, "입고예정", "shop", "2026-07-17T01:00:00.000Z");
  assert.equal(updated.status.stage, "입고예정");
  assert.equal(updated.status.updatedAt, "2026-07-17T01:00:00.000Z");
});

test("딜러는 시공 진행 단계를 임의로 변경할 수 없다", () => {
  assert.throws(() => transitionStage(transaction, "입고예정", "dealer"));
});

test("딜러 금액 확인 후 관리자 정산 완료까지 순차 전이한다", () => {
  const waiting = transitionPayment(transaction, "결제대기", "dealer");
  const paid = transitionPayment(waiting, "결제완료", "admin");
  const settling = transitionPayment(paid, "정산대기", "admin");
  const settled = transitionPayment(settling, "정산완료", "admin");
  assert.equal(settled.pricing.paymentStatus, "정산완료");
});
