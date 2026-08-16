import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const normalize = (source) => source.replace(/\r\n?/g, "\n");

let enumMigration;
let migrationSource;
let repoSource;
let adminRepoSource;
let dealerScreenSource;
let adminPanelSource;
let proposeModalSource;
let dealerWorkspaceSource;
let typesSource;

test.before(async () => {
  enumMigration = normalize(await read("supabase/migrations/202608130002_shop_search_proposal_status_values.sql"));
  migrationSource = normalize(await read("supabase/migrations/202608130003_shop_search_proposal_foundation.sql"));
  repoSource = normalize(await read("repositories/shop-search-request-repository.ts"));
  adminRepoSource = normalize(await read("repositories/admin-shop-repository.ts"));
  dealerScreenSource = normalize(await read("components/dealer/ShopSearchRequestScreen.tsx"));
  adminPanelSource = normalize(await read("components/admin/AdminShopSearchRequestPanel.tsx"));
  proposeModalSource = normalize(await read("components/admin/AdminProposeShopModal.tsx"));
  dealerWorkspaceSource = normalize(await read("components/workspaces/DealerWorkspace.tsx"));
  typesSource = normalize(await read("types/shop-search-request.ts"));
});

// Phase 4 — Admin proposes a Shop for a Phase 2 request; Dealer accepts
// (reusing Phase 1's create_shop_transaction_with_room verbatim) or
// declines (no Transaction/Room, request goes back to Admin's queue).

test("the 2 new statuses are added in their own migration, separate from any migration that references them (PostgreSQL forbids using a new enum value in the transaction that added it)", () => {
  assert.match(enumMigration, /alter type public\.shop_search_request_status add value if not exists 'shop_proposed';/);
  assert.match(enumMigration, /alter type public\.shop_search_request_status add value if not exists 'transaction_linked';/);
  assert.doesNotMatch(enumMigration, /create (or replace )?function|create table/i);
});

test("shop_search_proposals gets zero direct grants — same RPC-only shape as shop_search_requests", () => {
  assert.match(migrationSource, /revoke all on public\.shop_search_proposals from public, anon, authenticated;/);
  assert.doesNotMatch(migrationSource, /grant (select|insert|update|delete) on public\.shop_search_proposals/);
});

test("at most one live (status = proposed) proposal per request is enforced by a partial unique index, not just application logic", () => {
  assert.match(migrationSource, /create unique index shop_search_proposals_one_open_per_request_idx\s*\n\s*on public\.shop_search_proposals \(request_id\)\s*\n\s*where status = 'proposed';/);
});

test("admin_propose_shop_for_request is admin-only, requires an open request, and requires the shop to be approved", () => {
  const fn = migrationSource.slice(migrationSource.indexOf("create or replace function public.admin_propose_shop_for_request"), migrationSource.indexOf("revoke all on function public.admin_propose_shop_for_request"));
  assert.match(fn, /if not public\.is_admin\(\) then raise exception 'Only an administrator can propose a shop';/);
  assert.match(fn, /if target\.status not in \('requested', 'in_progress'\) then/);
  assert.match(fn, /approval_status = 'approved'::public\.installer_approval_status/);
  assert.match(fn, /set status = 'shop_proposed'::public\.shop_search_request_status/);
});

