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

test("UpdatePasswordScreen reads the recovery code from the URL and exchanges it via the official API before showing the password form", async () => {
  const source = await read("components/auth/UpdatePasswordScreen.tsx");
  assert.match(source, /function readRecoveryCode/);
  assert.match(source, /new URLSearchParams\(window\.location\.search\)\.get\("code"\)/);
  assert.match(source, /const check = code \? onExchangeCode\(code\) : Promise\.resolve\(false\)/);
});

test("SupabaseAuthProvider.exchangeRecoveryCode uses the official exchangeCodeForSession API (PKCE) and never throws — always resolves a boolean", async () => {
  const source = await read("services/auth/supabase-auth-provider.ts");
  assert.match(source, /async exchangeRecoveryCode\(code: string\): Promise<boolean>/);
  assert.match(source, /\.auth\.exchangeCodeForSession\(code\)/);
  assert.match(source, /return !error && Boolean\(data\.session\)/);
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

test("the unconfigured runtime AuthProvider rejects password reset/change instead of silently succeeding", async () => {
  const unconfiguredProvider = await read("services/auth/unconfigured-auth-provider.ts");
  assert.match(unconfiguredProvider, /requestPasswordReset[\s\S]*?throw configurationError/);
  assert.match(unconfiguredProvider, /exchangeRecoveryCode[\s\S]*?return false/);
  assert.match(unconfiguredProvider, /updatePassword[\s\S]*?throw configurationError/);
});

test("both runtime AuthProvider implementations implement the extended interface — role regression guard", async () => {
  const providerInterface = await read("services/auth/auth-provider.ts");
  assert.match(providerInterface, /requestPasswordReset\(email: string\): Promise<void>/);
  assert.match(providerInterface, /exchangeRecoveryCode\(code: string\): Promise<boolean>/);
  assert.match(providerInterface, /updatePassword\(newPassword: string, currentPassword\?: string\): Promise<void>/);
  for (const file of ["services/auth/supabase-auth-provider.ts", "services/auth/unconfigured-auth-provider.ts"]) {
    const source = await read(file);
    assert.match(source, /requestPasswordReset/, `${file} missing requestPasswordReset`);
    assert.match(source, /exchangeRecoveryCode/, `${file} missing exchangeRecoveryCode`);
    assert.match(source, /updatePassword/, `${file} missing updatePassword`);
  }
});

test("Real Dealer, Installer and Admin all wire the same shared PasswordChangeForm / changePassword handler — no per-role password system", async () => {
  const page = await read("app/page.tsx");
  const dealerWorkspace = await read("components/workspaces/DealerWorkspace.tsx");
  const installerWorkspace = await read("components/workspaces/InstallerWorkspace.tsx");
  const adminWorkspace = await read("components/workspaces/AdminWorkspace.tsx");
  assert.match(page, /const changePassword = useCallback\(\(currentPassword: string, newPassword: string\) => authProvider\.updatePassword\(newPassword, currentPassword\), \[\]\)/);
  assert.match(page, /<DealerWorkspace[\s\S]*?onChangePassword={changePassword}/);
  assert.match(dealerWorkspace, /<ProfileEditor role="dealer"[\s\S]*?onChangePassword={onChangePassword}/);
  assert.match(page, /<InstallerWorkspace[\s\S]*?onChangePassword={changePassword}/);
  assert.match(installerWorkspace, /<ProfileEditor role="shop"[\s\S]*?onChangePassword={onChangePassword}/);
  assert.match(page, /<AdminWorkspace[\s\S]*?onChangePassword={changePassword}/);
  assert.match(adminWorkspace, /<AdminAccountScreen[\s\S]*?onChangePassword={onChangePassword}/);
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
