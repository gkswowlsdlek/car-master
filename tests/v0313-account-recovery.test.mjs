import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("ForgotPasswordScreen validates email format client-side before calling the reset API", async () => {
  const source = await read("components/auth/ForgotPasswordScreen.tsx");
  assert.match(source, /if \(!\/\^\[\^\\s@\]\+@\[\^\\s@\]\+\\\.\[\^\\s@\]\+\$\/\.test\(email\)\) return setError\("올바른 이메일 주소를 입력해 주세요\."\)/);
});

test("ForgotPasswordScreen shows a generic success message that does not reveal whether the account exists", async () => {
  const source = await read("components/auth/ForgotPasswordScreen.tsx");
  assert.match(source, /입력하신 이메일이 가입된 계정이라면 비밀번호 재설정 안내를 보내드렸어요\./);
  assert.doesNotMatch(source, /가입되지 않은|존재하지 않는 이메일|not found|no account/i);
});

test("SupabaseAuthProvider.requestPasswordReset calls the official resetPasswordForEmail API with a redirectTo pointing at /update-password — no custom token system", async () => {
  const source = await read("services/auth/supabase-auth-provider.ts");
  assert.match(source, /async requestPasswordReset\(email: string\)/);
  assert.match(source, /\.auth\.resetPasswordForEmail\(email, \{ redirectTo: `\$\{origin\}\/update-password` \}\)/);
  assert.doesNotMatch(source, /jwt\.sign|crypto\.randomBytes|custom.*token/i);
});

test("UpdatePasswordScreen reads verified/code from the URL: verified=1 checks the session set by app/auth/confirm, code= falls back to the legacy PKCE exchange", async () => {
  const source = await read("components/auth/UpdatePasswordScreen.tsx");
  assert.match(source, /function readRecoveryParams/);
  assert.match(source, /params\.get\("verified"\), code: params\.get\("code"\)/);
  assert.match(source, /if \(verified === "1"\) check = onCheckSession\(\);/);
  assert.match(source, /else if \(code\) check = onExchangeCode\(code\);/);
  assert.match(source, /else check = Promise\.resolve\(false\);/);
});

test("UpdatePasswordScreen strips verified/code recovery params from the URL immediately, before the async check even resolves", async () => {
  const source = await read("components/auth/UpdatePasswordScreen.tsx");
  assert.match(source, /window\.history\.replaceState\(null, "", window\.location\.pathname\)/);
  // The strip must happen ahead of the onCheckSession/onExchangeCode call, not after.
  const stripIndex = source.indexOf("window.history.replaceState");
  const checkIndex = source.indexOf("let check: Promise<boolean>");
  assert.ok(stripIndex > 0 && checkIndex > stripIndex, "URL must be stripped before the recovery check runs");
});

test("app/auth/confirm route.ts is registered so /update-password receives the primary verified=1/0 flow", async () => {
  const route = await read("app/auth/confirm/route.ts");
  assert.match(route, /export async function GET\(request: NextRequest\)/);
});

test("SupabaseAuthProvider.exchangeRecoveryCode uses the official exchangeCodeForSession API (PKCE) and never throws — always resolves a boolean (kept as a legacy fallback only, see doc comment)", async () => {
  const source = await read("services/auth/supabase-auth-provider.ts");
  assert.match(source, /async exchangeRecoveryCode\(code: string\): Promise<boolean>/);
  assert.match(source, /\.auth\.exchangeCodeForSession\(code\)/);
  assert.match(source, /return !error && Boolean\(data\.session\)/);
  const providerInterface = await read("services/auth/auth-provider.ts");
  assert.match(providerInterface, /Legacy fallback only/);
});

test("SupabaseAuthProvider.hasValidSession reads the session via the official getUser API, never throws, and is the primary post-recovery gate", async () => {
  const source = await read("services/auth/supabase-auth-provider.ts");
  assert.match(source, /async hasValidSession\(\): Promise<boolean> \{\s*try \{\s*const \{ data, error \} = await createSupabaseBrowserClient\(\)\.auth\.getUser\(\);\s*return !error && Boolean\(data\.user\);\s*\} catch \{\s*return false;\s*\}\s*\}/);
});

