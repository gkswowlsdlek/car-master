import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const normalize = (source) => source.replace(/\r\n?/g, "\n");

let migrationSource;
let transactionsTypesSource;
let repoSource;
let actionsHookSource;
let chatWorkspaceSource;
let dealerListSource;
let opsQueueSource;
let adminTxnPanelSource;
let shopMessageSource;
let transactionErrorsSource;
let dealerWorkspaceSource;
let landingSource;
let privacySource;
let termsSource;
let managementScreenSource;
let shopDashboardSource;

test.before(async () => {
  migrationSource = normalize(await read("supabase/migrations/202608130005_phone_contact_result.sql"));
  transactionsTypesSource = normalize(await read("types/transactions.ts"));
  repoSource = normalize(await read("repositories/supabase-transaction-repository.ts"));
  actionsHookSource = normalize(await read("hooks/use-transaction-actions.ts"));
  chatWorkspaceSource = normalize(await read("components/transactions/TransactionChatWorkspace.tsx"));
  dealerListSource = normalize(await read("components/transactions/DealerTransactionManagementScreen.tsx"));
  opsQueueSource = normalize(await read("components/admin/AdminOpsQueue.tsx"));
  adminTxnPanelSource = normalize(await read("components/admin/AdminTransactionPanel.tsx"));
  shopMessageSource = normalize(await read("services/shop-message.ts"));
  transactionErrorsSource = normalize(await read("services/transaction-errors.ts"));
  dealerWorkspaceSource = normalize(await read("components/workspaces/DealerWorkspace.tsx"));
  landingSource = normalize(await read("components/landing/LandingPage.tsx"));
  privacySource = normalize(await read("components/legal/PrivacyScreen.tsx"));
  termsSource = normalize(await read("components/legal/TermsScreen.tsx"));
  managementScreenSource = normalize(await read("components/transactions/TransactionManagementScreen.tsx"));
  shopDashboardSource = normalize(await read("components/shop/ShopDashboard.tsx"));
});

// Phase 8 — Beta 필수 편의/예외/신뢰성 보강. Not a new Marketplace feature:
// contact_status is a signal independent from both stage and outcome, and
// every UI change reuses existing components/CTAs (onFindAnotherShop,
// EndTransactionOutcomeModal's sibling pattern, the existing phone-confirm
// banner slot) rather than building anything new from scratch.

test("contact_status is additive, nullable, and constrained to exactly contacted/unreachable", () => {
  assert.match(migrationSource, /alter table public\.transactions add column contact_status text;/);
  assert.match(migrationSource, /check \(contact_status is null or contact_status in \('contacted', 'unreachable'\)\)/);
});

test("set_transaction_contact_status never touches stage or transaction_stage_events — a phone-contact result is a separate signal, not a work-stage or outcome change", () => {
  const fn = migrationSource.slice(migrationSource.indexOf("create function public.set_transaction_contact_status"), migrationSource.indexOf("revoke all on function public.set_transaction_contact_status"));
  assert.doesNotMatch(fn, /set stage|transaction_stage_events/);
  assert.match(fn, /set contact_status = p_status, updated_at = now\(\)/);
});

test("set_transaction_contact_status is dealer(own)/admin only — the Shop side never records this (matches the existing phone-confirm banner's role === \"dealer\" gate)", () => {
  const fn = migrationSource.slice(migrationSource.indexOf("create function public.set_transaction_contact_status"), migrationSource.indexOf("revoke all on function public.set_transaction_contact_status"));
  assert.match(fn, /if caller_role = 'admin'::public\.user_role then/);
  assert.match(fn, /elsif caller_role = 'dealer'::public\.user_role then\s*\n\s*if target\.dealer_id <> auth\.uid\(\) then raise exception 'Transaction access denied'; end if;/);
  assert.match(fn, /raise exception 'Only the dealer or an administrator can record a contact result';/);
});

