import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Real getAllMembers() reuses the RLS-bound browser client — no service-role bypass, no new broad grant", async () => {
  const source = await read("repositories/membership-repository.ts");
  assert.match(source, /async getAllMembers\(\): Promise<AdminMember\[\]>/);
  assert.match(source, /supabase\s*\.from\s*\(\s*"dealer_profiles"\s*,?\s*\)/);
  // Reuses the already-RLS-gated installer query instead of a second bespoke one.
  assert.match(source, /installerApplications\].*await Promise\.all\(\[[\s\S]*?this\.getInstallerApplications\(\)/);
  assert.doesNotMatch(source, /service_role/i);
  assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE/);
});

test("No new migration file was added for member listing — Real access relies entirely on the existing is_admin() RLS policy", async () => {
  const { readdir } = await import("node:fs/promises");
  const files = await readdir(new URL("../supabase/migrations", import.meta.url));
  const memberListingFiles = files.filter(
    (name) => name.includes("v0313") && /member/i.test(name) && !name.includes("demo_installer_membership"),
  );
  assert.deepEqual(
    memberListingFiles,
    [],
    "expected no dedicated migration for the Admin member-listing feature itself",
  );
  const membershipMigration = await read("supabase/migrations/202607190001_v034_membership.sql");
  assert.match(
    membershipMigration,
    /"profiles select own or admin"[\s\S]*?using \(id = auth\.uid\(\) or public\.is_admin\(\)\)/,
  );
  assert.match(
    membershipMigration,
    /"dealer profiles select own or admin"[\s\S]*?using \(user_id = auth\.uid\(\) or public\.is_admin\(\)\)/,
  );
});

test("AdminMember mapping keeps Dealer and Installer role/approval fields separate (no fabricated approval status for dealers)", async () => {
  const source = await read("repositories/membership-repository.ts");
  assert.match(source, /role:\s*"dealer"[\s\S]*?approvalStatus:\s*null/);
  assert.match(source, /role:\s*"installer"[\s\S]*?approvalStatus:\s*item\.status/);
});

test("Demo member roster is a fixed, local mapping from demoAccounts — never calls the real repository or a live Supabase query", async () => {
  const source = await read("repositories/demo-membership-repository.ts");
  assert.match(source, /async getAllMembers\(\): Promise<AdminMember\[\]>/);
  const method = source.slice(source.indexOf("async getAllMembers"), source.indexOf("subscribe(listener"));
  assert.match(method, /demoAccounts/);
  assert.doesNotMatch(method, /createSupabaseBrowserClient/);
  assert.doesNotMatch(method, /membershipRepository\./);
  // Admin demo account itself must never appear as a "member" row.
  assert.match(method, /account\.role === "dealer" \|\| account\.role === "shop"/);
});

test("Demo Installer 2/2 gets a real InstallerApprovalStatus value (approved), never a fabricated one outside the enum", async () => {
  const source = await read("repositories/demo-membership-repository.ts");
  assert.match(source, /approvalStatus: account\.role === "shop" \? "approved" : null/);
});

test("AdminMemberPanel wires search, role filter and approval filter as client-side derivations, no server search system", async () => {
  const source = await read("components/admin/AdminMemberPanel.tsx");
  assert.match(source, /role === "전체" \|\| item\.role === role/);
  assert.match(source, /approval === "전체" \|\| item\.approvalStatus === approval/);
  assert.match(
    source,
    /`\$\{item\.name\} \$\{item\.companyName\} \$\{item\.email\}`\.toLowerCase\(\)\.includes\(query\.trim\(\)\.toLowerCase\(\)\)/,
  );
});

test("AdminMemberPanel covers loading, error and empty states distinctly", async () => {
  const source = await read("components/admin/AdminMemberPanel.tsx");
  assert.match(source, /회원 목록을 불러오는 중입니다/);
  assert.match(source, /회원 목록을 불러오지 못했습니다/);
  assert.match(source, /조건에 맞는 회원이 없습니다/);
});

test("AdminMemberPanel calls the demo repository only when demoSession is true, and the real repository otherwise", async () => {
  const source = await read("components/admin/AdminMemberPanel.tsx");
  assert.match(
    source,
    /demoSession\s*\?\s*await demoMembershipRepository\.getAllMembers\(\)\s*:\s*await membershipRepository\.getAllMembers\(\)/,
  );
});

test("AdminMemberPanel links a pending/rejected/suspended installer to the existing InstallerApprovalPanel instead of duplicating approve/reject actions", async () => {
  const memberSource = await read("components/admin/AdminMemberPanel.tsx");
  assert.doesNotMatch(memberSource, /reviewInstaller/);
  assert.match(memberSource, /href="#installer-approval-panel"/);
  const panelSource = await read("components/admin/InstallerApprovalPanel.tsx");
  assert.match(panelSource, /id="installer-approval-panel"/);
});

test("Long company names and emails get overflow protection in both the list row and the detail drawer", async () => {
  const css = await read("app/globals.css");
  assert.match(css, /\.admin-member-list button span:nth-child\(2\) b \{[^}]*text-overflow: ellipsis/);
  assert.match(css, /\.admin-member-layout dd \{[^}]*overflow-wrap: anywhere/);
});

test("AdminOverview shows a small Demo/Real context badge without a large banner or page-wide redesign", async () => {
  const source = await read("components/admin/AdminOverview.tsx");
  assert.match(source, /demoSession \? "Demo 데이터" : "실제 운영 데이터"/);
});

test("AdminMemberPanel is mounted on the existing single-page Admin Overview, not a new route", async () => {
  const source = await read("components/admin/AdminOverview.tsx");
  assert.match(source, /<AdminMemberPanel demoSession={demoSession} \/>/);
});
