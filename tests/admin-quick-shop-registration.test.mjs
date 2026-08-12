import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const normalize = (source) => source.replace(/\r\n?/g, "\n");

let migrationSource;
let repoSource;
let modalSource;
let panelSource;
let typesSource;
let a1Migration;

test.before(async () => {
  migrationSource = normalize(await read("supabase/migrations/202608130001_admin_quick_shop_registration.sql"));
  repoSource = normalize(await read("repositories/admin-shop-repository.ts"));
  modalSource = normalize(await read("components/admin/AdminQuickShopRegistrationModal.tsx"));
  panelSource = normalize(await read("components/admin/AdminShopSearchRequestPanel.tsx"));
  typesSource = normalize(await read("types/admin-shop.ts"));
  a1Migration = normalize(await read("supabase/migrations/202608090001_account_foundation_a_shop_membership.sql"));
});

// Phase 3 — Admin quick Shop registration. installer_shops.legacy_installer_user_id
// was already designed to stay NULL for admin-preregistered Shops (Account
// Foundation A) — this phase adds the missing INSERT path only.

test("no parallel Shop table/type is introduced — the migration only relaxes existing installer_shops NOT NULL columns and adds a traceability column to shop_search_requests", () => {
  assert.doesNotMatch(migrationSource, /create table public\.(temporary_shops|external_shops|quick_shops)/i);
  assert.match(migrationSource, /alter table public\.installer_shops alter column business_name drop not null;/);
  assert.match(migrationSource, /alter table public\.installer_shops alter column business_registration_number drop not null;/);
  assert.match(migrationSource, /alter table public\.installer_shops alter column representative_name drop not null;/);
  assert.match(migrationSource, /alter table public\.shop_search_requests add column registered_shop_id uuid references public\.installer_shops\(id\)/);
});

test("Account Foundation A already documented that legacy_installer_user_id stays NULL for admin-preregistered Shops — confirms this phase reuses, not reinvents, that design", () => {
  assert.match(a1Migration, /admin-pre-registered Shops leave it NULL and therefore need no auth user/);
});

test("admin_register_shop is admin-only, creates an approved+unclaimed Shop with no legacy_installer_user_id, no owner, and no forged business paperwork", () => {
  const fn = migrationSource.slice(migrationSource.indexOf("create or replace function public.admin_register_shop"), migrationSource.indexOf("revoke all on function public.admin_register_shop"));
  assert.match(fn, /if not public\.is_admin\(\) then raise exception 'Only an administrator can register a shop';/);
  assert.match(fn, /'approved'::public\.installer_approval_status, 'unclaimed'::public\.shop_ownership_status, auth\.uid\(\)/);
  assert.doesNotMatch(fn, /legacy_installer_user_id/);
  assert.doesNotMatch(fn, /shop_memberships/);
  assert.doesNotMatch(fn, /business_registration_number|representative_name/);
});

test("admin_register_shop requires shopName/address/phone and never silently defaults them", () => {
  const fn = migrationSource.slice(migrationSource.indexOf("create or replace function public.admin_register_shop"), migrationSource.indexOf("revoke all on function public.admin_register_shop"));
  for (const field of ["shopName", "address", "phone"]) {
    assert.match(fn, new RegExp(`if coalesce\\(payload ->> '${field}', ''\\) = '' then raise exception`));
  }
});

test("admin_register_shop re-checks for an existing duplicate server-side (phone or name+address) and only proceeds silently when the caller explicitly passes confirmDuplicate", () => {
  const fn = migrationSource.slice(migrationSource.indexOf("create or replace function public.admin_register_shop"), migrationSource.indexOf("revoke all on function public.admin_register_shop"));
  assert.match(fn, /if coalesce\(\(payload ->> 'confirmDuplicate'\)::boolean, false\) is distinct from true then/);
  assert.match(fn, /raise exception 'DUPLICATE_CANDIDATE_EXISTS';/);
});

test("admin_register_shop links registered_shop_id back onto the originating shop_search_requests row when requestId is provided, and never touches its status enum", () => {
  const fn = migrationSource.slice(migrationSource.indexOf("create or replace function public.admin_register_shop"), migrationSource.indexOf("revoke all on function public.admin_register_shop"));
  assert.match(fn, /update public\.shop_search_requests set registered_shop_id = new_id, updated_at = now\(\) where id = request_id;/);
  assert.doesNotMatch(fn, /set status/);
});

