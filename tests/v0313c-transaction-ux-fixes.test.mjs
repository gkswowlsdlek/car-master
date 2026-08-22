import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Dealer Dashboard quick-action filters actually reach the 거래 관리 screen instead of being dropped on the floor", async () => {
  const workspace = await read("components/workspaces/DealerWorkspace.tsx");
  assert.match(
    workspace,
    /onFilterDeals=\{\(filter\)\s*=>\s*\{\s*setDealFilter\(filter\);\s*onNavigate\("deals"\);\s*\}\}/,
  );
  assert.match(workspace, /screen === "deals"[\s\S]*?initialGroupFilter=\{dealFilter\}/);
  assert.doesNotMatch(workspace, /onOpenDeal/);
  const dashboard = await read("components/dealer/DealerDashboard.tsx");
  assert.doesNotMatch(dashboard, /onOpenDeal/);
});

// Production-Safe UI Backport replaced the 4 colored stage-count cards
// (오늘 입고 예정/확인 대기/진행 중/최근 완료) with a single "진행 중인 거래"
// list of actual transactions — there's no longer a standalone count that
// could drift from what clicking it filters to, since each row IS the
// transaction it links to. This test now guards the thing that replaced it:
// the list's membership rule (ACTIVE_STAGES) is the one place that decides
// both what's shown and what "진행 중" means, so display and click-through
// can't diverge.
test("Dealer Dashboard's 진행 중인 거래 list and its click-through both key off the same ACTIVE_STAGES definition — no separate, potentially-drifting count", async () => {
  const dashboard = await read("components/dealer/DealerDashboard.tsx");
  assert.match(dashboard, /const ACTIVE_STAGES: TransactionStage\[\] = \["시공예약", "입고", "작업완료"\];/);
  assert.match(dashboard, /ACTIVE_STAGES\.includes\(deal\.status\.stage\)/);
  assert.match(dashboard, /onClick=\{\(\) => onOpenTransaction\(deal\.id\)\}/);
});

test("TransactionManagementScreen exposes a 거래 숨기기 action (not just 숨김 해제), wired through the same onHide the Messenger already uses", async () => {
  const source = await read("components/transactions/TransactionManagementScreen.tsx");
  assert.match(source, /onHide: \(id: string, role: "dealer" \| "shop"\) => void;/);
  assert.match(source, /거래 숨기기/);
  assert.match(source, /onHide\(selected\.id, role\)/);
});

test("Admin transaction list shows 담당 딜러 (dealer name, not the raw uuid) and 시공점 (installerName) as two distinct fields, not installerName mislabeled as 담당 딜러", async () => {
  const source = await read("components/admin/AdminTransactionPanel.tsx");
  assert.match(
    source,
    /담당 딜러\s*<small>\{\[item\.dealerName, item\.dealerCompanyName\]\.filter\(Boolean\)\.join\(" · "\) \|\| "미확인"\}<\/small>/,
  );
  assert.match(source, /시공점<small>\{item\.installerName\}<\/small>/);
});
