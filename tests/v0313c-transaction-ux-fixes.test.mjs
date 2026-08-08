import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Dealer Dashboard quick-action filters actually reach the 거래 관리 screen instead of being dropped on the floor", async () => {
  const page = await read("app/page.tsx");
  assert.match(page, /onFilterDeals=\{\(filter\) => \{ setDealFilter\(filter\); goToScreen\("deals"\); \}\}/);
  assert.match(page, /role === "dealer" && screen === "deals"[\s\S]*?initialStageFilter=\{dealFilter\}/);
  assert.doesNotMatch(page, /onOpenDeal/);
  const dashboard = await read("components/dealer/DealerDashboard.tsx");
  assert.doesNotMatch(dashboard, /onOpenDeal/);
});

test("오늘 입고 예정 card count matches what clicking it actually filters to (시공예약 stage only)", async () => {
  const dashboard = await read("components/dealer/DealerDashboard.tsx");
  assert.match(dashboard, /deal\.status\.stage === "시공예약" && isToday\(deal\.schedule\.confirmedInboundAt \?\? deal\.schedule\.requestedInboundAt\)/);
});

test("TransactionManagementScreen exposes a 거래 숨기기 action (not just 숨김 해제), wired through the same onHide the Messenger already uses", async () => {
  const source = await read("components/transactions/TransactionManagementScreen.tsx");
  assert.match(source, /onHide: \(id: string, role: "dealer" \| "shop"\) => void;/);
  assert.match(source, /거래 숨기기/);
  assert.match(source, /onHide\(selected\.id, role\)/);
});

test("Admin transaction list shows 담당 딜러 (dealerId) and 시공점 (installerName) as two distinct fields, not installerName mislabeled as 담당 딜러", async () => {
  const source = await read("components/admin/AdminTransactionPanel.tsx");
  assert.match(source, /담당 딜러<small>\{item\.dealerId\}<\/small>/);
  assert.match(source, /시공점<small>\{item\.installerName\}<\/small>/);
});
