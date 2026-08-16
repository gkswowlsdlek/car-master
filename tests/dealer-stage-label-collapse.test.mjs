import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const normalize = (source) => source.replace(/\r\n?/g, "\n");

// Phase 2 §0 sanity fix — the Dealer-facing product spec is exactly 4 stages
// (입고 전/작업 중/작업 완료/출고). Internal DB stage keys stay the granular
// 5-stage model; this only changes what text a dealer actually reads.

test("dealerStageLabel collapses 견적/시공예약 into 입고 전, and maps 입고/작업완료/출고 one-to-one", async () => {
  const { dealerStageLabel, dealerStageIndex } = await import("../services/transaction-state-service.ts");
  assert.equal(dealerStageLabel("견적"), "입고 전");
  assert.equal(dealerStageLabel("시공예약"), "입고 전");
  assert.equal(dealerStageLabel("입고"), "작업 중");
  assert.equal(dealerStageLabel("작업완료"), "작업 완료");
  assert.equal(dealerStageLabel("출고"), "출고");
  assert.equal(dealerStageLabel("취소"), "취소");
  assert.equal(dealerStageIndex("견적"), dealerStageIndex("시공예약"));
});

test("DealerDashboard's deal-card status chip shows dealerStageLabel, not the raw DB stage", async () => {
  const source = normalize(await read("components/dealer/DealerDashboard.tsx"));
  assert.match(source, /<em className=\{`status-chip status-\$\{deal\.status\.stage\}`\}>\{dealerStageLabel\(deal\.status\.stage\)\}<\/em>/);
});

test("TransactionChatWorkspace shows the collapsed dealer label only for role === dealer, and leaves the shop/installer view showing the real granular stage", async () => {
  const source = normalize(await read("components/transactions/TransactionChatWorkspace.tsx"));
  assert.match(source, /<b>\{role === "dealer" \? dealerStageLabel\(transaction\.status\.stage\) : transaction\.status\.stage\}<\/b>/);
  assert.match(source, /role === "dealer"\s*\?\s*DEALER_STAGE_LABELS\.map/);
});

test("TransactionManagementScreen's status chip, progress list, and list-row label all respect role === dealer for the collapsed view", async () => {
  const source = normalize(await read("components/transactions/TransactionManagementScreen.tsx"));
  assert.match(source, /role === "dealer" \? dealerStageLabel\(item\.status\.stage\) : item\.status\.stage/);
  assert.match(source, /role === "dealer" \? dealerStageLabel\(selected\.status\.stage\) : selected\.status\.stage/);
  assert.match(source, /role === "dealer"\s*\?\s*DEALER_STAGE_LABELS\.map/);
});
