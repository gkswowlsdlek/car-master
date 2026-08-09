import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("../supabase/migrations/202608090002_account_foundation_b1_transaction_shop_compatibility.sql", import.meta.url);
const preflightUrl = new URL("../supabase/preflight/202608090002_account_foundation_b1_read_only.sql", import.meta.url);
const normalizeSql = (value) => value.replace(/\r\n?/g, "\n").replace(/--[^\n]*/g, "").replace(/\s+/g, " ").trim().toLowerCase();

test("B1 is one atomic, additive compatibility migration", async () => {
  const sql = normalizeSql(await readFile(migrationUrl, "utf8"));
  assert.match(sql, /^begin;/);
  assert.match(sql, /commit;$/);
  assert.match(sql, /alter table public\.transactions add column shop_id uuid;/);
  assert.doesNotMatch(sql, /shop_id uuid not null/);
  assert.match(sql, /constraint transactions_shop_id_fkey foreign key \(shop_id\) references public\.installer_shops\(id\) on delete restrict/);
  assert.match(sql, /create index transactions_shop_updated_idx on public\.transactions \(shop_id, updated_at desc\)/);
});

test("B1 backfills only through the legacy Installer-to-Shop compatibility key", async () => {
  const sql = normalizeSql(await readFile(migrationUrl, "utf8"));
  assert.match(sql, /update public\.transactions transaction_row set shop_id = shop\.id from public\.installer_shops shop where shop\.legacy_installer_user_id = transaction_row\.installer_id/);
  assert.doesNotMatch(sql, /set shop_id = transaction_row\.installer_id/);
  assert.doesNotMatch(sql, /limit 1/);
});

test("B1 fails closed before and after backfill", async () => {
  const sql = normalizeSql(await readFile(migrationUrl, "utf8"));
  const unmappedGuard = sql.indexOf("unmapped_transaction_count");
  const duplicateGuard = sql.indexOf("duplicate_installer_count");
  const backfill = sql.indexOf("update public.transactions transaction_row");
  const postGuard = sql.indexOf("null_shop_transaction_count");
  assert.ok(unmappedGuard >= 0 && unmappedGuard < backfill);
  assert.ok(duplicateGuard >= 0 && duplicateGuard < backfill);
  assert.ok(postGuard > backfill);
  assert.match(sql, /where not exists \( select 1 from public\.installer_shops shop where shop\.legacy_installer_user_id = transaction_row\.installer_id \)/);
  assert.match(sql, /having count\(distinct shop\.id\) > 1/);
  assert.match(sql, /where shop_id is null/);
  assert.equal((sql.match(/raise exception/g) ?? []).length, 3);
});

test("B1 leaves legacy runtime, authorization, RPC and Demo structures untouched", async () => {
  const sql = normalizeSql(await readFile(migrationUrl, "utf8"));
  assert.doesNotMatch(sql, /drop (?:column )?installer_id/);
  assert.doesNotMatch(sql, /alter column installer_id/);
  assert.doesNotMatch(sql, /create or replace function|create policy|drop policy|enable row level security/);
  assert.doesNotMatch(sql, /demo_/);
  assert.doesNotMatch(sql, /installer_profiles|installer_approvals/);
});

test("B1 Production preflight is SELECT-only and covers every required count", async () => {
  const sql = normalizeSql(await readFile(preflightUrl, "utf8"));
  assert.match(sql, /^select /);
  assert.doesNotMatch(sql, /\b(?:insert|update|delete|alter|create|drop|truncate|grant|revoke)\b/);
  for (const alias of [
    "transaction_count",
    "installer_id_null_count",
    "unmapped_transaction_count",
    "duplicate_installer_mapping_count",
    "mapped_transaction_count",
    "transaction_room_count",
    "chat_message_count",
  ]) assert.match(sql, new RegExp(`as ${alias}\\b`));
});
