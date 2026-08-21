import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const normalize = (source) => source.replace(/\r\n?/g, "\n");

let migrationSource;
let repoSource;
let dealerScreenSource;
let adminPanelSource;
let directoryScreenSource;
let dealerDashboardSource;
let dealerWorkspaceSource;
let adminOverviewSource;
let typesSource;

test.before(async () => {
  migrationSource = normalize(await read("supabase/migrations/202608120003_shop_search_request_foundation.sql"));
  repoSource = normalize(await read("repositories/shop-search-request-repository.ts"));
  dealerScreenSource = normalize(await read("components/dealer/ShopSearchRequestScreen.tsx"));
  adminPanelSource = normalize(await read("components/admin/AdminShopSearchRequestPanel.tsx"));
  directoryScreenSource = normalize(await read("components/dealer/InstallerDirectoryScreen.tsx"));
  dealerDashboardSource = normalize(await read("components/dealer/DealerDashboard.tsx"));
  dealerWorkspaceSource = normalize(await read("components/workspaces/DealerWorkspace.tsx"));
  adminOverviewSource = normalize(await read("components/admin/AdminOverview.tsx"));
  typesSource = normalize(await read("types/shop-search-request.ts"));
});

// Phase 2 — Dealer "시공점 찾기 요청" + Admin intake. Initial Beta supply gap:
// when a Dealer can't find a suitable Shop, Car-Master fills the gap by hand.

test("shop_search_requests has exactly the 4 statuses this phase needs — no shop-suggestion/dealer-selection/room fields exist yet", () => {
  assert.match(
    migrationSource,
    /create type public\.shop_search_request_status as enum \('requested', 'in_progress', 'cancelled', 'unable_to_connect'\);/,
  );
  assert.doesNotMatch(migrationSource, /suggested_shop|shop_candidate|selected_shop_id|room_id/i);
});

test("the table gets NO direct grant to anon/authenticated — every read and write is RPC-only, so a dealer can never craft a raw select that leaks admin_note", () => {
  assert.match(migrationSource, /revoke all on public\.shop_search_requests from public, anon, authenticated;/);
  assert.doesNotMatch(migrationSource, /grant (select|insert|update|delete) on public\.shop_search_requests/);
});

test("create_shop_search_request is dealer-only, snapshots dealer_name/dealer_phone from dealer_profiles at creation time, and validates every required field", () => {
  const fn = migrationSource.slice(
    migrationSource.indexOf("create or replace function public.create_shop_search_request"),
    migrationSource.indexOf("revoke all on function public.create_shop_search_request"),
  );
  assert.match(fn, /if caller_role is distinct from 'dealer'::public\.user_role then/);
  assert.match(
    fn,
    /select name, phone into dealer_name, dealer_phone\s*\n\s*from public\.dealer_profiles where user_id = auth\.uid\(\);/,
  );
  for (const field of ["region", "workType", "vehicleMaker", "vehicleModel", "desiredInboundDate"]) {
    assert.match(fn, new RegExp(`if coalesce\\(payload ->> '${field}', ''\\) = '' then raise exception`));
  }
});

test("get_my_shop_search_requests scopes to the caller's own dealer_id and its column list never includes dealer_name/dealer_phone/admin_note", () => {
  const fn = migrationSource.slice(
    migrationSource.indexOf("create or replace function public.get_my_shop_search_requests"),
    migrationSource.indexOf("revoke all on function public.get_my_shop_search_requests"),
  );
  assert.match(fn, /where r\.dealer_id = auth\.uid\(\)/);
  assert.doesNotMatch(fn, /admin_note/);
  assert.doesNotMatch(fn, /dealer_name|dealer_phone/);
});

test("cancel_shop_search_request only lets the owning dealer cancel their own open (requested/in_progress) request — never a hard delete, never another dealer's row", () => {
  const fn = migrationSource.slice(
    migrationSource.indexOf("create or replace function public.cancel_shop_search_request"),
    migrationSource.indexOf("revoke all on function public.cancel_shop_search_request"),
  );
  assert.match(fn, /if target\.dealer_id <> auth\.uid\(\) then raise exception 'Request access denied';/);
  assert.match(fn, /if target\.status not in \('requested', 'in_progress'\) then/);
  assert.match(fn, /set status = 'cancelled', updated_at = now\(\)/);
  assert.doesNotMatch(fn, /delete from public\.shop_search_requests/);
});

test("get_admin_shop_search_requests requires is_admin(), returns every column including admin_note, and sorts open requests oldest-first", () => {
  const fn = migrationSource.slice(
    migrationSource.indexOf("create or replace function public.get_admin_shop_search_requests"),
    migrationSource.indexOf("revoke all on function public.get_admin_shop_search_requests"),
  );
  assert.match(fn, /if not public\.is_admin\(\) then raise exception/);
  assert.match(fn, /r\.admin_note/);
  assert.match(fn, /order by\s*\n\s*\(r\.status in \('requested', 'in_progress'\)\) desc,\s*\n\s*r\.created_at asc;/);
});

