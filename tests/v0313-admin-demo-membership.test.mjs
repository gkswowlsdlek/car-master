import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Demo installer-membership backend mirrors the real approval workflow's statuses and stays RPC-only for mutations", async () => {
  const migration = await read("supabase/retired-migrations/202608030001_v0313_demo_installer_membership.sql");
  assert.match(migration, /check \(status in \('pending', 'approved', 'rejected', 'suspended'\)\)/);
  assert.match(migration, /function public\.demo_review_installer_application/);
  // No table-level insert/update/delete grant to anon — RPC-only, matching
  // the real installer_approvals table's RLS-gated-update invariant.
  assert.doesNotMatch(migration, /grant insert on public\.demo_installer_applications/);
  assert.doesNotMatch(migration, /grant update on public\.demo_installer_applications/);
  assert.doesNotMatch(migration, /grant delete on public\.demo_installer_applications/);
  // Physical isolation from real membership data.
  assert.doesNotMatch(migration, /references public\.installer_profiles/);
  assert.doesNotMatch(migration, /references public\.installer_approvals/);
  assert.doesNotMatch(migration, /references public\.profiles/);
  assert.doesNotMatch(migration, /references auth\.users/);
});

test("Demo membership repository degrades gracefully (not a throw) when the schema isn't ready", async () => {
  const source = await read("repositories/demo-membership-repository.ts");
  assert.match(source, /SCHEMA_MISSING_CODES/);
  assert.match(source, /catch \{\s*return false;/);
  assert.match(source, /isSupabaseConfigured/);
});

test("InstallerApprovalPanel only calls the Demo repository once its schema is confirmed ready, and the Real repository path is unchanged", async () => {
  const source = await read("components/admin/InstallerApprovalPanel.tsx");
  assert.match(source, /const useDemoBackend = demoSession && demoSchemaReady === true;/);
  assert.match(source, /demoMembershipRepository\.getInstallerApplications/);
  assert.match(source, /demoMembershipRepository\.reviewInstaller/);
  // Real (non-demo) branch still calls the original repository the same way.
  assert.match(source, /membershipRepository\.getInstallerApplications\(\)/);
  assert.match(source, /membershipRepository\.reviewInstaller\(selected\.userId, status, note\)/);
});
