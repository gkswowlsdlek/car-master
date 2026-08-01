import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Installer Dashboard follows the 오늘 입고 -> 작업 중 -> 새 요청 -> 응답 대기 -> 오늘 완료 priority order and does not embed Messenger", async () => {
  const source = await read("components/shop/ShopDashboard.tsx");
  const order = ["오늘 입고", "작업 중", "새 요청", "응답 대기", "오늘 완료"];
  const positions = order.map((label) => source.indexOf(`<p className="eyebrow">${label}</p>`));
  for (const position of positions) assert.ok(position >= 0, "expected each priority section to be present");
  for (let i = 1; i < positions.length; i++) assert.ok(positions[i] > positions[i - 1], `${order[i]} should render after ${order[i - 1]}`);
  assert.doesNotMatch(source, /TransactionChatWorkspace/);
  assert.match(source, /onOpenMessage/);
  assert.match(source, /STAGE_ACTION_LABEL\["입고"\]/);
  assert.match(source, /STAGE_ACTION_LABEL\["작업완료"\]/);
});

test("새 요청 vs 응답 대기 is derived from existing room message data, not a new schema field", async () => {
  const source = await read("components/shop/ShopDashboard.tsx");
  assert.match(source, /senderRole === "shop"/);
  const migration = await read("supabase/migrations/202608010001_v0312_installer_workspace.sql");
  assert.doesNotMatch(migration, /acknowledged_at|is_acknowledged|reviewed_at/);
});

test("Installer Dashboard CTA hit targets are >=44px", async () => {
  const source = await read("app/globals.css");
  assert.match(source, /\.installer-vehicle-actions \.secondary \{[^}]*width: 44px;[^}]*height: 44px;/);
  assert.match(source, /\.installer-vehicle-actions \.primary \{[^}]*min-height: 44px;/);
});

test("Demo transaction backend mirrors the real RPC surface and stays actor-role gated", async () => {
  const migration = await read("supabase/migrations/202608010001_v0312_installer_workspace.sql");
  for (const fn of ["demo_create_transaction_with_room", "demo_transition_transaction_stage", "demo_set_transaction_final_price", "demo_transition_transaction_payment", "demo_set_transaction_visibility"]) {
    assert.match(migration, new RegExp(`function public\\.${fn}`));
  }
  // Dealer cannot progress the work stage (mirrors transaction-state-service.ts's canTransitionStage).
  assert.match(migration, /p_actor_role not in \('shop', 'admin'\)/);
  // No table-level insert/update/delete grant to anon — every mutation is RPC-only, matching the real `transactions` invariant.
  assert.doesNotMatch(migration, /grant insert on public\.demo_transactions/);
  assert.doesNotMatch(migration, /grant update on public\.demo_transactions/);
  assert.doesNotMatch(migration, /grant delete on public\.demo_transactions/);
  // Physical isolation from real data — no FK to transactions/transaction_rooms/profiles/auth.users.
  assert.doesNotMatch(migration, /references public\.transactions/);
  assert.doesNotMatch(migration, /references public\.profiles/);
  assert.doesNotMatch(migration, /references auth\.users/);
});

test("Demo transaction repository degrades to false (not a throw) when the schema isn't ready", async () => {
  const source = await read("repositories/demo-transaction-repository.ts");
  assert.match(source, /SCHEMA_MISSING_CODES/);
  assert.match(source, /catch \{\s*return false;/);
  assert.match(source, /isSupabaseConfigured/);
});

test("use-transaction-store falls back to localStorage transactions until the shared Demo schema is confirmed ready", async () => {
  const source = await read("hooks/use-transaction-store.ts");
  assert.match(source, /demoTransactionRepository\.isSchemaReady\(\)/);
  assert.match(source, /async function loadDemoTransactions\(schemaReady/);
  assert.match(source, /if \(!schemaReady\) return local;/);
});

test("page.tsx only calls the shared Demo repository once the schema is confirmed ready, and real Supabase transaction calls are unchanged", async () => {
  const source = await read("app/page.tsx");
  assert.match(source, /const useDemoSharedBackend = !useSupabaseData && demoSchemaReady === true;/);
  assert.match(source, /demoTransactionRepository\.createWithRoom/);
  assert.match(source, /demoTransactionRepository\.transitionStage/);
  assert.match(source, /demoTransactionRepository\.setFinalPrice/);
  assert.match(source, /demoTransactionRepository\.transitionPayment/);
  assert.match(source, /demoTransactionRepository\.setVisibility/);
  // Real (useSupabaseData) branches are unchanged from before v0.3.12.
  assert.match(source, /supabaseTransactionRepository\.createWithRoom/);
  assert.match(source, /supabaseTransactionRepository\.transitionStage/);
});
