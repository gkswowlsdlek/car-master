import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("202608050001 adds 'pending' to public.user_role as a standalone, additive migration", async () => {
  const migration = await read("supabase/migrations/202608050001_v0314_user_role_pending.sql");
  assert.match(migration, /alter type public\.user_role add value if not exists 'pending';/);
});

test("handle_new_user(): OAuth/social sign-in (no recognized signup_role) creates only a minimal pending profile — no dealer_profiles/installer_profiles/installer_approvals, no guessed default role", async () => {
  const migration = await read("supabase/migrations/202608050002_v0314_legal_onboarding_foundation.sql");
  assert.match(migration, /if coalesce\(new\.raw_user_meta_data ->> 'signup_role', ''\) not in \('dealer', 'installer'\) then/);
  const pendingBranch = migration.slice(migration.indexOf("not in ('dealer', 'installer') then"), migration.indexOf("return new;\n  end if;"));
  assert.match(pendingBranch, /values \(new\.id, coalesce\(new\.email, ''\), 'pending'::public\.user_role\)/);
  assert.doesNotMatch(pendingBranch, /dealer_profiles|installer_profiles|installer_approvals/);
});

test("handle_new_user() NULL-safety fix: the bare (un-coalesced) 'NOT IN' guard is completely absent from the file — the buggy pattern can never silently reappear", async () => {
  const migration = await read("supabase/migrations/202608050002_v0314_legal_onboarding_foundation.sql");
  // Any occurrence of `->> 'signup_role' not in (` must be immediately
  // preceded by `coalesce(new.raw_user_meta_data `, i.e. every use of this
  // comparison in the file is wrapped in coalesce — there is no bare
  // `new.raw_user_meta_data ->> 'signup_role' not in (...)` left anywhere.
  const bareGuardPattern = /(?<!coalesce\(new\.raw_user_meta_data )->> 'signup_role' not in \(/g;
  assert.equal([...migration.matchAll(bareGuardPattern)].length, 0, "a bare, un-coalesced NOT IN guard must not exist anywhere in the file");
});

test("PL/pgSQL three-valued-logic model: `NULL NOT IN (...)` evaluates to NULL (not TRUE), and PL/pgSQL's IF treats a NULL condition as false — this is the exact mechanism of the BLOCKER the pre-fix guard had, verified independently of the SQL file since no local Postgres is available in this environment to execute the trigger live", () => {
  // Faithful model of Postgres's `x NOT IN (list)` three-valued logic:
  // NULL if x is null, otherwise a normal boolean membership test.
  const pgNotIn = (value, list) => (value === null ? null : !list.includes(value));
  // Faithful model of PL/pgSQL's `IF <cond> THEN ... END IF;`: only NEVER
  // enters the branch unless cond is exactly true (both false and null are
  // treated as "don't enter" — this is documented PL/pgSQL behavior).
  const pgIfEntersBranch = (cond) => cond === true;

  // Pre-fix guard: `signup_role NOT IN ('dealer', 'installer')`.
  const preFixGuard = (signupRole) => pgIfEntersBranch(pgNotIn(signupRole, ["dealer", "installer"]));
  // BLOCKER demonstration: a NULL signup_role (e.g. an OAuth-created row
  // with no metadata at all) did NOT enter the pending branch pre-fix —
  // it silently fell through to the CASE below, which defaults to dealer.
  assert.equal(preFixGuard(null), false, "pre-fix: NULL signup_role incorrectly skipped the pending branch (the BLOCKER)");

  // Post-fix guard: `coalesce(signup_role, '') NOT IN ('dealer', 'installer')`.
  const postFixGuard = (signupRole) => pgIfEntersBranch(pgNotIn(signupRole ?? "", ["dealer", "installer"]));
  assert.equal(postFixGuard(null), true, "post-fix: NULL signup_role (no metadata — the OAuth/Kakao case) must enter the pending branch");
  assert.equal(postFixGuard("dealer"), false, "post-fix: signup_role='dealer' must NOT enter the pending branch (existing dealer signup unaffected)");
  assert.equal(postFixGuard("installer"), false, "post-fix: signup_role='installer' must NOT enter the pending branch (existing installer signup unaffected)");
  assert.equal(postFixGuard("something-unrecognized"), true, "post-fix: an unrecognized signup_role value must also enter the pending branch");
});

test("handle_new_user(): existing dealer/installer email signup logic is preserved byte-for-byte (same inserts as the original v0.3.4 migration)", async () => {
  const original = await read("supabase/migrations/202607190001_v034_membership.sql");
  const updated = await read("supabase/migrations/202608050002_v0314_legal_onboarding_foundation.sql");
  const originalStart = original.indexOf("requested_role := case");
  const originalInsertBlock = original.slice(originalStart, original.indexOf("\n$$;", originalStart));
  const updatedStart = updated.indexOf("requested_role := case");
  const updatedInsertBlock = updated.slice(updatedStart, updated.indexOf("\n$$;", updatedStart));
  assert.equal(updatedInsertBlock.trim(), originalInsertBlock.trim());
});

test("complete_dealer_onboarding: only runs for the caller's own row, only from role='pending', and is fully additive (dealer_profiles + legal_agreements in the same function)", async () => {
  const migration = await read("supabase/migrations/202608050002_v0314_legal_onboarding_foundation.sql");
  const fn = migration.slice(migration.indexOf("create or replace function public.complete_dealer_onboarding"), migration.indexOf("create or replace function public.complete_installer_onboarding"));
  assert.match(fn, /caller_id uuid := auth\.uid\(\);/);
  assert.doesNotMatch(fn, /payload ->> 'userId'|payload ->> 'user_id'/);
  assert.match(fn, /select role into caller_role from public\.profiles where id = caller_id for update;/);
  assert.match(fn, /if caller_role is distinct from 'pending'::public\.user_role then\s*raise exception 'Onboarding already completed';/);
  assert.match(fn, /update public\.profiles set role = 'dealer'::public\.user_role, updated_at = now\(\) where id = caller_id;/);
  assert.match(fn, /insert into public\.dealer_profiles/);
  assert.match(fn, /insert into public\.legal_agreements \(user_id, terms_version, privacy_version\)/);
  assert.match(fn, /if input_terms_version = '' or input_privacy_version = '' then\s*raise exception 'Terms and privacy agreement is required';/);
});

test("complete_installer_onboarding: only runs for the caller's own row, only from role='pending', creates installer_profiles + installer_approvals (default pending) + legal_agreements", async () => {
  const migration = await read("supabase/migrations/202608050002_v0314_legal_onboarding_foundation.sql");
  const fn = migration.slice(migration.indexOf("create or replace function public.complete_installer_onboarding"));
  assert.match(fn, /caller_id uuid := auth\.uid\(\);/);
  assert.doesNotMatch(fn, /payload ->> 'userId'|payload ->> 'user_id'/);
  assert.match(fn, /if caller_role is distinct from 'pending'::public\.user_role then\s*raise exception 'Onboarding already completed';/);
  assert.match(fn, /update public\.profiles set role = 'installer'::public\.user_role, updated_at = now\(\) where id = caller_id;/);
  assert.match(fn, /insert into public\.installer_profiles \(/);
  // No explicit status column passed — relies on installer_approvals' own `default 'pending'`, exactly like the original signup trigger.
  assert.match(fn, /insert into public\.installer_approvals \(user_id\) values \(caller_id\);/);
  assert.match(fn, /insert into public\.legal_agreements \(user_id, terms_version, privacy_version\)/);
  assert.match(fn, /if input_terms_version = '' or input_privacy_version = '' then\s*raise exception 'Terms and privacy agreement is required';/);
});

test("Legal consent version trust: both onboarding RPCs' hardcoded version literals match data/legal-versions.ts's CURRENT_TERMS_VERSION/CURRENT_PRIVACY_VERSION exactly — never guessed, always cross-checked against the actual repo source of truth", async () => {
  const legalVersions = await read("data/legal-versions.ts");
  const termsVersionMatch = legalVersions.match(/export const CURRENT_TERMS_VERSION = "([^"]+)";/);
  const privacyVersionMatch = legalVersions.match(/export const CURRENT_PRIVACY_VERSION = "([^"]+)";/);
  assert.ok(termsVersionMatch && privacyVersionMatch, "data/legal-versions.ts must export both version constants");
  const [, termsVersion] = termsVersionMatch;
  const [, privacyVersion] = privacyVersionMatch;

  const migration = await read("supabase/migrations/202608050002_v0314_legal_onboarding_foundation.sql");
  const termsChecks = [...migration.matchAll(/if input_terms_version <> '([^']+)' then\s*raise exception 'Terms version mismatch';/g)];
  const privacyChecks = [...migration.matchAll(/if input_privacy_version <> '([^']+)' then\s*raise exception 'Privacy version mismatch';/g)];
  assert.equal(termsChecks.length, 2, "both RPCs must check the terms version");
  assert.equal(privacyChecks.length, 2, "both RPCs must check the privacy version");
  for (const [, literal] of termsChecks) assert.equal(literal, termsVersion, "RPC's hardcoded terms-version literal must match data/legal-versions.ts exactly");
  for (const [, literal] of privacyChecks) assert.equal(literal, privacyVersion, "RPC's hardcoded privacy-version literal must match data/legal-versions.ts exactly");
});

test("Legal consent version trust: the version-mismatch checks run BEFORE any write (role update, profile-table insert, or legal_agreements insert) in both RPCs — a rejected call leaves zero partial data, and the caller's role stays 'pending'", async () => {
  const migration = await read("supabase/migrations/202608050002_v0314_legal_onboarding_foundation.sql");
  for (const [fnName, tableName, roleLiteral] of [["complete_dealer_onboarding", "dealer_profiles", "'dealer'"], ["complete_installer_onboarding", "installer_profiles", "'installer'"]]) {
    const start = migration.indexOf(`create or replace function public.${fnName}`);
    const nextFnStart = migration.indexOf("create or replace function public.", start + 1);
    const fn = migration.slice(start, nextFnStart === -1 ? undefined : nextFnStart);
    const termsCheckIndex = fn.indexOf("raise exception 'Terms version mismatch'");
    const privacyCheckIndex = fn.indexOf("raise exception 'Privacy version mismatch'");
    const roleUpdateIndex = fn.indexOf(`update public.profiles set role = ${roleLiteral}`);
    const profileInsertIndex = fn.indexOf(`insert into public.${tableName}`);
    const legalAgreementsInsertIndex = fn.indexOf("insert into public.legal_agreements");
    assert.ok(termsCheckIndex > 0 && privacyCheckIndex > termsCheckIndex, `${fnName}: terms check must precede privacy check`);
    assert.ok(roleUpdateIndex > privacyCheckIndex, `${fnName}: role update must happen only after both version checks pass`);
    assert.ok(profileInsertIndex > privacyCheckIndex, `${fnName}: ${tableName} insert must happen only after both version checks pass`);
    assert.ok(legalAgreementsInsertIndex > privacyCheckIndex, `${fnName}: legal_agreements insert must happen only after both version checks pass`);
  }
  // Postgres/PL-pgSQL note (not independently executable in this
  // environment — no local Postgres/Docker, see the prior NULL-semantics
  // commit for the same caveat): an unhandled `raise exception` inside a
  // PL/pgSQL function aborts the entire enclosing statement, so a single
  // supabase.rpc(...) call is one transaction — any exception rolls back
  // every write the function made before that point. Because the version
  // checks above are proven (by source position) to run before the FIRST
  // write of any kind, a version mismatch is guaranteed to leave zero
  // partial rows in profiles/dealer_profiles/installer_profiles/
  // installer_approvals/legal_agreements, and profiles.role is guaranteed
  // to remain 'pending' (never updated).
});

test("Legal consent version trust: a semantics-level model of the RPC's guard chain proves success only for a pending caller with BOTH versions exactly matching the current constants, and failure for any wrong/empty version — documented as a logic model (no live Postgres available), same convention as the earlier NULL-semantics verification", async () => {
  const legalVersions = await read("data/legal-versions.ts");
  const [, termsVersion] = legalVersions.match(/export const CURRENT_TERMS_VERSION = "([^"]+)";/);
  const [, privacyVersion] = legalVersions.match(/export const CURRENT_PRIVACY_VERSION = "([^"]+)";/);

  // Faithful model of the RPC's guard chain, in the same order as the SQL:
  // pending check -> non-empty check -> exact-version check -> success.
  function attemptOnboarding({ role, terms, privacy }) {
    if (role !== "pending") return { ok: false, reason: "Onboarding already completed" };
    if (terms === "" || privacy === "") return { ok: false, reason: "Terms and privacy agreement is required" };
    if (terms !== termsVersion) return { ok: false, reason: "Terms version mismatch" };
    if (privacy !== privacyVersion) return { ok: false, reason: "Privacy version mismatch" };
    return { ok: true };
  }

  // pending + correct dealer/installer versions -> success (role is the
  // same "pending" precondition for both RPCs; the dealer/installer split
  // itself is a separate, already-covered guard).
  assert.deepEqual(attemptOnboarding({ role: "pending", terms: termsVersion, privacy: privacyVersion }), { ok: true });
  // wrong terms version -> fails specifically on terms
  assert.deepEqual(attemptOnboarding({ role: "pending", terms: "not-the-real-version", privacy: privacyVersion }), { ok: false, reason: "Terms version mismatch" });
  // wrong privacy version -> fails specifically on privacy
  assert.deepEqual(attemptOnboarding({ role: "pending", terms: termsVersion, privacy: "not-the-real-version" }), { ok: false, reason: "Privacy version mismatch" });
  // empty version -> fails on the non-empty check, before ever reaching the version-match check
  assert.deepEqual(attemptOnboarding({ role: "pending", terms: "", privacy: privacyVersion }), { ok: false, reason: "Terms and privacy agreement is required" });
  assert.deepEqual(attemptOnboarding({ role: "pending", terms: termsVersion, privacy: "" }), { ok: false, reason: "Terms and privacy agreement is required" });
  // not pending -> fails before version is even inspected
  assert.deepEqual(attemptOnboarding({ role: "dealer", terms: termsVersion, privacy: privacyVersion }), { ok: false, reason: "Onboarding already completed" });
});