test("admin_start_shop_search_request and admin_mark_shop_search_request_unable are admin-only and only fire from the correct source status", () => {
  const start = migrationSource.slice(
    migrationSource.indexOf("create or replace function public.admin_start_shop_search_request"),
    migrationSource.indexOf("revoke all on function public.admin_start_shop_search_request"),
  );
  assert.match(start, /if not public\.is_admin\(\) then raise exception/);
  assert.match(
    start,
    /if target\.status <> 'requested' then raise exception 'Only a newly requested item can be started';/,
  );
  assert.match(start, /set status = 'in_progress', updated_at = now\(\)/);

  const unable = migrationSource.slice(
    migrationSource.indexOf("create or replace function public.admin_mark_shop_search_request_unable"),
    migrationSource.indexOf("revoke all on function public.admin_mark_shop_search_request_unable"),
  );
  assert.match(unable, /if not public\.is_admin\(\) then raise exception/);
  assert.match(unable, /if target\.status not in \('requested', 'in_progress'\) then/);
});

test("admin_set_shop_search_request_note is admin-only — this is the one write path for the internal-only operational memo", () => {
  const fn = migrationSource.slice(
    migrationSource.indexOf("create or replace function public.admin_set_shop_search_request_note"),
    migrationSource.indexOf("revoke all on function public.admin_set_shop_search_request_note"),
  );
  assert.match(
    fn,
    /if not public\.is_admin\(\) then raise exception 'Only an administrator can set the operational note';/,
  );
});

test("every RPC in this migration keeps the SECURITY DEFINER + empty search_path + revoke-then-grant convention used across the schema", () => {
  for (const name of [
    "create_shop_search_request",
    "get_my_shop_search_requests",
    "cancel_shop_search_request",
    "get_admin_shop_search_requests",
    "admin_start_shop_search_request",
    "admin_mark_shop_search_request_unable",
    "admin_set_shop_search_request_note",
  ]) {
    const start = migrationSource.indexOf(`create or replace function public.${name}`);
    assert.ok(start >= 0, `expected public.${name} to be defined`);
    const body = migrationSource.slice(start, start + 700);
    assert.match(body, /security definer/, `${name} should be security definer`);
    assert.match(body, /set search_path = ''/, `${name} should set an empty search_path`);
  }
});

