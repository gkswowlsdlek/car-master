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

test("세분 상태 드롭다운은 제거됐고(탭과 축 중복 — redesign/transaction-list), raw DB stage key (견적/시공예약/입고)는 여전히 어떤 라벨에도 노출되지 않는다", () => {
  // 원래 이 테스트의 의도는 "드롭다운 텍스트에 raw key 금지"였다. 드롭다운
  // 자체가 제거된 뒤에도 의도의 핵심(사용자에게 raw key를 보이지 않는다)은
  // 그대로 검증하고, 드롭다운이 조용히 되살아나지 않는 것도 함께 잡는다.
  assert.doesNotMatch(screenSource, /STATUS_FILTER_OPTIONS|<select/);
  assert.doesNotMatch(screenSource, />견적</);
  assert.doesNotMatch(screenSource, />시공예약</);
  // 상태 칩 색은 raw key가 아니라 딜러 4단계 기준으로 골라야 한다 — 견적과
  // 시공예약이 같은 "입고 전"인데 다른 색이 나오던 문제의 회귀 방지.
  assert.match(screenSource, /function stageChipClass\(stage: TransactionStage\)/);
  assert.match(screenSource, /\$\{stageChipClass\(item\.status\.stage\)\}/);
});

test("차량/시공점 검색 matches maker, model and installerName only — never another dealer's data, since it filters the already dealer-scoped transactions prop", () => {
  assert.match(screenSource, /\$\{item\.vehicle\.maker\} \$\{item\.vehicle\.model\} \$\{item\.installerName\}/);
});

test("최근 활동 sort uses transactions.updated_at (server-touched on every stage/price/outcome change and chat message) — no new activity-aggregation system", () => {
  assert.match(screenSource, /\.sort\(\(a, b\) => b\.status\.updatedAt\.localeCompare\(a\.status\.updatedAt\)\)/);
  assert.match(screenSource, /set_transaction_room_updated_at trigger/);
});

// 거래관리 재구조화(2026-08) — 목록 행 클릭은 이제 같은 화면 안의 읽기 전용
// 상세 요약을 선택할 뿐이고, 실제 Room으로의 이동은 상세 하단 "거래방으로
// 이동" CTA가 담당한다(onOpenTransaction 호출은 그 버튼 하나뿐). 상세 요약은
// 여전히 순수 표시 전용 — 단계/가격/보증서 발급 같은 액션 컨트롤은 그대로
// TransactionChatWorkspace(Room)에만 있다.
test("row click selects a transaction for the inline read-only detail summary — actually leaving for the Room only happens via the detail's 거래방으로 이동 CTA (onOpenTransaction), and the detail itself has no stage/price/outcome controls", () => {
  assert.match(screenSource, /onClick=\{\(\) => setSelectedId\(item\.id\)\}/);
  assert.match(screenSource, /onClick=\{\(\) => onOpenTransaction\(selected\.id\)\}/);
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
  assert.match(screenSource, /onClick=\{onFindShop\}>\s*시공점 찾기\s*</);
  assert.match(screenSource, /검색 결과가 없습니다\./);
});

test("list rows keep the established transaction-card- E2E testid convention", () => {
  assert.match(screenSource, /data-testid=\{`transaction-card-\$\{item\.id\}`\}/);
});

test("DealerWorkspace wires the new screen for role dealer's 거래관리 tab, and Dashboard's own open-transaction action now hands off straight to the Room (messages), not a detail pane", () => {
  assert.match(
    workspaceSource,
    /import \{ DealerTransactionManagementScreen \} from "\.\.\/transactions\/DealerTransactionManagementScreen";/,
  );
  assert.doesNotMatch(workspaceSource, /\{ TransactionManagementScreen \}/);
  assert.doesNotMatch(workspaceSource, /<TransactionManagementScreen /);
  assert.match(
    workspaceSource,
    // installers는 "지금 할 일: 전화 확인"에서 시공점 번호를 바로 걸 수 있게
    // 추가된 선택 prop — 이 테스트가 지키려는 건 화면 연결과 Room 핸드오프이지
    // prop 목록 고정이 아니므로, 사이에 추가 prop이 오는 것을 허용한다.
    /screen === "deals"\s*&&\s*(?:\(\s*)?<DealerTransactionManagementScreen\s+transactions=\{transactions\}[\s\S]*?initialGroupFilter=\{dealFilter\}\s+onOpenTransaction=\{\(id\)\s*=>\s*\{\s*setSelectedTransactionId\(id\);\s*onNavigate\("messages"\);\s*\}\}\s+onNewRequest=\{\(\)\s*=>\s*onNavigate\("request"\)\}\s+onFindShop=\{\(\)\s*=>\s*onNavigate\("dealerMap"\)\}\s*\/>/,
  );
  assert.match(
    workspaceSource,
    /<DealerDashboard[\s\S]*?onOpenTransaction=\{\(id\)\s*=>\s*\{\s*setSelectedTransactionId\(id\);\s*onNavigate\("messages"\);\s*\}\}/,
  );
});

test("InstallerWorkspace (shop role) is untouched — TransactionManagementScreen keeps serving the Shop's own transaction management unchanged", async () => {
  const installerSource = normalize(await read("components/workspaces/InstallerWorkspace.tsx"));
  assert.match(installerSource, /<TransactionManagementScreen\s+role="shop"/);
});