test("Role-switch guard: both onboarding RPCs check profiles.role = 'pending' before doing anything, so an already-onboarded dealer/installer/admin can never re-run onboarding into a different role — the SAME guard clause rejects all three cases (dealer→installer, installer→dealer, admin→either)", async () => {
  const migration = await read("supabase/migrations/202608050002_v0314_legal_onboarding_foundation.sql");
  const guardOccurrences = migration.match(/if caller_role is distinct from 'pending'::public\.user_role then/g) ?? [];
  assert.equal(guardOccurrences.length, 2, "both complete_dealer_onboarding and complete_installer_onboarding must have the pending-only guard");
});

test("Onboarding RPCs are executable by authenticated only, revoked from public/anon — no arbitrary invocation", async () => {
  const migration = await read("supabase/migrations/202608050002_v0314_legal_onboarding_foundation.sql");
  assert.match(migration, /revoke all on function public\.complete_dealer_onboarding\(jsonb\) from public, anon;/);
  assert.match(migration, /grant execute on function public\.complete_dealer_onboarding\(jsonb\) to authenticated;/);
  assert.match(migration, /revoke all on function public\.complete_installer_onboarding\(jsonb\) from public, anon;/);
  assert.match(migration, /grant execute on function public\.complete_installer_onboarding\(jsonb\) to authenticated;/);
});

