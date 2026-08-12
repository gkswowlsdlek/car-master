import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const normalize = (source) => source.replace(/\r\n?/g, "\n");

let migrationSource;
let stateServiceSource;
let repoSource;
let chatWorkspaceSource;
let managementScreenSource;
let outcomeModalSource;
let actionsHookSource;
let typesSource;
let legacyMigration;

test.before(async () => {
  migrationSource = normalize(await read("supabase/migrations/202608130004_transaction_lifecycle_completion.sql"));
  stateServiceSource = normalize(await read("services/transaction-state-service.ts"));
  repoSource = normalize(await read("repositories/supabase-transaction-repository.ts"));
  chatWorkspaceSource = normalize(await read("components/transactions/TransactionChatWorkspace.tsx"));
  managementScreenSource = normalize(await read("components/transactions/TransactionManagementScreen.tsx"));
  outcomeModalSource = normalize(await read("components/transactions/EndTransactionOutcomeModal.tsx"));
  actionsHookSource = normalize(await read("hooks/use-transaction-actions.ts"));
  typesSource = normalize(await read("types/transactions.ts"));
  legacyMigration = normalize(await read("supabase/migrations/202607260001_v039_transaction_workflow.sql"));
});

// Phase 5 — Work Stage (입고 전/작업 중/작업 완료/출고) vs Transaction
// Outcome (취소/시공불가) are conceptually distinct, but both reuse the
// existing transactions.stage text column — no parallel state system.

test("transition_transaction_stage (Phase 1) is left completely untouched — its existing 취소 special case keeps working exactly as before", () => {
  assert.doesNotMatch(migrationSource, /create or replace function public\.transition_transaction_stage/);
  assert.match(legacyMigration, /p_next_stage = '취소'/);
});

test("outcome_note is additive and nullable — no existing row is affected", () => {
  assert.match(migrationSource, /alter table public\.transactions add column outcome_note text;/);
  assert.doesNotMatch(migrationSource, /outcome_note text not null/);
});

test("end_transaction_outcome only accepts 취소/시공불가, never deletes anything, and shares the same dealer/shop-membership/admin authorization shape as the rest of the schema", () => {
  const fn = migrationSource.slice(migrationSource.indexOf("create or replace function public.end_transaction_outcome"), migrationSource.indexOf("revoke all on function public.end_transaction_outcome"));
  assert.match(fn, /if p_outcome not in \('취소', '시공불가'\) then/);
  assert.match(fn, /if current_transaction\.dealer_id <> auth\.uid\(\) then raise exception 'Transaction access denied';/);
  assert.match(fn, /current_transaction\.installer_id <> auth\.uid\(\)\s*\n\s*and not \(current_transaction\.shop_id is not null and public\.has_active_shop_membership\(current_transaction\.shop_id\)\)/);
  assert.doesNotMatch(fn, /delete from/i);
});

test("end_transaction_outcome refuses to re-end an already-terminated transaction, and writes a system chat message recording the outcome + note", () => {
  const fn = migrationSource.slice(migrationSource.indexOf("create or replace function public.end_transaction_outcome"), migrationSource.indexOf("revoke all on function public.end_transaction_outcome"));
  assert.match(fn, /if current_transaction\.stage in \('취소', '시공불가'\) then\s*\n\s*raise exception 'Transaction has already ended';/);
  assert.match(fn, /insert into public\.chat_messages \(room_id, sender_role, text\)/);
  assert.match(fn, /거래가 "' \|\| p_outcome \|\| '"로 종료되었습니다\./);
});

test("set_transaction_final_price now also allows the dealer (own transaction) and a shop-membership-connected operator, not just the legacy installer_id match", () => {
  const fn = migrationSource.slice(migrationSource.indexOf("create or replace function public.set_transaction_final_price"), migrationSource.indexOf("revoke all on function public.set_transaction_final_price"));
  assert.match(fn, /elsif caller_role = 'dealer'::public\.user_role then\s*\n\s*if target\.dealer_id <> auth\.uid\(\) then raise exception 'Transaction access denied';/);
  assert.match(fn, /elsif caller_role = 'installer'::public\.user_role then\s*\n\s*if target\.installer_id <> auth\.uid\(\)\s*\n\s*and not \(target\.shop_id is not null and public\.has_active_shop_membership\(target\.shop_id\)\)/);
});

