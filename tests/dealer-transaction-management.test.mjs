import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const normalize = (source) => source.replace(/\r\n?/g, "\n");

let screenSource;
let workspaceSource;

test.before(async () => {
  screenSource = normalize(await read("components/transactions/DealerTransactionManagementScreen.tsx"));
  workspaceSource = normalize(await read("components/workspaces/DealerWorkspace.tsx"));
});

// Phase 6 — Dealer 거래관리: a browse-and-find surface over the existing
// Phase 1~5 Transaction data. No new table, no new RPC, no Transaction
// Lifecycle redesign — purely a client-side grouping/search/filter/sort
// layer on top of the already-RLS-scoped transactions the app already
// fetches.

test("no new transaction-management DB structure — the screen only consumes the transactions prop it's given, no direct Supabase/RPC calls of its own", () => {
  assert.doesNotMatch(screenSource, /createSupabaseBrowserClient|\.rpc\(|\.from\(/);
});

test("groups collapse stage into exactly 진행중 (입고 전/작업 중/작업 완료) / 완료 (출고) / 종료 (취소/시공불가), matching the Phase 5 outcome model", () => {
  assert.match(screenSource, /function groupOf\(stage: TransactionStage\): Exclude<Group, "전체"> \{/);
  assert.match(screenSource, /if \(isTerminalOutcome\(stage\)\) return "종료";/);
  assert.match(screenSource, /if \(stage === "출고"\) return "완료";/);
  assert.match(screenSource, /return "진행중";/);
});

test("Dashboard's raw internal stage deep-link (e.g. 견적 for 확인 대기) is collapsed into a group, never exposed to the dealer as a DB key", () => {
  assert.match(screenSource, /function groupFromStage\(stage: TransactionStage \| "전체"\): Group \{/);
  assert.doesNotMatch(screenSource, /<option[^>]*>\{stage\}<\/option>/);
});

test("작업 상태 filter shows only dealer-facing labels (입고 전/작업 중/작업 완료/출고/취소/시공 불가) — no raw DB stage key (견적/시공예약/입고) reaches the dropdown text", () => {
  assert.match(screenSource, /const STATUS_FILTER_OPTIONS = \["전체", "입고 전", "작업 중", "작업 완료", "출고", "취소", "시공 불가"\] as const;/);
  assert.doesNotMatch(screenSource, />견적</);
  assert.doesNotMatch(screenSource, />시공예약</);
});

test("차량/시공점 검색 matches maker, model and installerName only — never another dealer's data, since it filters the already dealer-scoped transactions prop", () => {
  assert.match(screenSource, /\$\{item\.vehicle\.maker\} \$\{item\.vehicle\.model\} \$\{item\.installerName\}/);
});

test("최근 활동 sort uses transactions.updated_at (server-touched on every stage/price/outcome change and chat message) — no new activity-aggregation system", () => {
  assert.match(screenSource, /\.sort\(\(a, b\) => b\.status\.updatedAt\.localeCompare\(a\.status\.updatedAt\)\)/);
  assert.match(screenSource, /set_transaction_room_updated_at trigger/);
});

test("row click hands off directly to the existing Room via onOpenTransaction — no inline detail pane, no stage/price/outcome controls duplicated in the list", () => {
  assert.match(screenSource, /onClick=\{\(\) => onOpenTransaction\(item\.id\)\}/);
  assert.doesNotMatch(screenSource, /onStageChange|onFinalPriceChange|onEndOutcome|onPaymentChange/);
  assert.doesNotMatch(screenSource, /<TransactionChatWorkspace/);
});

test("terminated (취소/시공불가) transactions stay visible with no forward stage-advance affordance in the list — only the existing status chip and outcome label", () => {
  assert.match(screenSource, /isTerminalOutcome\(item\.status\.stage\)/);
  assert.doesNotMatch(screenSource, /STAGE_ACTION_LABEL|nextForwardStage/);
});

test("전화 확인 필요 badge reuses the exact same trigger condition (견적/시공예약) as the existing phone-confirm-banner in the Room — not a new policy", async () => {
  const roomSource = normalize(await read("components/transactions/TransactionChatWorkspace.tsx"));
  assert.match(screenSource, /item\.status\.stage === "견적" \|\| item\.status\.stage === "시공예약"/);
  assert.match(roomSource, /transaction\.status\.stage === "견적" \|\| transaction\.status\.stage === "시공예약"/);
});

test("최종 시공금액 is shown read-only in the list when present — no input/save control (editing stays in the Room)", () => {
  assert.doesNotMatch(screenSource, /finalPriceDraft|onFinalPriceChange/);
  assert.match(screenSource, /pricing\.finalPrice/);
});

test("hidden-by-dealer transactions are excluded from both counts and the list — hide/unhide itself is not a control on this screen (stays in the Room)", () => {
  assert.match(screenSource, /transactions\.filter\(\(item\) => !item\.visibility\.hiddenByDealer\)/);
  assert.doesNotMatch(screenSource, /onHide|onUnhide/);
});

test("empty states are distinct for zero-transactions (with a 시공점 찾기 CTA into the existing Shop Search flow), empty search, and empty group — no ERP-style bare table", () => {
  assert.match(screenSource, /아직 진행 중인 거래가 없습니다\./);
  assert.match(screenSource, /onClick=\{onFindShop\}>시공점 찾기</);
  assert.match(screenSource, /검색 결과가 없습니다\./);
});

test("list rows keep the established transaction-card- E2E testid convention", () => {
  assert.match(screenSource, /data-testid=\{`transaction-card-\$\{item\.id\}`\}/);
});

test("DealerWorkspace wires the new screen for role dealer's 거래관리 tab, and Dashboard's own open-transaction action now hands off straight to the Room (messages), not a detail pane", () => {
  assert.match(workspaceSource, /import \{ DealerTransactionManagementScreen \} from "\.\.\/transactions\/DealerTransactionManagementScreen";/);
  assert.doesNotMatch(workspaceSource, /\{ TransactionManagementScreen \}/);
  assert.doesNotMatch(workspaceSource, /<TransactionManagementScreen /);
  assert.match(workspaceSource, /screen === "deals" && <DealerTransactionManagementScreen transactions=\{transactions\} initialGroupFilter=\{dealFilter\} onOpenTransaction=\{\(id\) => \{ setSelectedTransactionId\(id\); onNavigate\("messages"\); \}\} onNewRequest=\{\(\) => onNavigate\("request"\)\} onFindShop=\{\(\) => onNavigate\("dealerMap"\)\} \/>\}/);
  assert.match(workspaceSource, /<DealerDashboard[\s\S]*?onOpenTransaction=\{\(id\) => \{ setSelectedTransactionId\(id\); onNavigate\("messages"\); \}\}/);
});

test("InstallerWorkspace (shop role) is untouched — TransactionManagementScreen keeps serving the Shop's own transaction management unchanged", async () => {
  const installerSource = normalize(await read("components/workspaces/InstallerWorkspace.tsx"));
  assert.match(installerSource, /<TransactionManagementScreen role="shop"/);
});
