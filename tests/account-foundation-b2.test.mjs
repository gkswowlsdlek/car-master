import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const normalize = (source) => source.replace(/\r\n?/g, "\n");

test("Transaction keeps an optional Shop id without changing legacy or Demo identity", async () => {
  const source = normalize(await read("types/transactions.ts"));
  assert.match(source, /shopId\?: string \| null/);
  // Dealer immediate-transaction Phase 1 made installerId nullable — a Shop
  // with no linked Installer Account is a valid transaction counterpart.
  assert.match(source, /installerId: string \| null;/);
  assert.match(source, /installerName: string;/);
  const demo = normalize(await read("repositories/demo-transaction-repository.ts"));
  assert.match(demo, /installer_id/);
  assert.doesNotMatch(demo, /shop_id/);
  assert.match(demo, /p_installer_id: value\.installerId/);
});

test("Real Supabase rows map both shop_id and legacy installer_id", async () => {
  const source = normalize(await read("repositories/supabase-transaction-repository.ts"));
  assert.match(source, /shop_id: string \| null/);
  assert.match(source, /shopId: row\.shop_id \?\? null/);
  assert.match(source, /installerId: row\.installer_id/);
  assert.match(source, /select\("id,dealer_id,installer_id,shop_id,installer_name/);
});

test("Legacy rows with null shop_id remain safe and runtime behavior stays legacy-based", async () => {
  const source = normalize(await read("repositories/supabase-transaction-repository.ts"));
  assert.match(source, /shopId: row\.shop_id \?\? null/);
  const installer = normalize(await read("components/workspaces/InstallerWorkspace.tsx"));
  const dealer = normalize(await read("components/workspaces/DealerWorkspace.tsx"));
  assert.match(installer, /item\.installerId === account\.shopId/);
  assert.doesNotMatch(installer, /item\.shopId === account\.shopId/);
  assert.match(dealer, /installerId: selectedShop\.id/);
});

test("B2 adds no Migration and does not alter RPC, RLS, authorization, or mutation paths", async () => {
  const files = await (await import("node:fs/promises")).readdir(new URL("../supabase/migrations/", import.meta.url));
  assert.equal(files.includes("202608090003_account_foundation_b2_transaction_shop_read.sql"), false);
  const repo = normalize(await read("repositories/supabase-transaction-repository.ts"));
  assert.match(repo, /rpc\("create_transaction_with_room"/);
  assert.match(repo, /rpc\("set_transaction_visibility"/);
  assert.match(repo, /rpc\("transition_transaction_stage"/);
});