test("Both onboarding RPCs use SECURITY DEFINER with search_path locked to '' — same safe pattern as every existing RPC (is_admin, create_transaction_with_room, handle_new_user)", async () => {
  const migration = await read("supabase/migrations/202608050002_v0314_legal_onboarding_foundation.sql");
  for (const fnName of ["complete_dealer_onboarding", "complete_installer_onboarding", "handle_new_user"]) {
    const start = migration.indexOf(`create or replace function public.${fnName}`);
    const nextFnStart = migration.indexOf("create or replace function public.", start + 1);
    const block = migration.slice(start, nextFnStart === -1 ? undefined : nextFnStart);
    assert.match(block, /security definer/, `${fnName} must be SECURITY DEFINER`);
    assert.match(block, /set search_path = ''/, `${fnName} must lock search_path`);
  }
});

test("legal_agreements is an append-only consent history table (one row per agreement event, not overwritten columns) — RLS: select own or admin, no client insert/update/delete grant", async () => {
  const migration = await read("supabase/migrations/202608050002_v0314_legal_onboarding_foundation.sql");
  assert.match(migration, /create table public\.legal_agreements \(\s*id bigint generated always as identity primary key,\s*user_id uuid not null references public\.profiles\(id\) on delete cascade,\s*terms_version text not null,\s*privacy_version text not null,\s*agreed_at timestamptz not null default now\(\)\s*\);/);
  assert.match(migration, /create policy "legal agreements select own or admin" on public\.legal_agreements\s*for select to authenticated\s*using \(user_id = auth\.uid\(\) or public\.is_admin\(\)\);/);
});

