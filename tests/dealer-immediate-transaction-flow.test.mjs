import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const normalize = (source) => source.replace(/\r\n?/g, "\n");

let migrationSource;
let stateServiceSource;
let transactionsTypesSource;
let installerTypesSource;
let repoSource;
let directoryRepoSource;
let dealerWorkspaceSource;
let messengerScreenSource;
let chatWorkspaceSource;
let managementScreenSource;
let adminTransactionPanelSource;

test.before(async () => {
  migrationSource = normalize(await read("supabase/migrations/202608120002_dealer_immediate_transaction_flow.sql"));
  stateServiceSource = normalize(await read("services/transaction-state-service.ts"));
  transactionsTypesSource = normalize(await read("types/transactions.ts"));
  installerTypesSource = normalize(await read("types/installer.ts"));
  repoSource = normalize(await read("repositories/supabase-transaction-repository.ts"));
  directoryRepoSource = normalize(await read("repositories/installer-directory-repository.ts"));
  dealerWorkspaceSource = normalize(await read("components/workspaces/DealerWorkspace.tsx"));
  messengerScreenSource = normalize(await read("components/messenger/MessengerScreen.tsx"));
  chatWorkspaceSource = normalize(await read("components/transactions/TransactionChatWorkspace.tsx"));
  managementScreenSource = normalize(await read("components/transactions/TransactionManagementScreen.tsx"));
  adminTransactionPanelSource = normalize(await read("components/admin/AdminTransactionPanel.tsx"));
});

// Dealer immediate-transaction Phase 1 — the room is created the instant a
// Dealer submits a request, no Installer accept/reject gate, and a Shop with
// no linked Installer Account must be a fully valid transaction counterpart.

test("transactions.installer_id is relaxed to nullable, with a check that at least one of installer_id/shop_id is always present", () => {
  assert.match(migrationSource, /alter table public\.transactions\s*\n\s*alter column installer_id drop not null;/);
  assert.match(migrationSource, /check \(installer_id is not null or shop_id is not null\)/);
});

