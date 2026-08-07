import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = async (path) => (await readFile(new URL(`../${path}`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");
const migrationPath = "supabase/migrations/202608070002_pre_v04_installer_identity_reapproval.sql";

const identityFields = ["shop_name", "representative_name", "business_name", "business_registration_number", "address", "detail_address"];
const operationalFields = ["phone", "contact_phone", "supported_services", "supported_brands"];

function nextApprovalStatus(status, before, after) {
  const identityChanged = identityFields.some((field) => before[field] !== after[field]);
  return status === "approved" && identityChanged ? "pending" : status;
}

test("the existing schema lets an Installer update identity fields but reserves approval updates for Admin", async () => {
  const foundation = await read("supabase/migrations/202607190001_v034_membership.sql");
  assert.match(foundation, /create policy "installer profiles update own"[\s\S]*?using \(user_id = auth\.uid\(\)\) with check \(user_id = auth\.uid\(\)\);/);
  for (const field of identityFields) assert.match(foundation, new RegExp(`grant update \\([^)]*${field}`));
  assert.match(foundation, /create policy "installer approvals admin update"[\s\S]*?using \(public\.is_admin\(\)\) with check \(public\.is_admin\(\)\);/);
});

test("the trigger covers only approval identity fields and uses NULL-safe comparisons", async () => {
  const migration = await read(migrationPath);
  for (const field of identityFields) {
    assert.match(migration, new RegExp(`old\\.${field} is distinct from new\\.${field}`));
  }
  const trigger = migration.slice(migration.indexOf("create trigger installer_identity_change_requires_reapproval"));
  for (const field of identityFields) assert.match(trigger, new RegExp(`\\b${field}\\b`));
  for (const field of operationalFields) assert.doesNotMatch(trigger, new RegExp(`\\b${field}\\b`));
});

test("approved identity changes require review while operational changes do not", () => {
  const original = {
    shop_name: "A", representative_name: "대표", business_name: "사업자", business_registration_number: "111",
    address: "서울", detail_address: null, phone: "010", contact_phone: "010", supported_services: ["썬팅"], supported_brands: ["브랜드"],
  };
  for (const field of identityFields) {
    const changed = { ...original, [field]: original[field] === null ? "101호" : `${original[field]}-변경` };
    assert.equal(nextApprovalStatus("approved", original, changed), "pending", `${field} change must require reapproval`);
  }
  for (const field of operationalFields) {
    const changed = { ...original, [field]: Array.isArray(original[field]) ? [...original[field], "추가"] : `${original[field]}-변경` };
    assert.equal(nextApprovalStatus("approved", original, changed), "approved", `${field} change must stay approved`);
  }
});

test("pending, rejected, and suspended cannot escape their current state through profile edits", () => {
  const before = { shop_name: "A", representative_name: "대표", business_name: "사업자", business_registration_number: "111", address: "서울", detail_address: null };
  const after = { ...before, business_registration_number: "222" };
  assert.equal(nextApprovalStatus("pending", before, after), "pending");
  assert.equal(nextApprovalStatus("rejected", before, after), "rejected");
  assert.equal(nextApprovalStatus("suspended", before, after), "suspended");
});

test("writing identical values, including NULL, does not cause reapproval", () => {
  const profile = { shop_name: "A", representative_name: "대표", business_name: "사업자", business_registration_number: "111", address: "서울", detail_address: null };
  assert.equal(nextApprovalStatus("approved", profile, { ...profile }), "approved");
});

test("the DB function resets only approved rows and cannot be invoked directly by clients", async () => {
  const migration = await read(migrationPath);
  assert.match(migration, /security definer\s+set search_path = ''/);
  assert.match(migration, /where user_id = new\.user_id\s+and status = 'approved'::public\.installer_approval_status;/);
  assert.match(migration, /set status = 'pending'::public\.installer_approval_status/);
  assert.match(migration, /reviewed_by = null,[\s\S]*?reviewed_at = null,[\s\S]*?review_note = null/);
  assert.match(migration, /revoke all on function public\.reset_installer_approval_on_identity_change\(\) from public, anon, authenticated;/);
  assert.doesNotMatch(migration, /grant execute on function public\.reset_installer_approval_on_identity_change/);
});

test("the migration protects future updates without bulk-changing existing Installers", async () => {
  const migration = await read(migrationPath);
  const outsideFunction = migration.slice(migration.indexOf("$$;") + 3);
  assert.doesNotMatch(outsideFunction, /update public\.installer_approvals/);
  assert.match(migration, /after update of shop_name, representative_name, business_name,[\s\S]*?business_registration_number, address, detail_address/);
  assert.doesNotMatch(migration, /demo_|alter table|create policy|drop policy/);
});

test("profile persistence preserves address and detail-address as separate values", async () => {
  const repository = await read("repositories/supabase-profile-repository.ts");
  const types = await read("types/transactions.ts");
  const editor = await read("components/profile/ProfileEditor.tsx");
  assert.match(types, /address\?: string; detailAddress\?: string;/);
  assert.match(repository, /address: data\.address, detailAddress: data\.detail_address \?\? undefined/);
  assert.match(repository, /detail_address: profile\.detailAddress \?\? null/);
  assert.match(editor, /field\("address", "주소"\).*field\("detailAddress", "상세주소"\)/s);
});

test("1-D pending state immediately feeds the existing 1-C approved-only WRITE guard", async () => {
  const oneC = await read("supabase/migrations/202608070001_pre_v04_installer_write_approval.sql");
  const oneD = await read(migrationPath);
  assert.match(oneD, /set status = 'pending'/);
  assert.match(oneC, /approval\.status = 'approved'::public\.installer_approval_status/);
  for (const rpc of ["set_transaction_visibility", "set_transaction_final_price", "transition_transaction_payment", "transition_transaction_stage"]) {
    assert.match(oneC, new RegExp(`create or replace function public\\.${rpc}`));
    assert.match(oneC, /public\.is_installer_approved\(auth\.uid\(\)\)/);
  }
});

test("next navigation or refresh routes a no-longer-approved Installer to account status", async () => {
  const proxy = await read("lib/supabase/proxy.ts");
  const policy = await read("services/auth/access-policy.ts");
  assert.match(proxy, /pathname\.startsWith\("\/shop"\) && !approved[\s\S]*?"\/account-status"/);
  assert.match(policy, /return user\.approvalStatus === "approved" \? "\/shop" : "\/account-status";/);
});

test("onboarding and Admin approval remain unchanged", async () => {
  const onboarding = await read("supabase/migrations/202608050002_v0314_legal_onboarding_foundation.sql");
  const membership = await read("repositories/membership-repository.ts");
  assert.match(onboarding, /insert into public\.installer_approvals \(user_id\) values \(caller_id\);/);
  assert.match(membership, /from\("installer_approvals"\)\.update\(\{ status, review_note:/);
  const migration = await read(migrationPath);
  assert.doesNotMatch(migration, /complete_installer_onboarding|reviewInstaller|demo_/);
});
