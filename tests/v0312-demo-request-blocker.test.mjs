import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the real-only approved-installer alert is strictly inside the useSupabaseData branch, not reachable from Demo", async () => {
  const source = await read("app/page.tsx");
  const alertLine = source.split("\n").find((line) => line.includes("관리자에게 승인된 시공점을 선택해 주세요"));
  assert.ok(alertLine, "expected the alert to still exist for real dealers");

  const createTransactionBody = source.slice(source.indexOf("const createTransaction = async"), source.indexOf("const notifyNewMessage"));
  const supabaseBranchStart = createTransactionBody.indexOf("if (useSupabaseData) {");
  const demoBranchStart = createTransactionBody.indexOf("if (useDemoSharedBackend) {");
  const alertIndex = createTransactionBody.indexOf("관리자에게 승인된 시공점을 선택해 주세요");
  assert.ok(supabaseBranchStart >= 0 && demoBranchStart > supabaseBranchStart, "expected useSupabaseData branch to come before useDemoSharedBackend branch");
  assert.ok(alertIndex > supabaseBranchStart && alertIndex < demoBranchStart, "the approval alert must live strictly inside the useSupabaseData branch, before the Demo branch begins");
});

test("Demo Dealer creates transactions through demoTransactionRepository, never through approvedInstallerShops", async () => {
  const source = await read("app/page.tsx");
  const createTransactionBody = source.slice(source.indexOf("const createTransaction = async"), source.indexOf("const notifyNewMessage"));
  const demoBranch = createTransactionBody.slice(createTransactionBody.indexOf("if (useDemoSharedBackend) {"));
  assert.match(demoBranch, /demoTransactionRepository\.createWithRoom/);
  assert.doesNotMatch(demoBranch, /approvedInstallerShops/);
});

test("demo login explicitly signs out of any leftover real Supabase session before entering Demo", async () => {
  const source = await read("app/page.tsx");
  const authenticateBody = source.slice(source.indexOf("const authenticate = useCallback"), source.indexOf("const signUp = useCallback"));
  const demoSuccessBranch = authenticateBody.slice(authenticateBody.indexOf("if (demoResponse.ok) {"), authenticateBody.indexOf("if (demoResponse.status !== 401)"));
  assert.match(demoSuccessBranch, /authProvider\.logout\(\)/, "authenticate()'s demo branch must sign out of any real session before login(demoAccount)");

  const firstDemoOkBranch = source.indexOf("if (demoResponse.ok) {");
  const secondDemoOkBranch = source.indexOf("if (demoResponse.ok) {", firstDemoOkBranch + 1);
  assert.ok(secondDemoOkBranch > firstDemoOkBranch, "expected a second demoResponse.ok branch in the bootstrap effect");
  const bootstrapDemoBranch = source.slice(secondDemoOkBranch, secondDemoOkBranch + 600);
  assert.match(bootstrapDemoBranch, /authProvider\.logout\(\)/, "the page-load bootstrap effect's demo branch must also sign out of any real session before login(demoAccount, true)");
});

test("canonical Demo installer id (미사 스타힐스 시공점 = SHOP-MISA-001) is consistent across the directory fixture and demo account data", async () => {
  const directory = await read("data/installer-directory-demo.ts");
  const accounts = await read("data/demo-accounts.ts");
  assert.match(directory, /id:\s*"SHOP-MISA-001"[^}]*name:\s*"미사 스타힐스 시공점"/s);
  assert.match(accounts, /shopId:\s*"SHOP-MISA-001"/);
});

test("migration seeds demo_chat_rooms before demo_transactions (FK-safe on a fresh database)", async () => {
  const migration = await read("supabase/migrations/202608010001_v0312_installer_workspace.sql");
  const roomsSeedIndex = migration.indexOf("insert into public.demo_chat_rooms (id, transaction_id, created_at, updated_at)");
  const transactionsSeedIndex = migration.indexOf("insert into public.demo_transactions (id, dealer_id");
  assert.ok(roomsSeedIndex >= 0 && transactionsSeedIndex >= 0, "expected both seed inserts to exist");
  assert.ok(roomsSeedIndex < transactionsSeedIndex, "demo_chat_rooms seed must run before demo_transactions seed, since chat_room_id is a not-null FK");
});

test("Real Dealer approval-gate wording and RPC are unchanged", async () => {
  const source = await read("app/page.tsx");
  assert.match(source, /supabaseTransactionRepository\.createWithRoom/);
  const migration = await read("supabase/migrations/202608010001_v0312_installer_workspace.sql");
  assert.doesNotMatch(migration, /alter table public\.transactions/);
  assert.doesNotMatch(migration, /alter table public\.installer_approvals/);
});
