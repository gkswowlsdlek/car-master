import type { CurrentUser, SignUpInput, SignUpResult } from "../../types/auth";

export type AuthCredentials = { email: string; password: string };

export interface AuthProvider {
  getCurrentUser(): CurrentUser | null;
  initialize(): Promise<CurrentUser | null>;
  login(credentials: AuthCredentials): Promise<CurrentUser>;
  signUp(input: SignUpInput): Promise<SignUpResult>;
  logout(): Promise<void>;
  subscribe?(listener: (user: CurrentUser | null) => void): () => void;
  /** Always resolves (never reveals whether the email is a registered account) unless the request itself is malformed/rate-limited. */
  requestPasswordReset(email: string): Promise<void>;
  /**
   * Legacy fallback only — exchanges a PKCE `?code=` (the old
   * ConfirmationURL-style recovery link) for a session client-side. Only
   * works when the browser calling this is the same one that originally
   * called requestPasswordReset() (the code_verifier it needs lives in
   * that browser's own storage). Kept so an email already sent with the
   * old template before this fix still works in the same-browser case;
   * the primary path is now the server-side app/auth/confirm route +
   * hasValidSession() below, which has no such same-browser requirement.
   * Returns false — never throws — on an expired/invalid/already-used code.
   */
  exchangeRecoveryCode(code: string): Promise<boolean>;
  /** True if a Supabase session is currently readable by this browser — used to gate the post-recovery password form after app/auth/confirm has already verified the token_hash server-side and set the session cookie. */
  hasValidSession(): Promise<boolean>;
  /** Sets a new password on the current session. Pass `currentPassword` for an authenticated in-app change (verified server-side via Supabase's `current_password` field when the project requires it); omit it for a post-recovery update, where the session itself is the proof of ownership. */
  updatePassword(newPassword: string, currentPassword?: string): Promise<void>;
}

export class AuthenticationError extends Error {
  constructor() {
    super("아이디 또는 비밀번호가 올바르지 않습니다.");
    this.name = "AuthenticationError";
  }
}