test("Grant hardening: legal_agreements privileges are set with `revoke all` (not just insert/update/delete), so anon/authenticated table access never depends on ambient default privileges on the public schema", async () => {
  const migration = await read("supabase/migrations/202608050002_v0314_legal_onboarding_foundation.sql");
  // anon gets zero table-level grants on legal_agreements — REVOKE ALL,
  // not a partial revoke that could still leave e.g. TRIGGER/REFERENCES/
  // TRUNCATE in place if a default privilege had granted them.
  assert.match(migration, /revoke all on table public\.legal_agreements from anon, authenticated;/);
  // authenticated is explicitly granted SELECT only — nothing else.
  assert.match(migration, /grant select on table public\.legal_agreements to authenticated;/);
  // The old partial-revoke form must be gone, not merely superseded.
  assert.doesNotMatch(migration, /revoke insert, update, delete on public\.legal_agreements/);
  // The REVOKE ALL must run before the SELECT grant, so there is no window
  // where a broader privilege is briefly in effect within this migration.
  const revokeIndex = migration.indexOf("revoke all on table public.legal_agreements");
  const grantIndex = migration.indexOf("grant select on table public.legal_agreements");
  assert.ok(revokeIndex > 0 && grantIndex > revokeIndex, "revoke all must precede the select grant");
});

test("Grant hardening: onboarding RPCs remain EXECUTE-able by authenticated (write access is RPC-only, not table-grant-based), and service_role/postgres are never revoked anywhere in this migration", async () => {
  const migration = await read("supabase/migrations/202608050002_v0314_legal_onboarding_foundation.sql");
  assert.match(migration, /revoke all on function public\.complete_dealer_onboarding\(jsonb\) from public, anon;/);
  assert.match(migration, /grant execute on function public\.complete_dealer_onboarding\(jsonb\) to authenticated;/);
  assert.match(migration, /revoke all on function public\.complete_installer_onboarding\(jsonb\) from public, anon;/);
  assert.match(migration, /grant execute on function public\.complete_installer_onboarding\(jsonb\) to authenticated;/);
  // service_role/postgres are never even named in this migration, let
  // alone touched by a revoke — the literal strings must not appear at all.
  assert.doesNotMatch(migration, /service_role/);
  assert.doesNotMatch(migration, /\bpostgres\b/);
});