test("set_transaction_final_price no longer force-blocks on stage — Product decision: never require the amount to unblock 출고, observe real omission rate first", () => {
  const fn = migrationSource.slice(migrationSource.indexOf("create or replace function public.set_transaction_final_price"), migrationSource.indexOf("revoke all on function public.set_transaction_final_price"));
  assert.doesNotMatch(fn, /Closed transactions cannot change price/);
  assert.doesNotMatch(fn, /target\.stage in \('작업완료', '취소'\)/);
});

test("set_transaction_final_price validates a positive integer-won amount within a sane ceiling — no NaN, no fractional won, no fabricated default", () => {
  const fn = migrationSource.slice(migrationSource.indexOf("create or replace function public.set_transaction_final_price"), migrationSource.indexOf("revoke all on function public.set_transaction_final_price"));
  assert.match(fn, /p_final_price is null or p_final_price <= 0 or p_final_price > 100000000 or p_final_price <> trunc\(p_final_price\)/);
});

test("set_transaction_final_price records a system message with the formatted amount, matching the room's existing audit-trail convention", () => {
  const fn = migrationSource.slice(migrationSource.indexOf("create or replace function public.set_transaction_final_price"), migrationSource.indexOf("revoke all on function public.set_transaction_final_price"));
  assert.match(fn, /최종 시공금액이 ' \|\| to_char\(p_final_price, 'FM999,999,999'\) \|\| '원으로 기록되었습니다\./);
});

test("both redefined functions keep the SECURITY DEFINER + empty search_path + revoke-then-grant convention, and use plain CREATE OR REPLACE (no signature/return-type change, so no drop needed)", () => {
  for (const name of ["end_transaction_outcome", "set_transaction_final_price"]) {
    const start = migrationSource.indexOf(`create or replace function public.${name}`);
    assert.ok(start >= 0, `expected public.${name} to be defined via CREATE OR REPLACE`);
    const body = migrationSource.slice(start, start + 700);
    assert.match(body, /security definer/);
    assert.match(body, /set search_path = ''/);
  }
  assert.doesNotMatch(migrationSource, /drop function/);
});

test("TransactionStage adds 시공불가 alongside the pre-existing 취소 — both documented as an outcome, not a work stage", () => {
  assert.match(typesSource, /"견적" \| "시공예약" \| "입고" \| "작업완료" \| "출고" \| "취소" \| "시공불가"/);
  assert.match(typesSource, /outcomeNote\?: string;/);
});

