import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { defaultDemoCredentials, getDemoCredentials } from "../lib/demo-credentials.ts";

test("documented demo credentials remain available when overrides are configured", () => {
  const previous = process.env.CARMASTER_DEMO_DEALER_ID;
  process.env.CARMASTER_DEMO_DEALER_ID = "override-dealer";
  process.env.CARMASTER_DEMO_DEALER_PASSWORD = "override-password";
  try {
    const credentials = getDemoCredentials();
    assert.ok(credentials.some((item) => item.username === "1" && item.password === "1"));
    assert.ok(credentials.some((item) => item.username === "override-dealer" && item.password === "override-password"));
    assert.equal(defaultDemoCredentials.length, 3);
  } finally {
    if (previous === undefined) delete process.env.CARMASTER_DEMO_DEALER_ID;
    else process.env.CARMASTER_DEMO_DEALER_ID = previous;
    delete process.env.CARMASTER_DEMO_DEALER_PASSWORD;
  }
});

test("v0.3.6 migration hardens durable chat, stage transitions and orphan cleanup", async () => {
  const source = await readFile(new URL("../supabase/migrations/202607220001_v036_production_connection.sql", import.meta.url), "utf8");
  assert.match(source, /client_message_id/);
  assert.match(source, /guard_transaction_insert/);
  assert.match(source, /set_transaction_visibility/);
  assert.match(source, /set_transaction_final_price/);
  assert.match(source, /transition_transaction_payment/);
  assert.match(source, /transition_transaction_stage/);
  assert.match(source, /revoke update on public\.transactions from authenticated/);
  assert.match(source, /revoke update \(vehicle, service, pricing, schedule, stage, hidden_by_dealer, hidden_by_installer, last_message, updated_at\)/);
  assert.match(source, /drop policy if exists "transaction participants update"/);
  assert.match(source, /coalesce\(client_message_id, ''\) <> ''/);
  assert.match(source, /split_part\(attachment ->> 'storagePath', '\/', 1\) <> check_room_id::text/);
  assert.match(source, /attachment_room_id/);
  assert.match(source, /array_length\(parts, 1\) <> 3/);
  assert.match(source, /transaction attachments uploader cleanup/);
  assert.match(source, /chat_message_updates_room/);
});

test("Supabase transaction writes use role-aware RPCs instead of direct table updates", async () => {
  const repository = await readFile(new URL("../repositories/supabase-transaction-repository.ts", import.meta.url), "utf8");
  for (const rpc of ["set_transaction_visibility", "set_transaction_final_price", "transition_transaction_payment", "transition_transaction_stage"]) assert.match(repository, new RegExp(rpc));
  assert.doesNotMatch(repository, /from\("transactions"\)\.update/);
});

test("remote pending attachments are discarded when replaced, removed or send fails", async () => {
  const chat = await readFile(new URL("../components/transactions/TransactionChatWorkspace.tsx", import.meta.url), "utf8");
  assert.match(chat, /Promise\.allSettled\(previous\.map/);
  assert.match(chat, /provider\.discard\?\.\(item\)/);
  assert.match(chat, /pendingRef\.current = \[\]/);
});

test("transaction and chat controls expose stable E2E selectors", async () => {
  const management = await readFile(new URL("../components/transactions/TransactionManagementScreen.tsx", import.meta.url), "utf8");
  const chat = await readFile(new URL("../components/transactions/TransactionChatWorkspace.tsx", import.meta.url), "utf8");
  assert.match(management, /transaction-card-/);
  for (const testId of ["transaction-detail-", "chat-input", "chat-send-button", "file-upload-input", "start-work-button", "complete-work-button"]) assert.match(chat, new RegExp(testId));
});