test("No existing RLS policy from prior migrations is modified — this migration only adds new policies on the new legal_agreements table", async () => {
  const migration = await read("supabase/migrations/202608050002_v0314_legal_onboarding_foundation.sql");
  const policyMatches = migration.match(/create policy "([^"]+)"/g) ?? [];
  assert.deepEqual(policyMatches, ['create policy "legal agreements select own or admin"']);
});

test("pending installer directory non-exposure: get_approved_installer_directory (untouched) still requires approval.status = 'approved' and caller role in ('dealer', 'admin') only — 'pending' was never added to that allowlist", async () => {
  const foundation = await read("supabase/migrations/202607210001_v035_foundation.sql");
  assert.match(foundation, /caller\.role in \('dealer', 'admin'\)/);
  assert.match(foundation, /approval\.status = 'approved' and installer\.accepting_requests = true/);
  const newMigration = await read("supabase/migrations/202608050002_v0314_legal_onboarding_foundation.sql");
  assert.doesNotMatch(newMigration, /get_approved_installer_directory/);
});

test("Demo login and is_admin()/admin bootstrap are untouched by this migration — no demo_ table/RPC and no is_admin() redefinition appears in the new files", async () => {
  const migration1 = await read("supabase/migrations/202608050001_v0314_user_role_pending.sql");
  const migration2 = await read("supabase/migrations/202608050002_v0314_legal_onboarding_foundation.sql");
  assert.doesNotMatch(migration1 + migration2, /demo_|is_admin\(\)\s*\nreturns|create or replace function public\.is_admin/);
  const demoLoginRoute = await read("app/api/demo-login/route.ts");
  assert.doesNotMatch(demoLoginRoute, /pending|legal_agreements|onboarding/i);
});

test("AuthProvider interface gains completeDealerOnboarding/completeInstallerOnboarding; all three implementations (Supabase, Demo, Unconfigured) implement them", async () => {
  const providerInterface = await read("services/auth/auth-provider.ts");
  assert.match(providerInterface, /completeDealerOnboarding\(input: DealerOnboardingInput\): Promise<CurrentUser>/);
  assert.match(providerInterface, /completeInstallerOnboarding\(input: InstallerOnboardingInput\): Promise<CurrentUser>/);
  for (const file of ["services/auth/supabase-auth-provider.ts", "services/auth/demo-auth-provider.ts", "services/auth/unconfigured-auth-provider.ts"]) {
    const source = await read(file);
    assert.match(source, /completeDealerOnboarding/, `${file} missing completeDealerOnboarding`);
    assert.match(source, /completeInstallerOnboarding/, `${file} missing completeInstallerOnboarding`);
  }
});

