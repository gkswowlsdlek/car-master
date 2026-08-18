import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const normalize = (source) => source.replace(/\r\n?/g, "\n");

let queueSource;
let overviewSource;
let shopManagementSource;
let transactionPanelSource;
let installerApprovalSource;
let memberPanelSource;
let adminLabelsSource;
let shopClaimRepoSource;
let adminShopRepoSource;
let transactionRepoSource;
let membershipRepoSource;
let appShellSource;
let dealerTypesSource;
let adminWorkspaceSource;
let pageSource;

test.before(async () => {
  queueSource = normalize(await read("components/admin/AdminOpsQueue.tsx"));
  overviewSource = normalize(await read("components/admin/AdminOverview.tsx"));
  shopManagementSource = normalize(await read("components/admin/AdminShopManagementScreen.tsx"));
  transactionPanelSource = normalize(await read("components/admin/AdminTransactionPanel.tsx"));
  installerApprovalSource = normalize(await read("components/admin/InstallerApprovalPanel.tsx"));
  memberPanelSource = normalize(await read("components/admin/AdminMemberPanel.tsx"));
  adminLabelsSource = normalize(await read("services/admin-labels.ts"));
  shopClaimRepoSource = normalize(await read("repositories/shop-claim-repository.ts"));
  adminShopRepoSource = normalize(await read("repositories/admin-shop-repository.ts"));
  transactionRepoSource = normalize(await read("repositories/supabase-transaction-repository.ts"));
  membershipRepoSource = normalize(await read("repositories/membership-repository.ts"));
  appShellSource = normalize(await read("components/layout/AppShell.tsx"));
  dealerTypesSource = normalize(await read("types/dealer.ts"));
  adminWorkspaceSource = normalize(await read("components/workspaces/AdminWorkspace.tsx"));
  pageSource = normalize(await read("app/page.tsx"));
});

// Phase 7 — Admin 운영센터 보강. This is an assembly/reorg phase: no new
// Marketplace feature, no new migration. Every new query either reuses an
// existing RPC (review_shop_claim) or relies on RLS the backend already
// grants to is_admin() sessions (installer_shops, shop_claim_requests).

test("Phase 7 itself added no migration — every new admin query reuses existing RLS/RPCs (checked against the migration file introduced by that phase's own work, not a moving snapshot of the whole directory)", async () => {
  const migrationsDir = new URL("../supabase/migrations/", import.meta.url);
  const { readdir } = await import("node:fs/promises");
  const files = await readdir(migrationsDir);
  assert.ok(
    files.includes("202608130004_transaction_lifecycle_completion.sql"),
    "Phase 5's migration must still exist",
  );
  assert.ok(
    !files.some((name) => name.includes("admin_ops") || name.includes("admin_queue")),
    "Phase 7 must not have introduced its own migration file",
  );
});

test("AdminOpsQueue never computes vanity metrics — only counts of actually-actionable states, and hides a card entirely at zero instead of rendering an empty card", () => {
  assert.doesNotMatch(queueSource, /전체 거래|총 회원|누적|GMV|성장률/);
  assert.match(queueSource, /\.filter\(\(card\) => card\.count > 0\)/);
});

test("AdminOpsQueue counts reuse existing state fields only (shop_search_requests.status, installer_approvals.status, shop_claim_requests.status, transactions.stage) — no new aggregation table", () => {
  assert.match(queueSource, /shopSearchRequestRepository\.getAllForAdmin\(\)/);
  assert.match(
    queueSource,
    /\.from\("installer_approvals"\)\.select\("\*", \{ count: "exact", head: true \}\)\.eq\("status", "pending"\)/,
  );
  assert.match(
    queueSource,
    /\.from\("shop_claim_requests"\)\.select\("\*", \{ count: "exact", head: true \}\)\.eq\("status", "pending"\)/,
  );
  assert.match(queueSource, /item\.status\.stage === "취소" \|\| item\.status\.stage === "시공불가"/);
});

test("AdminOverview no longer renders a weekly volume chart or vanity stat cards — replaced by the Ops Queue as the first thing Admin sees", () => {
  assert.doesNotMatch(
    overviewSource,
    /function weeklyVolume|admin-chart-card|admin-summary-grid|admin-alert-strip|stats\.map/,
  );
  assert.match(overviewSource, /<AdminOpsQueue/);
});

test("AdminOverview panel order puts the operational queue and open Shop Search Requests before the passive Transaction/Member browse panels", () => {
  const queueIndex = overviewSource.indexOf("<AdminOpsQueue");
  const requestIndex = overviewSource.indexOf("<AdminShopSearchRequestPanel");
  const transactionIndex = overviewSource.indexOf("<AdminTransactionPanel");
  const memberIndex = overviewSource.indexOf("<AdminMemberPanel");
  assert.ok(queueIndex < requestIndex && requestIndex < transactionIndex && transactionIndex < memberIndex);
});

