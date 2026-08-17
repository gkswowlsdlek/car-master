import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const workspace = fs.readFileSync("components/workspaces/InstallerWorkspace.tsx", "utf8");
const repository = fs.readFileSync("repositories/shop-management-repository.ts", "utf8");

test("shop transaction scope resolves active membership shop ids", () => {
  assert.match(repository, /getActiveShopIdsForUser\(userId: string\)/);
  assert.match(repository, /from\("shop_memberships"\)/);
  assert.match(repository, /eq\("user_id", userId\)/);
  assert.match(repository, /eq\("status", "active"\)/);
});

test("shopId is primary and legacy installerId is fallback", () => {
  assert.match(workspace, /if \(item\.shopId\) return activeShopIds\.includes\(item\.shopId\)/);
  assert.match(workspace, /item\.installerId === legacyInstallerId/);
  assert.match(workspace, /const legacyInstallerId = demo \? account\.shopId : account\.id/);
});

test("Demo and real shop scopes remain separated", () => {
  assert.match(workspace, /isDemoAccountId\(account\.id\)/);
  // Tolerates Prettier breaking the call across lines
  // (`shopManagementRepository\n  .getActiveShopIdsForUser(...)`), which is how
  // the repo formats it today.
  assert.match(workspace, /shopManagementRepository\s*\.\s*getActiveShopIdsForUser\(account\.id\)/);
});
