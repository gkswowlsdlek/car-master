import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Demo transaction/room ids are namespaced distinctly from Real ids", async () => {
  const migration = await read("supabase/migrations/202608010001_v0312_installer_workspace.sql");
  // Demo ids: CM-DEMO-NNNN / CHAT-CM-DEMO-NNNN — never overlaps Real's CM-YYYYMMDD-NNNN.
  assert.match(migration, /'CM-DEMO-' \|\| lpad\(nextval/);
  assert.match(migration, /'CHAT-' \|\| transaction_id/);
  const realMigration = await read("supabase/migrations/202607260001_v039_transaction_workflow.sql");
  assert.match(realMigration, /'CM-' \|\| to_char\(now\(\), 'YYYYMMDD'\)/);
});

test("Transaction Management now offers a Final Price save action for shop role, wired through the existing RPC-backed callback", async () => {
  const source = await read("components/transactions/TransactionManagementScreen.tsx");
  assert.match(source, /onFinalPriceChange\(selected, value\)/);
  assert.doesNotMatch(source, /\.from\("transactions"\)\.update/);
  assert.doesNotMatch(source, /\.from\("demo_transactions"\)\.update/);
});

test("Installer Dashboard shows a safe Demo dealer company name without any new broad profile access", async () => {
  const source = await read("components/shop/ShopDashboard.tsx");
  assert.match(source, /dealerId === "hanjaejin-dealer" \? defaultDealerCompanyName : "담당 딜러"/);
  assert.doesNotMatch(source, /get_transaction_contact\(/);
  assert.doesNotMatch(source, /\.from\("profiles"\)/);
});
