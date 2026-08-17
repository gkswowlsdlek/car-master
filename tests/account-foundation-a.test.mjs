import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL(
  "../supabase/migrations/202608090001_account_foundation_a_shop_membership.sql",
  import.meta.url,
);
const legacyMembershipPath = new URL("../supabase/migrations/202607190001_v034_membership.sql", import.meta.url);
const legacyTransactionPath = new URL("../supabase/migrations/202607210001_v035_foundation.sql", import.meta.url);

const normalizeSql = (sql) =>
  sql.replace(/\r\n?/g, "\n").replace(/--.*$/gm, "").replace(/\s+/g, " ").trim().toLowerCase();

test("Account Foundation A adds account-independent Shops and explicit User memberships", async () => {
  const sql = normalizeSql(await readFile(migrationPath, "utf8"));

  assert.match(sql, /create table if not exists public\.installer_shops/);
  assert.match(sql, /id uuid primary key default gen_random_uuid\(\)/);
  assert.match(sql, /created_by uuid references public\.profiles\(id\) on delete set null/);
  assert.match(
    sql,
    /legacy_installer_user_id uuid unique references public\.installer_profiles\(user_id\) on delete set null/,
  );
  assert.doesNotMatch(sql, /id uuid primary key references (?:public\.)?profiles/);

  assert.match(sql, /create table if not exists public\.shop_memberships/);
  assert.match(sql, /shop_id uuid not null references public\.installer_shops\(id\) on delete cascade/);
  assert.match(sql, /user_id uuid not null references public\.profiles\(id\) on delete cascade/);
  assert.match(sql, /unique \(shop_id, user_id\)/);
});

test("Account Foundation A safely backfills legacy Installer Shops and owner memberships", async () => {
  const sql = normalizeSql(await readFile(migrationPath, "utf8"));

  assert.match(sql, /from public\.installer_profiles installer left join public\.installer_approvals approval/);
  assert.match(sql, /coalesce\(approval\.status, 'pending'::public\.installer_approval_status\)/);
  assert.match(sql, /'claimed'::public\.shop_ownership_status/);
  assert.match(sql, /on conflict \(legacy_installer_user_id\) do update/);
  assert.match(sql, /insert into public\.shop_memberships/);
  assert.match(sql, /'owner'::public\.shop_membership_role/);
  assert.match(sql, /'active'::public\.shop_membership_status/);
  assert.match(sql, /on conflict \(shop_id, user_id\) do update/);
});

test("new Shop tables are read-only to clients and visible only to members or Admin", async () => {
  const sql = normalizeSql(await readFile(migrationPath, "utf8"));

  assert.match(sql, /alter table public\.installer_shops enable row level security/);
  assert.match(sql, /alter table public\.shop_memberships enable row level security/);
  assert.match(sql, /installer shops select member or admin/);
  assert.match(sql, /membership\.user_id = auth\.uid\(\)/);
  assert.match(sql, /membership\.status = 'active'/);
  assert.match(sql, /shop memberships select own or admin/);
  assert.match(sql, /revoke all on table public\.installer_shops from anon, authenticated/);
  assert.match(sql, /revoke all on table public\.shop_memberships from anon, authenticated/);
  assert.doesNotMatch(sql, /grant (?:insert|update|delete|all)/);
});

test("Account Foundation A does not replace the legacy runtime contracts", async () => {
  const [foundation, legacyMembership, legacyTransaction] = await Promise.all([
    readFile(migrationPath, "utf8"),
    readFile(legacyMembershipPath, "utf8"),
    readFile(legacyTransactionPath, "utf8"),
  ]);
  const sql = normalizeSql(foundation);

  assert.match(normalizeSql(legacyMembership), /create table public\.installer_profiles/);
  assert.match(
    normalizeSql(legacyTransaction),
    /installer_id uuid not null references public\.installer_profiles\(user_id\)/,
  );
  assert.doesNotMatch(sql, /drop table/);
  assert.doesNotMatch(sql, /alter table public\.transactions/);
  assert.doesNotMatch(
    sql,
    /create or replace function public\.(?:handle_new_user|complete_installer_onboarding|get_approved_installer_directory|create_transaction_with_room)/,
  );
  const destructiveStatements = sql
    .split(";")
    .filter((statement) => /^\s*drop (?:policy|function|trigger)/.test(statement));
  assert.equal(
    destructiveStatements.some((statement) =>
      /(?:installer_profiles|installer_approvals|transactions)/.test(statement),
    ),
    false,
  );
});