test("app/auth/confirm route.ts requires token_hash AND type=recovery before calling verifyOtp — a missing/wrong type never reaches verifyOtp", async () => {
  const route = await read("app/auth/confirm/route.ts");
  assert.match(route, /const tokenHash = url\.searchParams\.get\("token_hash"\);/);
  assert.match(route, /const type = url\.searchParams\.get\("type"\);/);
  assert.match(route, /if \(tokenHash && type === "recovery"\) \{/);
  // The actual verifyOtp call (not just a mention in a comment) must be inside that guarded branch, not called unconditionally.
  const guardIndex = route.indexOf('if (tokenHash && type === "recovery")');
  const verifyCallIndex = route.indexOf(".auth.verifyOtp(");
  assert.ok(guardIndex >= 0 && verifyCallIndex > guardIndex, "verifyOtp call must only run after the token_hash+type guard");
});

test("app/auth/confirm route.ts calls the official verifyOtp({ token_hash, type: 'recovery' }) API — the server-side, cross-browser-safe pattern, not a home-grown token system", async () => {
  const route = await read("app/auth/confirm/route.ts");
  assert.match(route, /\.auth\.verifyOtp\(\{ token_hash: tokenHash, type: "recovery" \}\)/);
  assert.doesNotMatch(route, /jwt\.sign|crypto\.randomBytes|custom.*token/i);
});

test("app/auth/confirm route.ts redirects to /update-password?verified=1 only on a verifyOtp success, and ?verified=0 for any invalid/expired/already-used/missing-param case — token_hash itself never reaches the redirect URL", async () => {
  const route = await read("app/auth/confirm/route.ts");
  assert.match(route, /if \(!error\) return NextResponse\.redirect\(new URL\(`\$\{next\}\?verified=1`, url\.origin\)\);/);
  assert.match(route, /return NextResponse\.redirect\(new URL\(`\$\{next\}\?verified=0`, url\.origin\)\);/);
  assert.doesNotMatch(route, /verified=1`, url\.origin\)\);[\s\S]*token_hash/);
  // The fallback verified=0 redirect must be reachable outside the guarded branch (invalid type, missing token_hash, or a verifyOtp error all fall through to it).
  assert.doesNotMatch(route, /token_hash=\$\{tokenHash\}|\?token_hash=/);
});

test("app/auth/confirm route.ts never logs the token_hash, the verifyOtp error, or any session/token value", async () => {
  const route = await read("app/auth/confirm/route.ts");
  assert.doesNotMatch(route, /console\.(log|error|warn)/);
});

test("app/auth/confirm route.ts catches any unexpected exception (not just a returned Supabase error) so it always redirects to verified=0/1 instead of ever surfacing a raw 500 to someone coming from a password-reset email", async () => {
  const route = await read("app/auth/confirm/route.ts");
  const guardIndex = route.indexOf('if (tokenHash && type === "recovery")');
  const tryIndex = route.indexOf("try {", guardIndex);
  const catchIndex = route.indexOf("} catch", tryIndex);
  assert.ok(guardIndex >= 0 && tryIndex > guardIndex && catchIndex > tryIndex, "verifyOtp + session client creation must be wrapped in try/catch");
});

test("UpdatePasswordScreen blocks the password form entirely without a valid recovery session — no code, or a failed exchange, both land on the invalid state with no form rendered", async () => {
  const source = await read("components/auth/UpdatePasswordScreen.tsx");
  assert.match(source, /status === "invalid" && <>/);
  assert.match(source, /status === "ready" && <>/);
  // The password fields must only exist inside the "ready" branch, not unconditionally rendered.
  const readyBranch = source.slice(source.indexOf('status === "ready"'), source.indexOf('status === "success"'));
  assert.match(readyBranch, /PasswordField label="새 비밀번호"/);
  const invalidBranch = source.slice(source.indexOf('status === "invalid"'), source.indexOf('status === "ready"'));
  assert.doesNotMatch(invalidBranch, /PasswordField/);
});

test("UpdatePasswordScreen validates password length and mismatch before calling updatePassword", async () => {
  const source = await read("components/auth/UpdatePasswordScreen.tsx");
  assert.match(source, /if \(password\.length < 8\) return setError\("비밀번호는 8자 이상이어야 해요\."\)/);
  assert.match(source, /if \(password !== confirmPassword\) return setError\("두 비밀번호가 일치하지 않아요\."\)/);
});

test("A successful recovery password update signs the session out afterward, instead of silently landing the user in their dashboard", async () => {
  const source = await read("app/page.tsx");
  assert.match(source, /const updatePasswordFromRecovery = useCallback\(async \(newPassword: string\) => \{\s*await authProvider\.updatePassword\(newPassword\);\s*await authProvider\.logout\(\)\.catch/);
});

test("PasswordChangeForm requires current password, validates new password length and confirmation match before calling onChangePassword", async () => {
  const source = await read("components/auth/PasswordChangeForm.tsx");
  assert.match(source, /if \(!currentPassword\) return setError\("현재 비밀번호를 입력해 주세요\."\)/);
  assert.match(source, /if \(newPassword\.length < 8\) return setError\("새 비밀번호는 8자 이상이어야 해요\."\)/);
  assert.match(source, /if \(newPassword !== confirmPassword\) return setError\("새 비밀번호가 일치하지 않아요\."\)/);
});

test("Authenticated password change passes current_password to Supabase's officially-typed updateUser field — verified against the installed supabase-js type definitions, not guessed", async () => {
  const authTypes = await read("node_modules/.pnpm/@supabase+auth-js@2.110.7/node_modules/@supabase/auth-js/dist/module/lib/types.d.ts");
  assert.match(authTypes, /current_password\?: string;/);
  const provider = await read("services/auth/supabase-auth-provider.ts");
  assert.match(provider, /async updatePassword\(newPassword: string, currentPassword\?: string\)/);
  assert.match(provider, /\.auth\.updateUser\(\{\s*password: newPassword,\s*\.\.\.\(currentPassword \? \{ current_password: currentPassword \} : \{\}\),?\s*\}\)/);
});

test("Wrong-current-password and other Supabase Auth errors are translated to short Korean copy, never left as raw English or logged", async () => {
  const source = await read("services/auth/supabase-auth-provider.ts");
  assert.match(source, /function translateAuthError/);
  assert.match(source, /현재 비밀번호가 올바르지 않습니다\./);
  assert.doesNotMatch(source, /console\.(log|error|warn)\(.*password/i);
  assert.doesNotMatch(source, /console\.(log|error|warn)\(.*token/i);
});

test("Demo accounts (1/1, 2/2, 3/3) never reach password reset/change — ProfileEditor and AdminAccountScreen both gate on the Real/Demo split, and Demo login itself is untouched", async () => {
  const profileEditor = await read("components/profile/ProfileEditor.tsx");
  assert.match(profileEditor, /useMemberDatabase \? <PasswordChangeForm/);
  assert.match(profileEditor, /Demo 계정에서는 비밀번호를 변경하지 않아요\./);
  const adminAccount = await read("components/admin/AdminAccountScreen.tsx");
  assert.match(adminAccount, /demoSession\s*\?[\s\S]*?Demo 계정에서는 비밀번호를 변경하지 않아요\./);
  const demoSession = await read("lib/demo-session.ts");
  assert.match(demoSession, /export async function createDemoSession/);
  assert.match(demoSession, /export async function verifyDemoSession/);
});

test("Demo-mode AuthProvider implementations reject password reset/change with a clear message instead of silently succeeding or crashing, and never report a valid recovery session", async () => {
  const demoProvider = await read("services/auth/demo-auth-provider.ts");
  assert.match(demoProvider, /async requestPasswordReset[\s\S]*?throw new Error/);
  assert.match(demoProvider, /async exchangeRecoveryCode[\s\S]*?return false;/);
  assert.match(demoProvider, /async hasValidSession\(\): Promise<boolean> \{\s*return false;\s*\}/);
  assert.match(demoProvider, /async updatePassword[\s\S]*?throw new Error/);
  const unconfiguredProvider = await read("services/auth/unconfigured-auth-provider.ts");
  assert.match(unconfiguredProvider, /requestPasswordReset[\s\S]*?throw configurationError/);
  assert.match(unconfiguredProvider, /async hasValidSession\(\): Promise<boolean> \{ return false; \}/);
});

test("All three AuthProvider implementations (Supabase, Demo legacy, Unconfigured) implement the extended interface including hasValidSession — role regression guard", async () => {
  const providerInterface = await read("services/auth/auth-provider.ts");
  assert.match(providerInterface, /requestPasswordReset\(email: string\): Promise<void>/);
  assert.match(providerInterface, /exchangeRecoveryCode\(code: string\): Promise<boolean>/);
  assert.match(providerInterface, /hasValidSession\(\): Promise<boolean>/);
  assert.match(providerInterface, /updatePassword\(newPassword: string, currentPassword\?: string\): Promise<void>/);
  for (const file of ["services/auth/supabase-auth-provider.ts", "services/auth/demo-auth-provider.ts", "services/auth/unconfigured-auth-provider.ts"]) {
    const source = await read(file);
    assert.match(source, /requestPasswordReset/, `${file} missing requestPasswordReset`);
    assert.match(source, /exchangeRecoveryCode/, `${file} missing exchangeRecoveryCode`);
    assert.match(source, /hasValidSession/, `${file} missing hasValidSession`);
    assert.match(source, /updatePassword/, `${file} missing updatePassword`);
  }
});

test("app/page.tsx wires hasValidSession through a checkRecoverySession handler into UpdatePasswordScreen's onCheckSession prop", async () => {
  const page = await read("app/page.tsx");
  assert.match(page, /const checkRecoverySession = useCallback\(\(\) => authProvider\.hasValidSession\(\), \[\]\);/);
  assert.match(page, /<UpdatePasswordScreen onCheckSession={checkRecoverySession}/);
});

test("app/auth/callback/route.ts (signup email confirmation) is untouched by this recovery fix — still exchanges ?code= client-agnostic PKCE for signup, unrelated to /auth/confirm", async () => {
  const callback = await read("app/auth/callback/route.ts");
  assert.match(callback, /export async function GET\(request: Request\)/);
  assert.match(callback, /const code = url\.searchParams\.get\("code"\);/);
  assert.match(callback, /await supabase\.auth\.exchangeCodeForSession\(code\);/);
  assert.match(callback, /return NextResponse\.redirect\(new URL\(next, url\.origin\)\);/);
  // This route must remain distinct from the new recovery-specific confirm route.
  assert.doesNotMatch(callback, /verifyOtp|token_hash/);
});

test("Real Dealer, Installer and Admin all wire the same shared PasswordChangeForm / changePassword handler — no per-role password system", async () => {
  const page = await read("app/page.tsx");
  assert.match(page, /const changePassword = useCallback\(\(currentPassword: string, newPassword: string\) => authProvider\.updatePassword\(newPassword, currentPassword\), \[\]\)/);
  assert.match(page, /<ProfileEditor key={role}[\s\S]*?onChangePassword={changePassword}/);
  assert.match(page, /<AdminAccountScreen demoSession={[\s\S]*?onChangePassword={changePassword}/);
  const profileEditor = await read("components/profile/ProfileEditor.tsx");
  const adminAccount = await read("components/admin/AdminAccountScreen.tsx");
  assert.match(profileEditor, /import { PasswordChangeForm } from "..\/auth\/PasswordChangeForm"/);
  assert.match(adminAccount, /import { PasswordChangeForm } from "..\/auth\/PasswordChangeForm"/);
});

test("New routes are public (not gated behind the protected-path login wall) so a signed-out user with a fresh recovery link can always reach them", async () => {
  const policy = await read("services/auth/access-policy.ts");
  assert.match(policy, /"\/forgot-password", "\/update-password"/);
  assert.doesNotMatch(policy, /protectedPaths = \[[^\]]*update-password/);
  assert.match(policy, /if \(pathname === "\/forgot-password"\) return "forgotPassword" as const;/);
  assert.match(policy, /if \(pathname === "\/update-password"\) return "updatePassword" as const;/);
});

test("Login screen exposes a forgot-password entry point without changing the existing login submit path", async () => {
  const source = await read("components/auth/LoginScreen.tsx");
  assert.match(source, /onForgotPassword: \(\) => void/);
  assert.match(source, /비밀번호를 잊으셨나요\?/);
  // Still calls the same onLogin(email, password) contract, unchanged.
  assert.match(source, /await onLogin\(email, password\)/);
});

test("Password fields support show/hide with a touch-safe (>=44px) target", async () => {
  const source = await read("components/auth/PasswordField.tsx");
  assert.match(source, /aria-label={visible \? "비밀번호 숨기기" : "비밀번호 표시"}/);
  const css = await read("app/globals.css");
  assert.match(css, /\.password-toggle-button \{[^}]*width: 44px; height: 44px/);
});

test("Real transaction-attachments / Demo attachment / Real Auth login-signup-logout code paths are untouched by this change", async () => {
  const realAttachmentProvider = await read("services/attachments/supabase-attachment-provider.ts");
  assert.doesNotMatch(realAttachmentProvider, /password|updateUser|resetPassword/i);
  const supabaseProvider = await read("services/auth/supabase-auth-provider.ts");
  assert.match(supabaseProvider, /async login\(\{ email, password \}: AuthCredentials\)/);
  assert.match(supabaseProvider, /async signUp\(input: SignUpInput\)/);
  assert.match(supabaseProvider, /async logout\(\)/);
});
