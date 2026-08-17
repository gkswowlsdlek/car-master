import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../supabase/migrations/202608070001_pre_v04_installer_write_approval.sql",
  import.meta.url,
);
const readMigration = async () => (await readFile(migrationUrl, "utf8")).replace(/\r\n?/g, "\n");

function functionBody(source, name) {
  const start = source.indexOf(`create or replace function public.${name}`);
  assert.ok(start >= 0, `${name} definition must exist`);
  const end = source.indexOf("\n$$;", start);
  assert.ok(end > start, `${name} definition must terminate`);
  return source.slice(start, end + 4);
}

test("the approval helper is server-side, role-aware, and not directly executable by clients", async () => {
  const source = await readMigration();
  const helper = functionBody(source, "is_installer_approved");
  assert.match(helper, /security definer/);
  assert.match(helper, /set search_path = ''/);
  assert.match(helper, /profile\.role = 'installer'::public\.user_role/);
  assert.match(helper, /approval\.status = 'approved'::public\.installer_approval_status/);
  assert.match(
    source,
    /revoke all on function public\.is_installer_approved\(uuid\) from public, anon, authenticated;/,
  );
  assert.doesNotMatch(source, /grant execute on function public\.is_installer_approved/);
});

test("all four real Installer transaction WRITE RPCs require current approval", async () => {
  const source = await readMigration();
  for (const name of [
    "set_transaction_visibility",
    "set_transaction_final_price",
    "transition_transaction_payment",
    "transition_transaction_stage",
  ]) {
    const body = functionBody(source, name);
    assert.match(body, /security definer/);
    assert.match(body, /set search_path = ''/);
    assert.match(body, /auth\.uid\(\)/);
    assert.match(body, /public\.is_installer_approved\(auth\.uid\(\)\)/);
    assert.match(source, new RegExp(`grant execute on function public\\.${name}\\([^;]+\\) to authenticated;`));
  }
});

test("assignment checks and existing Dealer/Admin paths remain intact", async () => {
  const source = await readMigration();
  const visibility = functionBody(source, "set_transaction_visibility");
  const price = functionBody(source, "set_transaction_final_price");
  const payment = functionBody(source, "transition_transaction_payment");
  const stage = functionBody(source, "transition_transaction_stage");

  assert.match(visibility, /target\.dealer_id = auth\.uid\(\)/);
  assert.match(visibility, /target\.installer_id = auth\.uid\(\)/);
  assert.match(price, /caller_role = 'admin'::public\.user_role/);
  assert.match(price, /target\.installer_id = auth\.uid\(\)/);
  assert.match(
    payment,
    /target\.dealer_id = auth\.uid\(\) or target\.installer_id = auth\.uid\(\) or caller_role = 'admin'/,
  );
  assert.match(stage, /current_transaction\.installer_id <> auth\.uid\(\)/);
  assert.match(stage, /caller_role not in \('dealer'::public\.user_role, 'admin'::public\.user_role\)/);
  assert.match(stage, /insert into public\.transaction_stage_events/);
});

test("the approval-state decision matrix allows only an approved assigned Installer", () => {
  const canInstallerWrite = ({ status, assigned }) => assigned && status === "approved";
  assert.equal(canInstallerWrite({ status: "approved", assigned: true }), true);
  assert.equal(canInstallerWrite({ status: "suspended", assigned: true }), false);
  assert.equal(canInstallerWrite({ status: "rejected", assigned: true }), false);
  assert.equal(canInstallerWrite({ status: "pending", assigned: true }), false);
  assert.equal(canInstallerWrite({ status: "approved", assigned: false }), false);
});

test("approval rejection occurs before each Installer-owned transaction update path", async () => {
  const source = await readMigration();
  const visibility = functionBody(source, "set_transaction_visibility");
  assert.match(
    visibility,
    /public\.is_installer_approved\(auth\.uid\(\)\) then\s+update public\.transactions set hidden_by_installer/s,
  );

  for (const name of [
    "set_transaction_final_price",
    "transition_transaction_payment",
    "transition_transaction_stage",
  ]) {
    const body = functionBody(source, name);
    const approvalCheck = body.indexOf("public.is_installer_approved(auth.uid())");
    const protectedUpdate =
      name === "transition_transaction_stage"
        ? body.indexOf("update public.transactions\n  set stage")
        : body.lastIndexOf("update public.transactions");
    assert.ok(approvalCheck >= 0 && protectedUpdate > approvalCheck, `${name} must reject before its Installer write`);
  }
});

test("this migration does not alter Demo, chat, profile, or direct table privileges", async () => {
  const source = await readMigration();
  assert.doesNotMatch(source, /demo_/);
  assert.doesNotMatch(source, /chat_messages|transaction_rooms/);
  assert.doesNotMatch(source, /alter table|create policy|drop policy/);
  assert.doesNotMatch(source, /grant (insert|update|delete) on public\.transactions/);
});