test("clicking the 취소·시공불가 Queue card drives AdminTransactionPanel's group filter (lifted/controlled state), not just a scroll — so the filtered view is actually applied, not merely visible", () => {
  assert.match(overviewSource, /setTransactionGroup\("종료"\)/);
  assert.match(
    overviewSource,
    /<AdminTransactionPanel\s+transactions=\{transactions\}\s+rooms=\{rooms\}\s+group=\{transactionGroup\}\s+onGroupChange=\{setTransactionGroup\}/,
  );
});

test("get_admin_shop_search_requests already orders open requests (requested/in_progress/shop_proposed) oldest-first before closed ones — Phase 7 confirms this instead of re-implementing sort client-side", async () => {
  const migration = normalize(await read("supabase/migrations/202608130003_shop_search_proposal_foundation.sql"));
  assert.match(
    migration,
    /\(r\.status in \('requested', 'in_progress', 'shop_proposed'\)\) desc,\s*\n\s*r\.created_at asc/,
  );
});

test("AdminTransactionPanel supports 시공불가 in the stage filter (it was missing even though the underlying data already carries that outcome) and shows 최종 시공금액/종료 사유 when present", () => {
  assert.match(transactionPanelSource, /\[\.\.\.stageOrder, "취소" as const, "시공불가" as const\]/);
  assert.match(
    transactionPanelSource,
    /selected\.pricing\.finalPrice != null\s*&&\s*(?:\(\s*)?<div>\s*<dt>최종 시공금액<\/dt>/,
  );
  assert.match(transactionPanelSource, /selected\.outcomeNote\s*&&\s*(?:\(\s*)?<div>\s*<dt>종료 사유<\/dt>/);
});

test("AdminTransactionPanel groups 진행중/완료/종료 the same way as Dealer's Phase 6 groupOf — isTerminalOutcome for 종료, 출고 for 완료, everything else 진행중", () => {
  assert.match(
    transactionPanelSource,
    /import \{ isTerminalOutcome, stageLogLabel, stageOrder \} from "\.\.\/\.\.\/services\/transaction-state-service";/,
  );
  assert.match(
    transactionPanelSource,
    /export function groupOf\(stage: TransactionStage\): Exclude<TransactionGroup, "전체"> \{/,
  );
});

test("InstallerApprovalPanel no longer leaks the raw pending/approved/rejected/suspended enum into the UI — uses the shared label map like AdminMemberPanel already did", () => {
  assert.doesNotMatch(installerApprovalSource, />\{item\.status\}<|>\{selected\.status\}</);
  assert.match(installerApprovalSource, /INSTALLER_APPROVAL_STATUS_LABEL\[item\.status\]/);
  assert.match(installerApprovalSource, /INSTALLER_APPROVAL_STATUS_LABEL\[selected\.status\]/);
});

test("AdminMemberPanel and InstallerApprovalPanel now import the same shared label map instead of each keeping (or not keeping) its own copy", () => {
  assert.match(
    memberPanelSource,
    /import \{ INSTALLER_APPROVAL_STATUS_LABEL \} from "\.\.\/\.\.\/services\/admin-labels";/,
  );
  assert.match(
    installerApprovalSource,
    /import \{ INSTALLER_APPROVAL_STATUS_LABEL \} from "\.\.\/\.\.\/services\/admin-labels";/,
  );
});

test("admin-labels.ts keeps Shop exposure (approval_status) and Shop ownership (claimed/unclaimed) as two distinct label maps — never conflated, matching Phase 7 §10's explicit terminology requirement", () => {
  assert.match(adminLabelsSource, /export const SHOP_EXPOSURE_STATUS_LABEL/);
  assert.match(
    adminLabelsSource,
    /export const SHOP_OWNERSHIP_STATUS_LABEL: Record<"unclaimed" \| "claimed", string> = \{/,
  );
  assert.match(adminLabelsSource, /unclaimed:\s*"미가입 업체",\s*claimed:\s*"운영자 연결됨"/);
});

test("shop-claim-repository reuses the existing admin-gated review_shop_claim RPC for the mutation, and relies on shop_claim_requests' existing is_admin() SELECT policy for listing — no new RPC, no new table", () => {
  assert.match(shopClaimRepoSource, /\.rpc\("review_shop_claim", \{/);
  assert.doesNotMatch(shopClaimRepoSource, /\.rpc\("(?!review_shop_claim)/);
  assert.match(shopClaimRepoSource, /is_admin\(\)/);
});

test("shop-claim-repository's admin listing is capped (.limit) and sorts pending first — a new admin list gets a bound from the start, matching Phase 7 §14's pagination-safety requirement", () => {
  assert.match(shopClaimRepoSource, /\.limit\(200\)/);
  assert.match(shopClaimRepoSource, /rank\(a\.status\) - rank\(b\.status\)/);
});

test("admin-shop-repository.listAll is a direct RLS-scoped query (not a new RPC/migration) and is capped, unlike admin_search_shops it is NOT restricted to approval_status='approved' since a real management view must show pending/rejected/suspended shops too", () => {
  assert.match(adminShopRepoSource, /async listAll\(query = "", limit = 200\): Promise<AdminShopListItem\[\]> \{/);
  assert.match(adminShopRepoSource, /\.from\("installer_shops"\)/);
  assert.doesNotMatch(adminShopRepoSource, /listAll[\s\S]*?approval_status.*=.*'approved'/);
  assert.match(adminShopRepoSource, /\.limit\(limit\)/);
});

test("pagination safety: the two highest-volume unbounded queries the Phase 7 research flagged (admin transaction list, admin membership lists) now carry an explicit cap", () => {
  assert.match(transactionRepoSource, /\.order\("updated_at", \{ ascending: false \}\)\s*\n\s*\.limit\(500\);/);
  assert.match(membershipRepoSource, /installer_approvals!inner\(status,review_note\)"\s*,?\s*\)\s*\.limit\(300\);/);
  assert.match(
    membershipRepoSource,
    /dealer_profiles"\s*\)\s*\.select\s*\(\s*"user_id,name,phone,company_name,profiles!inner\(email,created_at\)"\s*,?\s*\)\s*\.limit\(300\)/,
  );
});

test("new 시공점 관리 nav item added without touching Dealer/Shop navigation or removing the existing 운영 현황/계정 items", () => {
  // 항목 3개가 이 순서로 남아 있는지만 본다. 각 항목 뒤에 붙는 속성(group 등)은
  // 사이드바 표시용이라 허용한다 — 원래 검증 의도는 "운영 현황/계정이 사라지지
  // 않고 시공점 관리가 그 사이에 추가됐는가"이지 객체 리터럴의 정확한 형태가 아니다.
  assert.match(
    appShellSource,
    /\{ screen: "ops", label: "운영 현황", icon: UsersRound[^}]*\},\s*\n\s*\{ screen: "adminShops", label: "시공점 관리", icon: Building2[^}]*\},\s*\n\s*\{ screen: "adminAccount", label: "계정", icon: UserRound[^}]*\},/,
  );
  assert.match(dealerTypesSource, /"ops"\s*\|\s*"adminShops"\s*\|\s*"adminAccount"/);
});

test("AdminWorkspace wires the new adminShops screen and threads onNavigate through so the Ops Queue's Shop Claim card can actually navigate there (not just scroll)", () => {
  assert.match(adminWorkspaceSource, /onNavigate: \(screen: Screen\) => void;/);
  assert.match(adminWorkspaceSource, /\{screen === "adminShops"\s*&&\s*(?:\(\s*)?<AdminShopManagementScreen\s*\/>/);
  assert.match(adminWorkspaceSource, /onOpenShopManagement=\{\(\) => onNavigate\("adminShops"\)\}/);
  assert.match(
    pageSource,
    /<AdminWorkspace\s+account=\{account\}\s+screen=\{screen\}\s+transactions=\{transactions\}\s+rooms=\{rooms\}\s+onNavigate=\{goToScreen\}/,
  );
});

test("AdminShopManagementScreen shows both Shop exposure status and ownership status as clearly separate fields (never one label standing in for both)", () => {
  assert.match(
    shopManagementSource,
    /<dt>업체 노출 상태<\/dt>\s*<dd>\{SHOP_EXPOSURE_STATUS_LABEL\[selectedShop\.approvalStatus\]\}<\/dd>/,
  );
  assert.match(
    shopManagementSource,
    /<dt>업체 연결 상태<\/dt>\s*<dd>\{SHOP_OWNERSHIP_STATUS_LABEL\[selectedShop\.ownershipStatus\]\}<\/dd>/,
  );
});

test("Shop Claim approve/reject buttons only render for a pending claim — no action offered on an already-decided claim", () => {
  assert.match(
    shopManagementSource,
    /selectedClaim\.status === "pending"\s*&&\s*(?:\(\s*)?<div className="approval-actions">/,
  );
});

test("Shop Claim reject asks for confirmation before calling the RPC (same guard pattern as 연결 어려움/시공 불가 elsewhere in this codebase)", () => {
  assert.match(shopManagementSource, /if \(!approve && !confirm\(/);
});
