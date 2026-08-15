import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Installer Dashboard follows the 오늘 입고 -> 작업 중 -> 새 요청 -> 확인 필요 -> 오늘 완료 priority order and does not embed Messenger", async () => {
  const source = await read("components/shop/ShopDashboard.tsx");
  const order = ["오늘 입고", "작업 중", "새 요청", "확인 필요", "오늘 완료"];
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

test("InstallerWorkspace owns Installer selection, derived transaction scope, Messenger fullscreen, and all four Installer screens", async () => {
  const source = await read("components/workspaces/InstallerWorkspace.tsx");
  const page = await read("app/page.tsx");
  assert.match(source, /const \[selectedTransactionId, setSelectedTransactionId\] = useState\(""\)/);
  assert.match(source, /const \[mobileChatOpen, setMobileChatOpen\] = useState\(false\)/);
  assert.match(source, /shopManagementRepository\.getActiveShopIdsForUser\(account\.id\)/);
  assert.match(source, /if \(item\.shopId\) return activeShopIds\.includes\(item\.shopId\)/);
  assert.match(source, /item\.installerId === legacyInstallerId/);
  assert.match(source, /const activeTransactionId = selectedTransactionId \|\| roleTransactions\[0\]\?\.id \|\| ""/);
  assert.match(source, /onMobileFullscreenChange\(mobileChatOpen\)/);
  for (const screen of ["shopDashboard", "shopRequests", "messages", "dealerProfile"]) assert.match(source, new RegExp(`screen === "${screen}"`));
  for (const component of ["ShopDashboard", "TransactionManagementScreen", "MessengerScreen", "ShopManagementScreen"]) assert.match(source, new RegExp(`<${component}`));
  for (const action of ["onSend", "onHide", "onUnhide", "onFinalPriceChange", "onStageChange", "onPaymentChange", "onMarkRead", "onLoadContact"]) assert.match(source, new RegExp(`${action}=`));
  assert.match(page, /<InstallerWorkspace/);
  assert.doesNotMatch(page, /import \{ ShopDashboard \}/);
  assert.doesNotMatch(page, /<ShopDashboard/);
});

test("page delegates each role's detailed screen composition to its workspace", async () => {
  const page = await read("app/page.tsx");
  const adminWorkspace = await read("components/workspaces/AdminWorkspace.tsx");

  for (const workspace of ["DealerWorkspace", "InstallerWorkspace", "AdminWorkspace"]) {
    assert.match(page, new RegExp(`<${workspace}`));
  }
  for (const component of ["DealerDashboard", "ShopDashboard", "AdminOverview", "AdminAccountScreen"]) {
    assert.doesNotMatch(page, new RegExp(`import \\{ ${component} \\}`));
    assert.doesNotMatch(page, new RegExp(`<${component}`));
  }
  assert.match(adminWorkspace, /screen === "ops"/);
  assert.match(adminWorkspace, /<AdminOverview/);
  assert.match(adminWorkspace, /screen === "adminAccount"/);
  assert.match(adminWorkspace, /<AdminAccountScreen/);
  assert.match(adminWorkspace, /demoAccounts\.some\(\(item\) => item\.id === account\.id\)/);
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

test("page delegates shared actions and DealerWorkspace owns createTransaction while all Real, Shared Demo, and Local contracts stay intact", async () => {
  const page = await read("app/page.tsx");
  const dealerWorkspace = await read("components/workspaces/DealerWorkspace.tsx");
  const actions = await read("hooks/use-transaction-actions.ts");
  const store = await read("hooks/use-transaction-store.ts");
  assert.match(page, /const useDemoSharedBackend = !useSupabaseData && demoSchemaReady === true;/);
  assert.match(page, /useTransactionActions\(\{ useSupabaseData, transactions, sharedRoomIds, demoActorId: account\.id, role, refresh \}\)/);
  assert.match(page, /<DealerWorkspace/);
  assert.doesNotMatch(page, /import \{ DealerDashboard \}/);
  assert.doesNotMatch(page, /<DealerDashboard/);
  assert.match(dealerWorkspace, /demoTransactionRepository\.createWithRoom/);
  // Dealer immediate-transaction Phase 1: the Real/Supabase path moved from
  // the legacy installerId-keyed createWithRoom to the Shop-centric
  // createWithShopRoom (works for Shops with no linked Installer Account) —
  // Demo is untouched, still createWithRoom, see the assertion above.
  assert.match(dealerWorkspace, /supabaseTransactionRepository\.createWithShopRoom/);
  assert.match(dealerWorkspace, /transactionRepository\.create\(transaction\); chatRepository\.create\(room\)/);
  assert.match(dealerWorkspace, /await onRefresh\(\)/);
  assert.match(dealerWorkspace, /notificationService\.notify\(\{ type: "new_service_request"/);

  for (const mutation of ["transitionStage", "setFinalPrice", "transitionPayment", "setVisibility"]) {
    assert.match(actions, new RegExp(`demoTransactionRepository\\.${mutation}`));
    assert.doesNotMatch(page, new RegExp(`demoTransactionRepository\\.${mutation}`));
  }
  for (const mutation of ["transitionStage", "setFinalPrice", "transitionPayment", "setVisibility", "getContact"]) {
    assert.match(actions, new RegExp(`supabaseTransactionRepository\\.${mutation}`));
  }
  assert.match(actions, /supabaseChatRepository\.addMessage/);
  assert.match(actions, /demoChatRepository\.addMessage/);
  assert.match(actions, /chatRepository\.addMessage/);
  assert.match(actions, /transactionRepository\.update/);
  assert.match(actions, /supabaseChatRepository\.markRead/);
  assert.match(actions, /demoChatRepository\.markRead/);
  assert.doesNotMatch(store, /const markRoomRead/);
  assert.match(actions, /await refresh\(\)/);
  assert.match(actions, /notificationService\.notify/);
  assert.match(actions, /const demoActorRole: "dealer" \| "shop" \| "admin" = role === "shop" \? "shop" : role === "admin" \? "admin" : "dealer"/);
  assert.match(actions, /transitionStage\(transaction, stage, role === "shop" \? "shop" : "dealer"\)/);
  assert.match(actions, /transitionPayment\(transaction, status, role === "admin" \? "admin" : role\)/);
  for (const message of ["메시지를 전송하지 못했습니다.", "거래를 숨길 수 없습니다.", "숨김을 해제할 수 없습니다.", "최종 금액을 저장할 수 없습니다.", "결제 상태를 변경할 수 없습니다."]) {
    assert.match(actions, new RegExp(message.replace(".", "\\.")));
  }
  for (const action of ["sendMessage", "markRoomRead", "loadContact", "hideTransaction", "unhideTransaction", "changeStage", "changeFinalPrice", "changePayment"]) {
    assert.match(actions, new RegExp(`const ${action} = useCallback`));
  }
});