test("set_transaction_contact_status posts a room-visible system message, matching the existing outcome/final-price audit-trail convention, and follows the same security-definer + revoke/grant convention", () => {
  const fn = migrationSource.slice(migrationSource.indexOf("create function public.set_transaction_contact_status"), migrationSource.indexOf("revoke all on function public.set_transaction_contact_status"));
  assert.match(fn, /security definer/);
  assert.match(fn, /set search_path = ''/);
  assert.match(fn, /insert into public\.chat_messages \(room_id, sender_role, text\)/);
  assert.match(migrationSource, /revoke all on function public\.set_transaction_contact_status\(text, text\) from public, anon;/);
  assert.match(migrationSource, /grant execute on function public\.set_transaction_contact_status\(text, text\) to authenticated;/);
});

test("Transaction type and repository mapping carry contactStatus (undefined = 확인 전), same snake_case/camelCase convention as outcomeNote", () => {
  assert.match(transactionsTypesSource, /export type ContactStatus = "contacted" \| "unreachable";/);
  assert.match(transactionsTypesSource, /contactStatus\?: ContactStatus;/);
  assert.match(repoSource, /contact_status,hidden_by_dealer/);
  assert.match(repoSource, /contactStatus: row\.contact_status \?\? undefined,/);
  assert.match(repoSource, /async setContactStatus\(transactionId: string, status: ContactStatus\)/);
});