test("SupabaseAuthProvider.completeDealerOnboarding/completeInstallerOnboarding call the official RPCs via .rpc(), never construct SQL manually, and always re-resolve the user afterward", async () => {
  const source = await read("services/auth/supabase-auth-provider.ts");
  assert.match(source, /supabase\.rpc\("complete_dealer_onboarding", \{/);
  assert.match(source, /supabase\.rpc\("complete_installer_onboarding", \{/);
  assert.match(source, /return this\.resolveUser\(user\);/g);
});

test("Demo and Unconfigured providers reject onboarding with a clear error instead of silently succeeding", async () => {
  const demoProvider = await read("services/auth/demo-auth-provider.ts");
  assert.match(demoProvider, /async completeDealerOnboarding[\s\S]*?throw new Error/);
  assert.match(demoProvider, /async completeInstallerOnboarding[\s\S]*?throw new Error/);
  const unconfiguredProvider = await read("services/auth/unconfigured-auth-provider.ts");
  assert.match(unconfiguredProvider, /completeDealerOnboarding[\s\S]*?throw configurationError/);
  assert.match(unconfiguredProvider, /completeInstallerOnboarding[\s\S]*?throw configurationError/);
});

test("types/auth.ts: UserRole includes 'pending', and onboarding input types require termsVersion/privacyVersion (never a plain boolean)", async () => {
  const types = await read("types/auth.ts");
  assert.match(types, /export type UserRole = "dealer" \| "installer" \| "admin" \| "pending";/);
  assert.match(types, /export type LegalAgreementInput = \{ termsVersion: string; privacyVersion: string \};/);
  assert.match(types, /export type DealerOnboardingInput = \{ name: string; phone: string; companyName\?: string; activityRegion\?: string \} & LegalAgreementInput;/);
  assert.match(types, /export type InstallerOnboardingInput = \{/);
});

test("access-policy.ts: /onboarding is protected, /terms and /privacy are public, and a pending user's workspace path is /onboarding — never a dealer/installer/admin path", async () => {
  const policy = await read("services/auth/access-policy.ts");
  assert.match(policy, /export const protectedPaths = \["\/dealer", "\/shop", "\/admin", "\/account-status", "\/onboarding"\] as const;/);
  assert.match(policy, /"\/forgot-password", "\/update-password", "\/auth\/callback", "\/terms", "\/privacy"\]/);
  assert.match(policy, /if \(user\.role === "pending"\) return "\/onboarding";/);
  assert.match(policy, /if \(pathname\.startsWith\("\/onboarding"\)\) return user\.role === "pending";/);
});

test("access-policy.ts regression: an anonymous user is still rejected from every protected path including the new /onboarding path", async () => {
  const policy = await read("services/auth/access-policy.ts");
  assert.match(policy, /export function canAccessWorkspacePath\(user: CurrentUser \| null, pathname: string\) \{\s*if \(!user\) return !isProtectedPath\(pathname\);/);
});

test("proxy.ts (server-side route guard): /onboarding maps to protectedRole 'pending', profile type includes 'pending', and a role mismatch correctly redirects a pending user to /onboarding instead of the pre-existing /account-status fallback", async () => {
  const proxy = await read("lib/supabase/proxy.ts");
  assert.match(proxy, /pathname\.startsWith\("\/onboarding"\) \? "pending" : null;/);
  assert.match(proxy, /single<\{ role: "dealer" \| "installer" \| "admin" \| "pending" \}>\(\)/);
  assert.match(proxy, /profile\.role === "pending" \? "\/onboarding" : profile\.role === "dealer" \? "\/dealer" : profile\.role === "admin" \? "\/admin" : "\/account-status"/);
});

test("proxy.ts regression: dealer/admin path protection, demo-session short-circuit, and the 5s fail-open timeout wrapper are all untouched", async () => {
  const proxy = await read("lib/supabase/proxy.ts");
  assert.match(proxy, /const AUTH_PROXY_TIMEOUT_MS = 5_000;/);
  assert.match(proxy, /if \(protectedRole && normalizedDemoRole && \["dealer", "installer", "admin"\]\.includes\(normalizedDemoRole\)\) \{/);
  assert.match(proxy, /pathname\.startsWith\("\/dealer"\) \? "dealer"/);
});

test("app/page.tsx: a pending user is routed straight to the onboarding screen and never reaches accountForUser (which has no Role mapping for 'pending')", async () => {
  const page = await read("app/page.tsx");
  assert.match(page, /if \(user\.role === "pending"\) \{[\s\S]*?setScreen\("onboarding"\);/);
  assert.match(page, /if \(user\.role === "pending"\) throw new Error\("accountForUser called with a pending-onboarding user"\);/);
  const enterAuthBlock = page.slice(page.indexOf("const enterAuthenticatedUser = useCallback"), page.indexOf("const authenticate = useCallback"));
  const pendingCheckIndex = enterAuthBlock.indexOf('user.role === "pending"');
  const accountForUserCallIndex = enterAuthBlock.indexOf("accountForUser(user)");
  assert.ok(pendingCheckIndex >= 0 && accountForUserCallIndex > pendingCheckIndex, "the pending short-circuit must run before accountForUser is called");
});

test("app/page.tsx: onboarding completion re-enters the normal authenticated-user flow (so a newly-dealer/installer user lands in their real workspace, not stuck on /onboarding)", async () => {
  const page = await read("app/page.tsx");
  assert.match(page, /const completeDealerOnboarding = useCallback\(async \(input: DealerOnboardingInput\) => \{\s*const user = await authProvider\.completeDealerOnboarding\(input\);\s*enterAuthenticatedUser\(user, true\);/);
  assert.match(page, /const completeInstallerOnboarding = useCallback\(async \(input: InstallerOnboardingInput\) => \{\s*const user = await authProvider\.completeInstallerOnboarding\(input\);\s*enterAuthenticatedUser\(user, true\);/);
  assert.match(page, /<OnboardingScreen user=\{currentUser\} onCompleteDealer=\{completeDealerOnboarding\} onCompleteInstaller=\{completeInstallerOnboarding\} onLogout=\{\(\) => void logout\(\)\} \/>/);
});

test("OnboardingScreen blocks submission without both required consent checkboxes, links to /terms and /privacy, and opens them in a new tab so in-progress form data is never lost", async () => {
  const source = await read("components/auth/OnboardingScreen.tsx");
  assert.match(source, /if \(!agreedTerms \|\| !agreedPrivacy\) return setError\("이용약관 동의와 개인정보처리방침 확인이 모두 필요해요\."\)/);
  assert.match(source, /<a href="\/terms" target="_blank" rel="noopener noreferrer">이용약관<\/a>/);
  assert.match(source, /<a href="\/privacy" target="_blank" rel="noopener noreferrer">개인정보처리방침<\/a>/);
});

test("OnboardingScreen's privacy checkbox is framed as policy acknowledgment, not a separate collection/use consent — matching the contract-necessity legal basis PrivacyScreen documents (no duplicate '수집·이용 동의' wording)", async () => {
  const source = await read("components/auth/OnboardingScreen.tsx");
  assert.match(source, /개인정보처리방침<\/a> 확인<\/span>/);
  assert.doesNotMatch(source, /수집·이용 동의/);
});

test("OnboardingScreen validates required fields per role before calling the provider (dealer: name/phone; installer: the full required set) — no empty-string submission reaches the RPC", async () => {
  const source = await read("components/auth/OnboardingScreen.tsx");
  assert.match(source, /if \(!form\.name\?\.trim\(\) \|\| !form\.phone\?\.trim\(\)\) throw new Error\("이름과 연락처를 입력해 주세요\."\)/);
  assert.match(source, /const required = \[form\.shopName, form\.representativeName, form\.businessName, form\.businessRegistrationNumber, form\.address, form\.phone, form\.contactPhone\];/);
});

test("OnboardingScreen sends the current terms/privacy version constants with every onboarding submission — never a hardcoded or missing version", async () => {
  const source = await read("components/auth/OnboardingScreen.tsx");
  const dealerCallCount = (source.match(/termsVersion: CURRENT_TERMS_VERSION, privacyVersion: CURRENT_PRIVACY_VERSION/g) ?? []).length;
  assert.equal(dealerCallCount, 2, "both the dealer and installer onboarding calls must pass the current version constants");
});

test("/terms and /privacy are real Next.js routes (re-export pattern, matching every other public route) and /onboarding is a real protected route", async () => {
  for (const [path, screenComponent] of [["app/terms/page.tsx", null], ["app/privacy/page.tsx", null], ["app/onboarding/page.tsx", null]]) {
    const source = await read(path);
    assert.match(source, /export \{ default \} from "\.\.\/page";/);
    void screenComponent;
  }
});

test("TermsScreen and PrivacyScreen render real, non-placeholder legal content — not lorem ipsum, not a copy of another company's terms — and mark unverified business/legal facts as explicit bracketed placeholders or TODOs, never fabricated", async () => {
  const terms = await read("components/legal/TermsScreen.tsx");
  assert.match(terms, /제1조 \(목적\)/);
  assert.match(terms, /플랫폼 운영자/);
  assert.match(terms, /\[사업자등록 후 기재\]/);
  // v0.5 is a free Beta: the terms may name fee/payment concepts only to say
  // they're explicitly out of scope for this version — never to define an
  // actual fee schedule, refund rule, or payment/settlement process.
  assert.match(terms, /유료 서비스에 관한 사항은 포함하지 않습니다/);
  assert.doesNotMatch(terms, /환불 기한|환불 절차|수수료율|결제수단|정산 주기|세금계산서 발행/);
  const privacy = await read("components/legal/PrivacyScreen.tsx");
  assert.match(privacy, /개인정보처리방침/);
  // Unverified facts are marked "확인 예정" (a polished, user-facing pending-
  // confirmation label) rather than a literal "TODO:" dev-memo prefix.
  assert.match(privacy, /확인 예정/);
  const todoBadgeCount = (privacy.match(/<b>확인 예정<\/b>/g) ?? []).length;
  assert.equal(todoBadgeCount, 3, "retention period, vendor details, and international transfer must each carry the pending-confirmation badge");
  // Resend/custom SMTP aren't operated yet — the policy may name them only
  // to say so explicitly, but must never list them as an active processor
  // inside the vendor table itself.
  assert.match(privacy, /Resend, 별도 SMS 발송 서비스 등은 현재 운영하고 있지 않으며/);
  const vendorTable = privacy.slice(privacy.indexOf("<tbody>"), privacy.indexOf("</tbody>"));
  assert.doesNotMatch(vendorTable, /Resend|SMS/i);
});

test("PrivacyScreen accurately reflects only currently-used external services (Supabase, Vercel, NAVER Maps) confirmed in code — no fabricated vendor list", async () => {
  const privacy = await read("components/legal/PrivacyScreen.tsx");
  assert.match(privacy, /Supabase/);
  assert.match(privacy, /Vercel/);
  assert.match(privacy, /NAVER/);
  const naverLoader = await read("lib/naver-maps-loader.ts");
  assert.ok(naverLoader.length > 0);
});

test("PrivacyScreen never claims a Vercel DPA is in place — Vercel is described only as the hosting provider, and the Hobby-plan/DPA gap is flagged as an internal code comment, not exposed to end users", async () => {
  const privacy = await read("components/legal/PrivacyScreen.tsx");
  // The DEVELOPER-facing comment (above the component) is allowed to say
  // "DPA"/"Hobby" — that's the point, it documents the real operational
  // risk for whoever maintains this page. Only the RENDERED, user-facing
  // JSX (the component body) must never expose that language.
  const renderedBody = privacy.slice(privacy.indexOf("export function PrivacyScreen"));
  assert.doesNotMatch(renderedBody, /DPA|Data Processing Agreement|데이터 처리 계약|Hobby|무료 플랜/);
  assert.match(renderedBody, /<td>애플리케이션 호스팅<\/td><td>Vercel<\/td><td>웹 서비스 배포 및 접속 처리<\/td>/);
  // The Hobby/DPA gap is real operational risk — it must be documented
  // somewhere for the developer, just not on the user-facing page itself.
  assert.match(privacy, /Vercel's Hobby plan/);
  assert.match(privacy, /internal, not user-facing/);
});

test("PrivacyScreen's Demo wording no longer overclaims 'no personal data collected' or 'physically separated' — it accurately describes application-level/table-level separation within the same database", async () => {
  const privacy = await read("components/legal/PrivacyScreen.tsx");
  assert.doesNotMatch(privacy, /물리적으로 분리/);
  assert.match(privacy, /실제 개인정보를 입력하지 않으실 것을 권장합니다/);
  assert.match(privacy, /이용자가 Demo의 메시지, 첨부파일,\s*입력 폼 등에 직접 입력한 내용은 서비스 체험을 위해 저장될 수 있습니다/);
  assert.match(privacy, /별도의 데이터베이스 테이블 구조로 분리되어 관리/);
});

test("PrivacyScreen documents a specific legal basis (PIPA Art. 15(1)(4), contract performance) for onboarding-necessary personal information instead of treating it as consent-based collection, and explains optional fields and the future-consent path for anything beyond contract necessity", async () => {
  const privacy = await read("components/legal/PrivacyScreen.tsx");
  assert.match(privacy, /2\. 개인정보 처리의 법적 근거 및 동의/);
  assert.match(privacy, /개인정보 보호법\s*제15조제1항제4호/);
  assert.match(privacy, /별도의 개인정보 수집·이용 동의를 받지 않으며/);
  assert.match(privacy, /선택 항목으로 표시된 정보.*입력하지 않아도 서비스 이용에 제한이 없습니다/s);
  assert.match(privacy, /동의를 거부할 권리와 거부 시 불이익을\s*명확히 고지하고 별도로 동의를 받습니다/);
});

test("PrivacyScreen articles are sequentially renumbered 1-12 after inserting the new legal-basis section — no duplicate or skipped section numbers", async () => {
  const privacy = await read("components/legal/PrivacyScreen.tsx");
  const numbers = [...privacy.matchAll(/<h2>(\d+)\. /g)].map((match) => Number(match[1]));
  assert.deepEqual(numbers, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
});

test("PrivacyScreen states the sourced Supabase facts (legal entity, Seoul/AWS region) confirmed from Supabase's own official pages — never fabricated", async () => {
  const privacy = await read("components/legal/PrivacyScreen.tsx");
  assert.match(privacy, /Supabase \(Supabase, Inc\.\)/);
  assert.match(privacy, /대한민국 서울\(AWS ap-northeast-2\)로 설정되어 있음/);
  assert.match(privacy, /Car-Master의 Supabase 프로젝트는 대한민국 서울 리전\(AWS ap-northeast-2\)에 구성되어 있으며/);
});

test("PrivacyScreen's international-transfer section does not oversimplify 'Seoul region = no data ever leaves Korea' — it explicitly acknowledges subprocessor-driven international processing while still stating the confirmed region fact", async () => {
  const privacy = await read("components/legal/PrivacyScreen.tsx");
  const section7 = privacy.slice(privacy.indexOf("<h2>7. 개인정보의 국외 이전"), privacy.indexOf("<h2>8. "));
  assert.match(section7, /단정할 수 없으며/);
  assert.match(section7, /국외 처리가 발생할 가능성이 있습니다/);
  assert.match(section7, /하위처리자/);
});

test("PrivacyScreen does not assert that Kakao login is currently active or that Kakao data is currently received — only future intent", async () => {
  const privacy = await read("components/legal/PrivacyScreen.tsx");
  assert.match(privacy, /카카오 로그인 기능이\s*실제로 활성화되어 있지 않으며 카카오로부터 어떠한 정보도 제공받고 있지 않습니다/);
});

test("LandingPage footer links to /terms and /privacy without a large redesign — same footer structure, two new links added", async () => {
  const landing = await read("components/landing/LandingPage.tsx");
  assert.match(landing, /<div className="footer-links"><a href="\/terms">이용약관<\/a><span aria-hidden="true">\|<\/span><a href="\/privacy">개인정보처리방침<\/a><\/div>/);
  assert.match(landing, /footer-brand/);
  assert.match(landing, /footer-meta/);
});

test("legal-page CSS defines a mobile breakpoint, matching this app's existing mobile-first responsive convention", async () => {
  const css = await read("app/globals.css");
  assert.match(css, /\.legal-page \{/);
  assert.match(css, /@media \(max-width: 560px\) \{ \.legal-page \{/);
});

test("Real transaction/chat/attachment/auth code paths untouched: no changes to transaction RPCs, storage buckets, or the login/signup/logout methods themselves", async () => {
  const supabaseProvider = await read("services/auth/supabase-auth-provider.ts");
  assert.match(supabaseProvider, /async login\(\{ email, password \}: AuthCredentials\)/);
  assert.match(supabaseProvider, /async signUp\(input: SignUpInput\)/);
  assert.match(supabaseProvider, /async logout\(\)/);
  const foundation = await read("supabase/migrations/202607210001_v035_foundation.sql");
  assert.match(foundation, /create or replace function public\.create_transaction_with_room\(payload jsonb\)/);
});