test("dealerStageLabel and dealerStageIndex explicitly handle 시공불가 — it must never silently fall through to the 출고 label", () => {
  assert.match(stateServiceSource, /if \(stage === "시공불가"\) return "시공 불가";/);
  assert.match(stateServiceSource, /export const TERMINAL_OUTCOME_STAGES: TransactionStage\[\] = \["취소", "시공불가"\];/);
  assert.match(stateServiceSource, /export function isTerminalOutcome\(stage: TransactionStage\): boolean \{\s*\n\s*return TERMINAL_OUTCOME_STAGES\.includes\(stage\);/);
});

test("canTransitionStage treats 시공불가 the same as 취소 (dealer/admin only) — this is what lets the Demo/local fallback path reuse the existing transitionStage machinery", () => {
  assert.match(stateServiceSource, /if \(next === "취소" \|\| next === "시공불가"\) return role === "dealer" \|\| role === "admin";/);
});

test("supabase-transaction-repository maps outcome_note and exposes endOutcome calling end_transaction_outcome, distinct from the untouched transitionStage/transition_transaction_stage call", () => {
  assert.match(repoSource, /outcome_note: string \| null;/);
  assert.match(repoSource, /outcomeNote: row\.outcome_note \?\? undefined,/);
  assert.match(repoSource, /async endOutcome\(transactionId: string, outcome: "취소" \| "시공불가", note\?: string\)/);
  assert.match(repoSource, /rpc\("end_transaction_outcome"/);
});

test("use-transaction-actions exposes a dedicated endOutcome (not routed through changeStage/transition_transaction_stage) across Real/Demo/local", () => {
  const fn = actionsHookSource.slice(actionsHookSource.indexOf("const endOutcome = useCallback"), actionsHookSource.indexOf("const changeFinalPrice"));
  assert.match(fn, /supabaseTransactionRepository\.endOutcome\(transaction\.id, outcome, note\)/);
  assert.match(fn, /transitionStage\(transaction, outcome, role === "shop" \? "shop" : "dealer"\)/);
  assert.match(actionsHookSource, /return \{ sendMessage, markRoomRead, loadContact, hideTransaction, unhideTransaction, changeStage, endOutcome, changeFinalPrice, changePayment \};/);
});

test("TransactionChatWorkspace hides the normal stage-advance controls once a transaction is terminated and shows a distinct outcome banner with the reason, instead of silently leaving the old CTA visible", () => {
  assert.match(chatWorkspaceSource, /const terminalOutcome = isTerminalOutcome\(transaction\.status\.stage\);/);
  assert.match(chatWorkspaceSource, /\{terminalOutcome \? <div className=\{`transaction-outcome-banner outcome-\$\{transaction\.status\.stage\}`\}>/);
  assert.match(chatWorkspaceSource, /transaction\.outcomeNote && <p>\{transaction\.outcomeNote\}<\/p>/);
});

test("TransactionChatWorkspace only lets role === dealer trigger 거래 취소 / 시공 불가 처리, and only while the transaction is still open", () => {
  assert.match(chatWorkspaceSource, /\{role === "dealer" && !terminalOutcome && <button onClick=\{\(\) => \{ setEndOutcomeModal\("취소"\); setMoreMenuOpen\(false\); \}\}>거래 취소<\/button>\}/);
  assert.match(chatWorkspaceSource, /\{role === "dealer" && !terminalOutcome && <button onClick=\{\(\) => \{ setEndOutcomeModal\("시공불가"\); setMoreMenuOpen\(false\); \}\}>시공 불가 처리<\/button>\}/);
});

test("최종 시공금액 input is available to both shop and dealer roles, unconditionally on stage, and is presented in its own clearly-labeled block separate from the pre-existing 결제 상태 flow (never conflated with payment/settlement)", () => {
  assert.match(chatWorkspaceSource, /<h4>최종 시공금액<\/h4>/);
  assert.match(chatWorkspaceSource, /\{\(role === "shop" \|\| role === "dealer"\) && <div><input value=\{finalPrice\}/);
  assert.match(chatWorkspaceSource, /<h4>결제 상태<\/h4>/);
  assert.doesNotMatch(chatWorkspaceSource, /<h4>결제 및 정산<\/h4>/);
});

test("advancing to 출고 with no final price nudges (not blocks) the dealer — both '나중에 입력' and '지금 입력' still let the transition proceed or open the price panel, never a hard stop", () => {
  assert.match(chatWorkspaceSource, /if \(forwardStage === "출고" && !transaction\.pricing\.finalPrice\) \{ setConfirmDispatchOpen\(true\); return; \}/);
  assert.match(chatWorkspaceSource, /confirmDispatch = \(\) => \{ setConfirmDispatchOpen\(false\); void runStageChange\("출고"\); \};/);
});

test("TransactionManagementScreen shows the same terminal-outcome banner, offers 거래 취소/시공 불가 for the dealer, and 다른 시공점 찾기 once terminated", () => {
  assert.match(managementScreenSource, /const selectedTerminalOutcome = selected \? isTerminalOutcome\(selected\.status\.stage\) : false;/);
  assert.match(managementScreenSource, /selectedTerminalOutcome && <div className=\{`transaction-outcome-banner/);
  assert.match(managementScreenSource, /role === "dealer" && selectedTerminalOutcome && onFindAnotherShop && <button className="primary" onClick=\{onFindAnotherShop\}>/);
});

test("EndTransactionOutcomeModal never silently retries — it surfaces the thrown error inline and keeps the dialog open on failure", () => {
  assert.match(outcomeModalSource, /catch \(err\) \{\s*\n\s*setError\(err instanceof Error \? err\.message : "처리하지 못했습니다\. 다시 시도해 주세요\."\);/);
});

test("regression: hide-transaction warnings across both room components now treat 시공불가 the same as 작업완료/출고/취소 (already-settled, not 진행 중)", () => {
  assert.match(chatWorkspaceSource, /!\["작업완료", "출고", "취소", "시공불가"\]\.includes\(transaction\.status\.stage\)/);
  assert.match(managementScreenSource, /!\["작업완료", "출고", "취소", "시공불가"\]\.includes\(selected\.status\.stage\)/);
});
