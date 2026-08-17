import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync("supabase/migrations/202608140001_shop_management_operating_profile_rpc.sql", "utf8");

test("Shop Management boundary uses a SECURITY DEFINER allowlist RPC", () => {
  assert.match(
    migration,
    /create or replace function public\.update_shop_operating_profile\(\s*p_shop_id uuid,\s*p_payload jsonb/s,
  );
  assert.match(migration, /security definer\s+set search_path = ''/s);
  assert.match(
    migration,
    /revoke all on function public\.update_shop_operating_profile\(uuid, jsonb\) from public, anon, authenticated/,
  );
  assert.match(
    migration,
    /grant execute on function public\.update_shop_operating_profile\(uuid, jsonb\) to authenticated/,
  );
  for (const field of [
    "shop_name",
    "address",
    "detail_address",
    "phone",
    "contact_phone",
    "business_hours",
    "closed_days",
    "supported_brands",
    "supported_services",
    "introduction",
    "accepting_requests",
  ]) {
    assert.match(migration, new RegExp(`\\b${field}\\b`));
  }
  for (const field of [
    "approval_status",
    "ownership_status",
    "business_registration_number",
    "created_by",
    "membership_role",
    "status",
  ]) {
    assert.doesNotMatch(migration, new RegExp(`set\\s+[\\s\\S]{0,80}\\b${field}\\s*=`, "i"));
  }
});

test("Shop Management boundary requires approved owner/manager membership", () => {
  assert.match(migration, /current_shop\.approval_status <> 'approved'/);
  assert.match(migration, /membership\.status = 'active'/);
  assert.match(migration, /membership\.membership_role in \('owner'.*'manager'/s);
  assert.match(migration, /if caller_id is null/);
  assert.match(migration, /if not found then/);
});

test("Shop Management boundary preserves Dealer, legacy profile, and Directory contracts", () => {
  assert.doesNotMatch(migration, /installer_profiles\s+(update|delete|alter)/i);
  assert.doesNotMatch(migration, /dealer_profiles\s+(update|delete|alter)/i);
  assert.doesNotMatch(migration, /create table|alter table|drop table/i);
  assert.doesNotMatch(migration, /approval_status\s*=\s*'approved'.*ownership_status/s);
});