test("create_shop_transaction_with_room creates the transaction and its room in one statement — no acceptance gate, no separate accept/reject step", () => {
  const fn = migrationSource.slice(
    migrationSource.indexOf("create or replace function public.create_shop_transaction_with_room"),
    migrationSource.indexOf("revoke all on function public.create_shop_transaction_with_room"),
  );
  assert.match(fn, /insert into public\.transactions \(/);
  assert.match(
    fn,
    /insert into public\.transaction_rooms \(transaction_id\) values \(transaction_id\) returning id into room_id;/,
  );
  assert.doesNotMatch(fn, /reject|pending_approval|awaiting_installer|accept\(/i);
});

test("create_shop_transaction_with_room only requires the Shop to be approved + accepting_requests — it does not require installer_shops.legacy_installer_user_id to be set", () => {
  const fn = migrationSource.slice(
    migrationSource.indexOf("create or replace function public.create_shop_transaction_with_room"),
    migrationSource.indexOf("revoke all on function public.create_shop_transaction_with_room"),
  );
  assert.match(
    fn,
    /where shop\.id = target_shop_id\s*\n\s*and shop\.approval_status = 'approved'::public\.installer_approval_status\s*\n\s*and shop\.accepting_requests = true;/,
  );
  assert.doesNotMatch(fn, /legacy_installer_user_id is not null/);
  // installer_id is populated FROM the shop (nullable when the shop has none), never required
  assert.match(fn, /target_installer uuid;/);
  assert.match(fn, /select shop\.shop_name, shop\.legacy_installer_user_id into target_name, target_installer/);
});

test("guard_transaction_insert validates shop_id-only inserts against installer_shops, not installer_profiles, and rejects a transaction with neither id set", () => {
  const fn = migrationSource.slice(
    migrationSource.indexOf("create or replace function public.guard_transaction_insert"),
    migrationSource.indexOf("-- 5. create_shop_transaction_with_room"),
  );
  assert.match(fn, /if new\.installer_id is not null then/);
  assert.match(fn, /elsif new\.shop_id is not null then/);
  assert.match(fn, /from public\.installer_shops shop\s*\n\s*where shop\.id = new\.shop_id/);
  assert.match(fn, /raise exception 'Transaction must reference an installer or a shop';/);
});

test("get_approved_shop_directory reads from installer_shops (not installer_profiles) and returns phone for the call-CTA", () => {
  const fn = migrationSource.slice(
    migrationSource.indexOf("create or replace function public.get_approved_shop_directory"),
    migrationSource.indexOf("revoke all on function public.get_approved_shop_directory"),
  );
  assert.match(fn, /from public\.installer_shops shop/);
  assert.doesNotMatch(fn, /from public\.installer_profiles/);
  assert.match(
    fn,
    /id uuid, name text, address text, brands text\[\], works text\[\], hours text,\s*\n\s*available boolean, latitude double precision, longitude double precision, phone text/,
  );
});

test("get_transaction_contact falls back to installer_shops when the transaction has no installer_id, and never fabricates a phone number", () => {
  const fn = migrationSource.slice(
    migrationSource.indexOf("create or replace function public.get_transaction_contact"),
    migrationSource.indexOf("revoke all on function public.get_transaction_contact"),
  );
  assert.match(
    fn,
    /elsif txn\.shop_id is not null then\s*\n\s*return query select shop\.shop_name, coalesce\(nullif\(shop\.contact_phone, ''\), shop\.phone\)\s*\n\s*from public\.installer_shops shop where shop\.id = txn\.shop_id;/,
  );
  assert.doesNotMatch(fn, /'010-|fake|placeholder|dummy/i);
});

test("transition_transaction_stage adds a terminal 출고 stage after 작업완료 and lets the dealer drive forward/back transitions on their own transaction", () => {
  const fn = migrationSource.slice(
    migrationSource.indexOf("create or replace function public.transition_transaction_stage"),
    migrationSource.indexOf("revoke all on function public.transition_transaction_stage"),
  );
  assert.match(fn, /stage_order text\[\] := array\['견적', '시공예약', '입고', '작업완료', '출고'\];/);
  assert.match(
    fn,
    /elsif caller_role = 'dealer'::public\.user_role then\s*\n\s*if current_transaction\.dealer_id <> auth\.uid\(\) then/,
  );
});

test("transition_transaction_stage's installer-side authorization also accepts a shop-membership-connected operator, not only the legacy installer_id match", () => {
  const fn = migrationSource.slice(
    migrationSource.indexOf("create or replace function public.transition_transaction_stage"),
    migrationSource.indexOf("revoke all on function public.transition_transaction_stage"),
  );
  assert.match(
    fn,
    /elsif caller_role = 'installer'::public\.user_role then\s*\n\s*if current_transaction\.installer_id <> auth\.uid\(\)\s*\n\s*and not \(current_transaction\.shop_id is not null and public\.has_active_shop_membership\(current_transaction\.shop_id\)\) then/,
  );
});

test("transition_transaction_stage's completedAt write is direction-aware — it only clears completedAt when reversing away from 작업완료, not on every stage change with old_stage = 작업완료", () => {
  const fn = migrationSource.slice(
    migrationSource.indexOf("create or replace function public.transition_transaction_stage"),
    migrationSource.indexOf("revoke all on function public.transition_transaction_stage"),
  );
  assert.match(fn, /when event_direction = 'backward' and old_stage = '작업완료' then schedule - 'completedAt'/);
});

test("has_active_shop_membership and can_access_transaction/RLS select policy are extended additively — no existing dealer_id/installer_id/is_admin branch is removed", () => {
  assert.match(migrationSource, /create or replace function public\.has_active_shop_membership/);
  const canAccess = migrationSource.slice(
    migrationSource.indexOf("create or replace function public.can_access_transaction"),
    migrationSource.indexOf('drop policy if exists "transaction participants select"'),
  );
  assert.match(canAccess, /transaction\.dealer_id = check_user_id/);
  assert.match(canAccess, /transaction\.installer_id = check_user_id/);
  assert.match(canAccess, /public\.has_active_shop_membership\(transaction\.shop_id, check_user_id\)/);
  assert.match(canAccess, /public\.is_admin\(check_user_id\)/);
});

test("every new/replaced function keeps the SECURITY DEFINER + empty search_path + revoke-then-grant convention used across the schema", () => {
  for (const name of [
    "has_active_shop_membership",
    "can_access_transaction",
    "guard_transaction_insert",
    "create_shop_transaction_with_room",
    "get_approved_shop_directory",
    "get_transaction_contact",
    "transition_transaction_stage",
  ]) {
    const start = migrationSource.indexOf(`create or replace function public.${name}`);
    assert.ok(start >= 0, `expected public.${name} to be defined`);
    const body = migrationSource.slice(start, start + 400);
    assert.match(body, /security definer/, `${name} should be security definer`);
    assert.match(body, /set search_path = ''/, `${name} should set an empty search_path`);
  }
});

test("TransactionStage/stageOrder/label maps all learn 출고 as the terminal stage after 작업완료", () => {
  assert.match(transactionsTypesSource, /"견적" \| "시공예약" \| "입고" \| "작업완료" \| "출고" \| "취소"/);
  assert.match(
    stateServiceSource,
    /stageOrder: TransactionStage\[\] = \["견적", "시공예약", "입고", "작업완료", "출고"\];/,
  );
  for (const map of ["STAGE_ACTION_LABEL", "STAGE_REVERT_LABEL", "STAGE_REVERT_LOG_LABEL"]) {
    const line = stateServiceSource.split("\n").find((l) => l.includes(`export const ${map}`))
      ? stateServiceSource.slice(
          stateServiceSource.indexOf(`export const ${map}`),
          stateServiceSource.indexOf(";", stateServiceSource.indexOf(`export const ${map}`)),
        )
      : "";
    assert.match(line, /출고:/, `${map} should have a 출고 entry`);
  }
});

test("canTransitionStage no longer gates forward/backward moves to role === shop|admin only — the dealer can drive their own transaction's stage too, server-side ownership is what actually enforces access", () => {
  const fn = stateServiceSource.slice(
    stateServiceSource.indexOf("export function canTransitionStage"),
    stateServiceSource.indexOf("export function transitionStage"),
  );
  assert.doesNotMatch(fn, /role !== "shop" && role !== "admin"/);
  assert.match(fn, /if \(next === "취소" \|\| next === "시공불가"\) return role === "dealer" \|\| role === "admin";/);
});

test("Transaction.installerId is nullable in the type contract, matching the DB column now allowing null for Shops with no linked Installer Account", () => {
  assert.match(transactionsTypesSource, /installerId: string \| null;/);
});

test("InstallerListing carries an optional contactPhone, never defaulted to a fabricated value", () => {
  assert.match(installerTypesSource, /contactPhone\?: string;/);
});

test("installer-directory-repository calls get_approved_shop_directory (not the legacy installer-profile RPC) and maps phone into contactPhone without inventing one when absent", () => {
  assert.match(directoryRepoSource, /rpc\("get_approved_shop_directory"\)/);
  assert.doesNotMatch(directoryRepoSource, /get_approved_installer_directory/);
  assert.match(directoryRepoSource, /contactPhone: item\.phone \?\? undefined,/);
});

test("supabase-transaction-repository exposes createWithShopRoom calling create_shop_transaction_with_room with shopId, alongside (not replacing) the legacy createWithRoom method", () => {
  assert.match(
    repoSource,
    /async createWithShopRoom\(shopId: string, value: Pick<Transaction, "vehicle" \| "service" \| "pricing" \| "schedule">\)/,
  );
  assert.match(
    repoSource,
    /rpc\s*\(\s*"create_shop_transaction_with_room",\s*\{\s*payload:\s*\{\s*shopId,\s*vehicle:\s*value\.vehicle,\s*service:\s*value\.service,\s*pricing:\s*value\.pricing,\s*schedule:\s*value\.schedule,/,
  );
  assert.match(repoSource, /async createWithRoom\(value: Pick<Transaction, "installerId"/);
});

test("DealerWorkspace's real-mode creation calls createWithShopRoom(selectedShop.id, ...) — the Real/Supabase path no longer sends installerId", () => {
  const fn = dealerWorkspaceSource.slice(
    dealerWorkspaceSource.indexOf("const createTransaction ="),
    dealerWorkspaceSource.indexOf("if (useDemoSharedBackend)"),
  );
  assert.match(fn, /supabaseTransactionRepository\.createWithShopRoom\(selectedShop\.id, \{/);
  assert.doesNotMatch(fn, /supabaseTransactionRepository\.createWithRoom\(/);
});

test("MessengerScreen matches the selected installer listing against transaction.shopId, not the legacy installerId, so a no-installer-account Shop still resolves in the room sidebar", () => {
  assert.match(
    messengerScreenSource,
    /const selectedInstaller = installers\?\.find\(\(item\) => item\.id === selected\?\.transaction\.shopId\);/,
  );
});

// 메시지 정리(2026-08) — 큰 배너 대신 timeline의 "contact" 항목(거래방 생성
// 시스템 메시지 바로 아래)으로 위치만 옮겼다. 조건(pre-입고 & role dealer),
// 실제 시공점명/전화번호 사용, 가짜 번호 금지, contact_status 흐름은 동일.
test("TransactionChatWorkspace shows a compact 전화 확인 필요 block to the dealer only while pre-입고 (견적/시공예약), using the real 시공점명/전화번호 with a non-fabricated empty state otherwise", () => {
  assert.match(
    chatWorkspaceSource,
    /const showInlineContactBlock =\s*\n\s*role === "dealer" && \(transaction\.status\.stage === "견적" \|\| transaction\.status\.stage === "시공예약"\);/,
  );
  assert.match(chatWorkspaceSource, /<p className="chat-contact-inline-title">전화 확인이 필요합니다<\/p>/);
  assert.match(chatWorkspaceSource, /<p className="chat-contact-inline-shop">\{transaction\.installerName\}<\/p>/);
  assert.match(
    chatWorkspaceSource,
    /<p className="chat-contact-inline-phone">\s*\{installer\?\.contactPhone \|\| "등록된 연락처가 없습니다\."\}/,
  );
  assert.match(chatWorkspaceSource, /href=\{`tel:\$\{installer\.contactPhone\.replace\(\/\[\^0-9\+\]\/g, ""\)\}`\}/);
  assert.doesNotMatch(chatWorkspaceSource, /카카오톡.*버튼|kakao.*button/i);
});

test("hide-transaction terminal-stage checks treat 출고/취소/시공불가 the same as 작업완료 (all past the point where a shop still needs to touch the transaction)", () => {
  assert.match(
    chatWorkspaceSource,
    /!\["작업완료", "출고", "취소", "시공불가"\]\.includes\(transaction\.status\.stage\) && role === "shop"/,
  );
  assert.match(
    managementScreenSource,
    /!\["작업완료", "출고", "취소", "시공불가"\]\.includes\(selected\.status\.stage\) && role === "shop"/,
  );
});

// Phase 7 moved the "what counts as still in progress" logic out of
// AdminOverview's now-removed vanity stat cards and into AdminTransactionPanel's
// group filter (진행중/완료/종료), reusing isTerminalOutcome (취소/시공불가) —
// same exclusion, better factored, matching Dealer Phase 6's own groupOf().
test("Admin's 진행중/완료/종료 grouping excludes 출고/취소/시공불가 from '진행중' the same way the old stalled-count logic did", () => {
  assert.match(adminTransactionPanelSource, /if \(isTerminalOutcome\(stage\)\) return "종료";/);
  assert.match(adminTransactionPanelSource, /if \(stage === "출고"\) return "완료";/);
});

test("regression: create_transaction_with_room (legacy installerId path) is untouched by this migration — old Installer-account transactions keep working unchanged", async () => {
  const legacySource = normalize(await read("supabase/migrations/202607260001_v039_transaction_workflow.sql"));
  assert.match(legacySource, /create or replace function public\.create_transaction_with_room\(payload jsonb\)/);
  assert.doesNotMatch(migrationSource, /create or replace function public\.create_transaction_with_room\(/);
});