test("repository maps every RPC one-to-one and never selects admin_note for the dealer-facing methods", () => {
  assert.match(repoSource, /rpc\("create_shop_search_request"/);
  assert.match(repoSource, /rpc\("get_my_shop_search_requests"\)/);
  assert.match(repoSource, /rpc\("cancel_shop_search_request"/);
  assert.match(repoSource, /rpc\("get_admin_shop_search_requests"\)/);
  assert.match(repoSource, /rpc\("admin_start_shop_search_request"/);
  assert.match(repoSource, /rpc\("admin_mark_shop_search_request_unable"/);
  assert.match(repoSource, /rpc\("admin_set_shop_search_request_note"/);
  const getMine = repoSource.slice(repoSource.indexOf("async getMine"), repoSource.indexOf("async cancel"));
  assert.doesNotMatch(getMine, /admin_note/);
});

test("types: ShopSearchRequest (dealer view) has no adminNote field; AdminShopSearchRequest extends it with dealer contact + adminNote", () => {
  const dealerType = typesSource.slice(
    typesSource.indexOf("export type ShopSearchRequest ="),
    typesSource.indexOf("export type AdminShopSearchRequest"),
  );
  assert.doesNotMatch(dealerType, /adminNote/);
  assert.match(typesSource, /export type AdminShopSearchRequest = ShopSearchRequest & \{/);
  assert.match(typesSource, /adminNote\?: string;/);
});

test("Dealer directory screen surfaces the '시공점 찾기 요청' CTA only in the empty state, and only when the Real-mode handler is passed in", () => {
  // 빈 상태 마크업은 공용 EmptyState로 옮겼고, "결과 0건"과 "디렉터리 자체가
  // 비어 있음"을 이제 구분한다(실계정 신규 딜러는 후자를 본다). 두 경우 모두
  // 요청 CTA는 onShopSearchRequest가 넘어온 Real 모드에서만 나타나야 한다.
  const emptyStates = directoryScreenSource.slice(
    directoryScreenSource.indexOf("installers.length === 0 ?"),
    directoryScreenSource.indexOf("<div className=\"installer-list\""),
  );
  assert.match(emptyStates, /아직 등록된 시공점이 없습니다\./);
  assert.match(emptyStates, /조건에 맞는 시공점이 없습니다\./);
  // 두 상태 모두 CTA는 핸들러 존재 여부로 가려진다.
  assert.match(
    emptyStates,
    /action=\{onShopSearchRequest \? \{ label: "시공점 찾기 요청", onClick: onShopSearchRequest \} : undefined\}/,
  );
  assert.match(
    emptyStates,
    /secondaryAction=\{\s*onShopSearchRequest \? \{ label: "카마스터에 찾기 요청", onClick: onShopSearchRequest \} : undefined\s*\}/,
  );
});

test("DealerWorkspace only passes the shop-search-request entry points (directory CTA, dashboard button, screen render) in Real/Supabase mode — never for Demo/local", () => {
  assert.match(
    dealerWorkspaceSource,
    /onShopSearchRequest=\{useSupabaseData \? \(\) => onNavigate\("shopSearchRequests"\) : undefined\}/,
  );
  assert.match(
    dealerWorkspaceSource,
    /onShopSearchRequests=\{useSupabaseData \? \(\) => onNavigate\("shopSearchRequests"\) : undefined\}/,
  );
  assert.match(
    dealerWorkspaceSource,
    /\{screen === "shopSearchRequests"\s*&&\s*useSupabaseData\s*&&\s*(?:\(\s*)?<ShopSearchRequestScreen\s/,
  );
});

test("ShopSearchRequestScreen's create form collects every required field (region/workType/vehicle/desiredInboundDate/dateFlexible/optional note) and saves through the repository, never localStorage", () => {
  for (const field of [
    "region",
    "workType",
    "vehicleMaker",
    "vehicleModel",
    "desiredInboundDate",
    "dateFlexible",
    "dealerNote",
  ]) {
    assert.match(dealerScreenSource, new RegExp(field));
  }
  assert.match(dealerScreenSource, /shopSearchRequestRepository\.create\(/);
  assert.doesNotMatch(dealerScreenSource, /localStorage/);
});

test("ShopSearchRequestScreen only offers '요청 취소' for requested/in_progress rows, and cancelling calls the repository (never a local mutation)", () => {
  assert.match(
    dealerScreenSource,
    /\(item\.status === "requested"\s*\|\|\s*item\.status === "in_progress"\)\s*&&\s*(?:\(\s*)?<button\s+className="button button-secondary"\s+onClick=\{\(\)\s*=>\s*void cancel\(item\.id\)\}>\s*요청 취소\s*<\/button>/,
  );
  const cancelStart = dealerScreenSource.indexOf("const cancel = async");
  const renderBoundary = /\breturn\s*(?:\(\s*)?<section\b/.exec(dealerScreenSource.slice(cancelStart));
  assert.notEqual(cancelStart, -1, "cancel function start must exist");
  assert.ok(renderBoundary, "component render boundary must exist after cancel function");
  const cancelFn = dealerScreenSource.slice(cancelStart, cancelStart + renderBoundary.index);
  assert.match(cancelFn, /shopSearchRequestRepository\.cancel\(id\)/);
});

test("DealerDashboard's shop-search-request entry point only renders when the Real-mode handler is provided", () => {
  assert.match(
    dealerDashboardSource,
    /\{onShopSearchRequests\s*&&\s*(?:\(\s*)?<button\s+className="button button-ghost"\s+onClick=\{onShopSearchRequests\}>/,
  );
});

test("AdminOverview wires AdminShopSearchRequestPanel in alongside the other operational panels, unchanged existing panels still present", () => {
  assert.match(adminOverviewSource, /<AdminShopSearchRequestPanel\s+demoSession=\{demoSession\}\s*\/>/);
  assert.match(adminOverviewSource, /<AdminTransactionPanel\s/);
  assert.match(adminOverviewSource, /<InstallerApprovalPanel\s/);
  assert.match(adminOverviewSource, /<AdminMemberPanel\s/);
});

test("AdminShopSearchRequestPanel shows Dealer name/phone/region/work/vehicle/desired date/date-flexibility/dealer note, a labeled 'Dealer에게 노출되지 않음' admin-only note field, and gates 확인 시작/연결 어려움 by current status", () => {
  for (const field of [
    "selected.dealerName",
    "selected.dealerPhone",
    "selected.region",
    "selected.workType",
    "selected.vehicleMaker",
    "selected.desiredInboundDate",
    "selected.dateFlexible",
    "selected.dealerNote",
  ]) {
    assert.match(adminPanelSource, new RegExp(field.replace(".", "\\.")));
  }
  assert.match(adminPanelSource, /Dealer에게 노출되지 않음/);
  assert.match(
    adminPanelSource,
    /selected\.status === "requested"\s*&&\s*(?:\(\s*)?<button\s+className="approve"\s+onClick=\{\(\)\s*=>\s*void startProcessing\(selected\.id\)\}>/,
  );
  assert.match(
    adminPanelSource,
    /selected\.status === "shop_proposed"\)\s*&&\s*(?:\(\s*)?<button\s+className="reject"\s+onClick=\{\(\)\s*=>\s*void markUnable\(selected\.id\)\}>/,
  );
});

test("AdminShopSearchRequestPanel default order relies on get_admin_shop_search_requests' own oldest-open-first sort — it does not re-sort client-side", () => {
  assert.doesNotMatch(adminPanelSource, /\.sort\(/);
});