test("useTransactionActions exposes setContactStatus, using the real RPC when Supabase-backed and a local-only fallback in Demo (no demo RPC exists for this field)", () => {
  assert.match(actionsHookSource, /const setContactStatus = useCallback\s*\(\s*async \(transaction: Transaction, status: ContactStatus\)\s*=>\s*\{/);
  assert.match(actionsHookSource, /await supabaseTransactionRepository\.setContactStatus\(transaction\.id, status\)/);
  assert.match(actionsHookSource, /transactionRepository\.update\s*\(\s*\{\s*\.\.\.transaction,\s*contactStatus:\s*status,/);
});

test("TransactionChatWorkspace shows three distinct states for the phone-confirm area — unset (record-result buttons), contacted (quiet confirmation, no more nagging), unreachable (retry + find-another-shop, reusing the existing onFindAnotherShop prop)", () => {
  assert.match(chatWorkspaceSource, /transaction\.contactStatus === "contacted"\s*\?\s*(?:\(\s*)?<div className="phone-confirm-banner phone-confirm-done"/);
  assert.match(chatWorkspaceSource, /transaction\.contactStatus === "unreachable"\s*\?\s*(?:\(\s*)?<div className="phone-confirm-banner phone-confirm-unreachable"/);
  assert.match(chatWorkspaceSource, /onClick=\{\(\)\s*=>\s*void recordContactResult\("contacted"\)\}\s*>\s*연결됐어요/);
  assert.match(chatWorkspaceSource, /onClick=\{\(\)\s*=>\s*void recordContactResult\("unreachable"\)\}\s*>\s*연락이 안 돼요/);
  assert.match(chatWorkspaceSource, /onFindAnotherShop\s*&&\s*(?:\(\s*)?<button\s+type="button"\s+className="button button-secondary"\s+onClick=\{onFindAnotherShop\}>\s*<Search size=\{16\}\s*\/>\s*다른 시공점 찾기\s*<\/button>/);
});

test("TransactionChatWorkspace never auto-changes stage from a contact-result click — recordContactResult only calls onSetContactStatus, nothing stage-related", () => {
  const fn = chatWorkspaceSource.slice(chatWorkspaceSource.indexOf("const recordContactResult"), chatWorkspaceSource.indexOf("const copyShopMessage"));
  assert.doesNotMatch(fn, /onStageChange|runStageChange/);
  assert.match(fn, /await onSetContactStatus\(transaction, status\);/);
});

test("시공점에 보낼 내용 복사 button exists, dealer-only, uses the Clipboard API, and shows a transient '복사됨' state instead of a new toast system", () => {
  assert.match(chatWorkspaceSource, /role === "dealer"\s*&&\s*(?:\(\s*)?<div className="sidebar-settlement">\s*<h4>시공점에 보낼 내용<\/h4>\s*<button\s+type="button"\s+className="button button-secondary"\s+onClick=\{copyShopMessage\}>/);
  assert.match(chatWorkspaceSource, /navigator\.clipboard\?\.writeText\(generateShopMessage\(transaction\)\)/);
  assert.match(chatWorkspaceSource, /setShopMessageCopied\(true\);/);
});

test("generateShopMessage's every line is conditional on the real field existing (the actual runtime-output test below confirms no undefined/null ever appears in the copied string)", () => {
  assert.match(shopMessageSource, /if \(vehicle\) lines\.push/);
  assert.match(shopMessageSource, /if \(work\) lines\.push/);
  assert.match(shopMessageSource, /if \(transaction\.service\.brand\) lines\.push/);
  assert.match(shopMessageSource, /if \(inbound\) lines\.push/);
  assert.match(shopMessageSource, /if \(transaction\.service\.extraRequest\) lines\.push/);
});

test("generateShopMessage never includes customer personal data, the Shop's own phone, the Dealer's personal contact, or price", () => {
  assert.doesNotMatch(shopMessageSource, /customerName|customerPhone|dealerPhone|contactPhone|finalPrice|pricing/);
});

test("generateShopMessage actually renders a complete real-data message with no empty-field artifacts", async () => {
  const { generateShopMessage } = await import("../services/shop-message.ts");
  const message = generateShopMessage({
    vehicle: { maker: "제네시스", model: "GV80" },
    service: { workDescription: "썬팅", brand: "3M", extraRequest: "" },
    schedule: { requestedInboundAt: "2026-08-17" },
  });
  assert.match(message, /차종: 제네시스 GV80/);
  assert.match(message, /작업: 썬팅/);
  assert.match(message, /필름: 3M/);
  assert.match(message, /입고 예정: 8월 17일/);
  assert.doesNotMatch(message, /추가 요청/);
  assert.doesNotMatch(message, /undefined|null/);
});

test("DealerTransactionManagementScreen swaps its 전화 확인 필요 flag to be contact-status-aware — suppressed once contacted, a distinct 연락 안 됨 chip when unreachable", () => {
  assert.match(dealerListSource, /const needsPhoneConfirm = inPhoneConfirmWindow && item\.contactStatus == null;/);
  assert.match(dealerListSource, /const contactUnreachable = item\.contactStatus === "unreachable";/);
  assert.match(dealerListSource, /contactUnreachable\s*&&\s*(?:\(\s*)?<small className="phone-confirm-flag phone-confirm-flag-unreachable">/);
});

test("AdminOpsQueue adds a 연락 실패 거래 card computed locally from the transactions prop (no new query), hidden at zero like every other card", () => {
  assert.match(opsQueueSource, /const unreachableCount = transactions\.filter\(\(item\) => item\.contactStatus === "unreachable"\)\.length;/);
  assert.match(opsQueueSource, /\{\s*key:\s*"unreachable",\s*count:\s*unreachableCount,\s*icon:\s*PhoneOff,\s*label:\s*"연락 실패 거래",\s*onClick:\s*onOpenUnreachableTransactions\s*,?\s*\}/);
});

test("AdminTransactionPanel adds a controlled 연락 실패만 filter (same lifted-state pattern as group) and shows 연락 상태 in the detail pane", () => {
  assert.match(adminTxnPanelSource, /contactFilter:\s*"전체"\s*\|\s*"연락실패";\s*onContactFilterChange:\s*\(value:\s*"전체"\s*\|\s*"연락실패"\)\s*=>\s*void;/);
  assert.match(adminTxnPanelSource, /\.filter\(\(item\) => contactFilter === "전체" \|\| item\.contactStatus === "unreachable"\)/);
  assert.match(adminTxnPanelSource, /<dt>연락 상태<\/dt>\s*<dd>\{selected\.contactStatus\s*\?\s*CONTACT_STATUS_LABEL\[selected\.contactStatus\]\s*:\s*"확인 전"\}<\/dd>/);
});

test("translateTransactionError maps known RPC exception strings to Korean and detects an expired/invalid session separately from a generic permission error", () => {
  assert.match(transactionErrorsSource, /export function isSessionExpiredError/);
  assert.match(transactionErrorsSource, /if \(isSessionExpiredError\(error\)\) return "로그인이 만료되었습니다\. 다시 로그인해 주세요\.";/);
  assert.match(transactionErrorsSource, /message\.includes\("access denied"\)/);
  assert.match(transactionErrorsSource, /message\.includes\("Invalid final price"\)/);
});

test("every previously-raw alert(error.message) site (hide/unhide/setContactStatus/changeFinalPrice/changePayment in the hook, transaction creation in DealerWorkspace, the room's stage/attachment/send inline errors) now goes through translateTransactionError — no raw RPC/Postgres exception text reaches the user via those paths", () => {
  assert.doesNotMatch(actionsHookSource, /alert\(error instanceof Error \? error\.message/);
  assert.doesNotMatch(chatWorkspaceSource, /error instanceof Error \? error\.message/);
  assert.doesNotMatch(dealerWorkspaceSource, /alert\(error instanceof Error \? error\.message/);
  assert.match(actionsHookSource, /import \{ translateTransactionError \} from "\.\.\/services\/transaction-errors";/);
  assert.match(chatWorkspaceSource, /import \{ translateTransactionError \} from "\.\.\/\.\.\/services\/transaction-errors";/);
  assert.match(dealerWorkspaceSource, /import \{ translateTransactionError \} from "\.\.\/\.\.\/services\/transaction-errors";/);
});

test("a real, Supabase-authenticated Dealer's shop search no longer merges in the ~250-entry fictional demo directory — demoInstallerListings only feeds an actual Demo session", () => {
  assert.match(dealerWorkspaceSource, /const availableShops = useMemo<InstallerListing\[\]>\s*\(\s*\(\)\s*=>\s*(?:\(\s*)?useSupabaseData\s*\?\s*approvedInstallerShops\s*:\s*demoInstallerListings(?:\s*\))?,\s*\[approvedInstallerShops,\s*useSupabaseData\]\s*,?\s*\);/);
  assert.doesNotMatch(dealerWorkspaceSource, /\[\.\.\.approvedInstallerShops, \.\.\.demoInstallerListings\]/);
});

test("Landing copy no longer claims real-time/GPS-based location matching, and no longer implies a separate 견적 요청→협의→거래 확정 sequence that doesn't match the actual immediate-transaction-creation Flow", () => {
  assert.doesNotMatch(landingSource, /실시간 위치 기준/);
  assert.doesNotMatch(landingSource, /견적 요청부터 거래까지/);
  assert.match(landingSource, /등록 지역 기준/);
});

test("PrivacyScreen now discloses that Admin can view transaction-room messages for operational purposes, and TermsScreen instructs members not to enter unnecessary third-party personal data in chat", () => {
  assert.match(privacySource, /운영자\(관리자\)는 거래 중개, 문제 상황 확인, 서비스 오류 대응 등 운영 목적상 필요한 범위에서/);
  assert.match(privacySource, /거래방의\s+메시지\s+내역을\s+열람할\s+수\s+있습니다/);
  assert.match(termsSource, /거래와\s+무관한\s+제3자\(예:\s+최종\s+고객\)의\s+이름,\s+연락처,\s+주소\s+등\s+불필요한\s+개인정보는\s+입력하지\s+않아야/);
});

test("최종 시공금액 label is now consistent across TransactionManagementScreen and ShopDashboard — no more '확정 금액'/'최종 금액' variants for the same pricing.finalPrice field", () => {
  assert.doesNotMatch(managementScreenSource, /<dt>확정 금액<\/dt>/);
  assert.match(managementScreenSource, /<dt>최종 시공금액<\/dt>/);
  assert.doesNotMatch(shopDashboardSource, /최종 금액 입력 필요/);
  assert.match(shopDashboardSource, /최종 시공금액 입력 필요/);
});