test("find_duplicate_shop_candidates is admin-only and matches on exact phone OR exact shop_name+address — no fuzzy/similarity matching", () => {
  const fn = migrationSource.slice(migrationSource.indexOf("create or replace function public.find_duplicate_shop_candidates"), migrationSource.indexOf("revoke all on function public.find_duplicate_shop_candidates"));
  assert.match(fn, /if not public\.is_admin\(\) then raise exception/);
  assert.match(fn, /s\.phone = trim\(p_phone\)/);
  assert.match(fn, /s\.shop_name = trim\(p_shop_name\) and s\.address = trim\(p_address\)/);
  assert.doesNotMatch(fn, /similarity|levenshtein|pg_trgm|ilike '%/i);
});

test("get_admin_shop_search_requests (redefined this phase) still requires is_admin and now also returns registered_shop_id, without dropping any prior column", () => {
  const fn = migrationSource.slice(migrationSource.indexOf("create or replace function public.get_admin_shop_search_requests"), migrationSource.indexOf("revoke all on function public.get_admin_shop_search_requests"));
  assert.match(fn, /if not public\.is_admin\(\) then raise exception/);
  assert.match(fn, /r\.registered_shop_id/);
  for (const col of ["dealer_name", "dealer_phone", "admin_note", "region", "work_type", "status"]) {
    assert.match(fn, new RegExp(`r\\.${col}`));
  }
});

test("every RPC in this migration keeps the SECURITY DEFINER + empty search_path + revoke-then-grant convention used across the schema", () => {
  for (const name of ["find_duplicate_shop_candidates", "admin_register_shop", "get_admin_shop_search_requests"]) {
    const start = migrationSource.indexOf(`create or replace function public.${name}`);
    assert.ok(start >= 0, `expected public.${name} to be defined`);
    const body = migrationSource.slice(start, start + 700);
    assert.match(body, /security definer/, `${name} should be security definer`);
    assert.match(body, /set search_path = ''/, `${name} should set an empty search_path`);
  }
});

test("Admin quick-registration form reuses the real Brand/WorkType lists from lib/dealer-flow-data — no new brand/work-type taxonomy", () => {
  assert.match(modalSource, /import \{ brands, workTypes, type Brand, type WorkType \} from "..\/..\/lib\/dealer-flow-data";/);
  assert.match(modalSource, /\{workTypes\.map\(/);
  assert.match(modalSource, /\{brands\.map\(/);
});

test("the completion view uses an honest 'unclaimed / no linked operator' label, never a fabricated verified/partner-sounding phrase", () => {
  assert.match(modalSource, /미가입 시공점 · 운영자 미연결/);
  assert.doesNotMatch(modalSource, /인증 완료|제휴 시공점|검증됨|공식 파트너/);
});

test("submitting shows the server's duplicate candidates and requires an explicit second action before registering anyway — never a silent auto-retry", () => {
  const submitFn = modalSource.slice(modalSource.indexOf("const submit = async"), modalSource.indexOf("return <div"));
  assert.match(submitFn, /DUPLICATE_CANDIDATE_ERROR/);
  assert.match(submitFn, /findDuplicateCandidates/);
  assert.doesNotMatch(submitFn, /void submit\(true\)/); // only the explicit "그래도 새로 등록" button click calls submit(true), not the catch block itself
});

test("AdminShopSearchRequestPanel offers the 시공점 빠른 등록 entry point only while no Shop has been registered yet for that request, and shows a note once one has", () => {
  assert.match(panelSource, /\{!selected\.registeredShopId && <button onClick=\{\(\) => setRegistrationOpen\(true\)\}>/);
  assert.match(panelSource, /\{selected\.registeredShopId && <p className="admin-quick-shop-registered-note">/);
});

test("AdminShopSearchRequestPanel reloads the request list after the modal closes, so 등록됨 state reflects immediately and Admin lands back on the same request", () => {
  assert.match(panelSource, /<AdminQuickShopRegistrationModal requestId=\{selected\.id\} onClose=\{\(\) => \{ setRegistrationOpen\(false\); void load\(\); \}\} onRegistered=\{\(\) => void load\(\)\} \/>/);
});

test("types: QuickRegisterShopInput's required fields match the product minimum (shopName/address/phone/services/brands), everything else optional", () => {
  const inputType = typesSource.slice(typesSource.indexOf("export type QuickRegisterShopInput"), typesSource.indexOf("export type DuplicateShopCandidate"));
  assert.match(inputType, /shopName: string;/);
  assert.match(inputType, /address: string;/);
  assert.match(inputType, /phone: string;/);
  assert.match(inputType, /requestId\?: string;/);
});
