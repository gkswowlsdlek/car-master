import test from "node:test";
import assert from "node:assert/strict";

function calculateSettlement(gross, platformRate, pgRate) {
  const platformFee = Math.round(gross * platformRate / 100);
  const pgFee = Math.round(gross * pgRate / 100);
  return { platformFee, pgFee, net: Math.max(0, gross - platformFee - pgFee) };
}

test("60만원 거래에 플랫폼 3%와 PG 2.9%를 각각 차감한다", () => {
  assert.deepEqual(calculateSettlement(600000, 3, 2.9), {
    platformFee: 18000,
    pgFee: 17400,
    net: 564600,
  });
});

test("수수료는 원 단위 반올림한다", () => {
  assert.equal(calculateSettlement(101, 3, 2.9).platformFee, 3);
  assert.equal(calculateSettlement(101, 3, 2.9).pgFee, 3);
});