test("accept_shop_search_proposal reuses create_shop_transaction_with_room verbatim — no parallel Transaction-creation SQL exists in this migration", () => {
  const fn = migrationSource.slice(migrationSource.indexOf("create or replace function public.accept_shop_search_proposal"), migrationSource.indexOf("revoke all on function public.accept_shop_search_proposal"));
  assert.match(fn, /result := public\.create_shop_transaction_with_room\(jsonb_build_object\(/);
  assert.doesNotMatch(migrationSource, /insert into public\.transactions/);
  assert.doesNotMatch(migrationSource, /insert into public\.transaction_rooms/);
});

test("accept_shop_search_proposal is idempotent: row-locks the proposal, and a second call on an already-accepted proposal returns the stored result instead of creating a second Transaction", () => {
  const fn = migrationSource.slice(migrationSource.indexOf("create or replace function public.accept_shop_search_proposal"), migrationSource.indexOf("revoke all on function public.accept_shop_search_proposal"));
  assert.match(fn, /select \* into proposal from public\.shop_search_proposals where id = p_proposal_id for update;/);
  assert.match(fn, /if proposal\.status = 'accepted'::public\.shop_search_proposal_status then\s*\n\s*return jsonb_build_object\('transactionId', proposal\.transaction_id, 'roomId', proposal\.room_id\);/);
});

test("accept_shop_search_proposal only lets the owning dealer decide, requires vehicleClass, and marks both the proposal and the request as resolved", () => {
  const fn = migrationSource.slice(migrationSource.indexOf("create or replace function public.accept_shop_search_proposal"), migrationSource.indexOf("revoke all on function public.accept_shop_search_proposal"));
  assert.match(fn, /if request\.dealer_id <> auth\.uid\(\) then raise exception 'Proposal access denied';/);
  assert.match(fn, /if coalesce\(p_vehicle_class, ''\) = '' then raise exception 'vehicleClass is required';/);
  assert.match(fn, /status = 'accepted'::public\.shop_search_proposal_status/);
  assert.match(fn, /status = 'transaction_linked'::public\.shop_search_request_status/);
});

test("decline_shop_search_proposal never deletes the Shop or the proposal row, never creates a Transaction, and sends the request back to in_progress so Admin's queue picks it up again", () => {
  const fn = migrationSource.slice(migrationSource.indexOf("create or replace function public.decline_shop_search_proposal"), migrationSource.indexOf("revoke all on function public.decline_shop_search_proposal"));
  assert.match(fn, /if request\.dealer_id <> auth\.uid\(\) then raise exception 'Proposal access denied';/);
  assert.match(fn, /status = 'declined'::public\.shop_search_proposal_status/);
  assert.match(fn, /status = 'in_progress'::public\.shop_search_request_status/);
  assert.doesNotMatch(fn, /delete from/i);
  assert.doesNotMatch(migrationSource, /delete from public\.installer_shops/);
});

test("admin_mark_shop_search_request_unable is extended (not replaced-in-meaning) to also accept shop_proposed as a source state", () => {
  const fn = migrationSource.slice(migrationSource.indexOf("create or replace function public.admin_mark_shop_search_request_unable"), migrationSource.indexOf("revoke all on function public.admin_mark_shop_search_request_unable"));
  assert.match(fn, /if target\.status not in \('requested', 'in_progress', 'shop_proposed'\) then/);
});

test("get_my_shop_search_requests and get_admin_shop_search_requests both use drop-then-create (not CREATE OR REPLACE) since their return shape changed — the exact Phase 3 lesson applied", () => {
  assert.match(migrationSource, /drop function if exists public\.get_my_shop_search_requests\(\);\s*\n\s*\ncreate function public\.get_my_shop_search_requests/);
  assert.match(migrationSource, /drop function if exists public\.get_admin_shop_search_requests\(\);\s*\n\s*\ncreate function public\.get_admin_shop_search_requests/);
});

test("get_my_shop_search_requests only ever joins the caller's own requests to the CURRENT live (proposed) proposal — no other dealer's data reachable from this function", () => {
  const fn = migrationSource.slice(migrationSource.indexOf("create function public.get_my_shop_search_requests"), migrationSource.indexOf("revoke all on function public.get_my_shop_search_requests"));
  assert.match(fn, /where r\.dealer_id = auth\.uid\(\)/);
  assert.match(fn, /p\.status = 'proposed'::public\.shop_search_proposal_status/);
});

test("admin_search_shops is admin-only, approved-only, and returns only real installer_shops columns (no rating/review/volume fields exist to fabricate)", () => {
  const fn = migrationSource.slice(migrationSource.indexOf("create or replace function public.admin_search_shops"), migrationSource.indexOf("revoke all on function public.admin_search_shops"));
  assert.match(fn, /if not public\.is_admin\(\) then raise exception/);
  assert.match(fn, /s\.approval_status = 'approved'::public\.installer_approval_status/);
  assert.doesNotMatch(fn, /rating|review|volume/i);
});

test("every RPC in these migrations keeps the SECURITY DEFINER + empty search_path + revoke-then-grant convention", () => {
  for (const name of ["admin_propose_shop_for_request", "admin_search_shops", "accept_shop_search_proposal", "decline_shop_search_proposal", "admin_mark_shop_search_request_unable", "get_my_shop_search_requests", "get_admin_shop_search_requests"]) {
    const start = migrationSource.indexOf(`create or replace function public.${name}`) >= 0
      ? migrationSource.indexOf(`create or replace function public.${name}`)
      : migrationSource.indexOf(`create function public.${name}`);
    assert.ok(start >= 0, `expected public.${name} to be defined`);
    const body = migrationSource.slice(start, start + 700);
    assert.match(body, /security definer/, `${name} should be security definer`);
    assert.match(body, /set search_path = ''/, `${name} should be search_path-hardened`);
  }
});

test("repository wires every new RPC and never calls a Transaction-creation RPC other than through accept_shop_search_proposal", () => {
  assert.match(repoSource, /rpc\("accept_shop_search_proposal"/);
  assert.match(repoSource, /rpc\("decline_shop_search_proposal"/);
  assert.match(repoSource, /rpc\("admin_propose_shop_for_request"/);
  assert.match(adminRepoSource, /rpc\("admin_search_shops"/);
  assert.doesNotMatch(repoSource, /rpc\("create_shop_transaction_with_room"|rpc\("create_transaction_with_room"/);
});

test("Dealer screen shows the proposal card only when a request is shop_proposed AND actually carries a proposedShop, with 이 시공점으로 진행 / 다른 시공점 찾아주세요 as the two decisions", () => {
  assert.match(dealerScreenSource, /item\.status === "shop_proposed"\s*&&\s*item\.proposedShop\s*&&\s*(?:\(\s*)?<div className="shop-proposal-card">/);
  assert.match(dealerScreenSource, /이 시공점으로 진행/);
  assert.match(dealerScreenSource, /다른 시공점 찾아주세요/);
});

test("이 시공점으로 진행 requires a vehicleClass selection before it will submit, and calls acceptProposal (not a local/fake creation)", () => {
  const acceptFn = dealerScreenSource.slice(dealerScreenSource.indexOf("const confirmAccept"), dealerScreenSource.indexOf("const confirmDecline"));
  assert.match(acceptFn, /if \(!vehicleClass \|\| decisionPending\) return;/);
  assert.match(acceptFn, /shopSearchRequestRepository\.acceptProposal\(proposalId, vehicleClass\)/);
});

test("declining never blocks on a required reason — the decline note input is explicitly optional", () => {
  assert.match(dealerScreenSource, /이유 \(선택\)/);
  const declineFn = dealerScreenSource.slice(dealerScreenSource.indexOf("const confirmDecline"), dealerScreenSource.indexOf("return <section"));
  assert.match(declineFn, /declineNote\.trim\(\) \|\| undefined/);
});

test("accepting a proposal calls onTransactionCreated, and DealerWorkspace wires it to refresh transactions then navigate straight into the room list (same pattern as the existing direct-search create flow)", () => {
  assert.match(dealerScreenSource, /onTransactionCreated\(transactionId\);/);
  assert.match(dealerWorkspaceSource, /onTransactionCreated=\{\(id\)\s*=>\s*\{\s*void onRefresh\(\)\.then\(\(\)\s*=>\s*\{\s*setSelectedTransactionId\(id\);\s*setDealFilter\("전체"\);\s*onNavigate\("deals"\);\s*\}\);\s*\}\}/);
});

test("Admin panel only offers Dealer에게 제안 while the request is still open (requested/in_progress), and shows which shop is currently proposed", () => {
  assert.match(adminPanelSource, /\(selected\.status === "requested"\s*\|\|\s*selected\.status === "in_progress"\)\s*&&\s*(?:\(\s*)?<button\s+onClick=\{\(\)\s*=>\s*setProposalOpen\(true\)\}>/);
  assert.match(adminPanelSource, /selected\.status === "shop_proposed"\s*&&\s*selected\.proposedShopName\s*&&\s*(?:\(\s*)?<p/);
});

test("Admin propose modal offers a one-click shortcut for the Phase 3 registeredShopId and a real search fallback — no fabricated shop list", () => {
  assert.match(proposeModalSource, /registeredShopId\s*&&\s*(?:\(\s*)?<button\s+type="button"\s+className="button button-primary admin-propose-quick-pick"/);
  assert.match(proposeModalSource, /adminShopRepository\.searchShops\(query\.trim\(\)\)/);
});

test("types: ShopSearchRequestStatus includes exactly the 6 statuses this phase needs, and ProposedShop never carries an adminNote-shaped field", () => {
  assert.match(typesSource, /"requested" \| "in_progress" \| "shop_proposed" \| "transaction_linked" \| "cancelled" \| "unable_to_connect"/);
  const proposedShopType = typesSource.slice(typesSource.indexOf("export type ProposedShop"), typesSource.indexOf("/** Dealer-facing view"));
  assert.doesNotMatch(proposedShopType, /adminNote/);
});
