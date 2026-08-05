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
  /** Exchanges a Supabase recovery `code` (from the reset-password email link) for a session. Returns false — never throws — on an expired/invalid/already-used code. */
  exchangeRecoveryCode(code: string): Promise<boolean>;
  /** Sets a new password on the current session. Pass `currentPassword` for an authenticated in-app change (verified server-side via Supabase's `current_password` field when the project requires it); omit it for a post-recovery update, where the session itself is the proof of ownership. */
  updatePassword(newPassword: string, currentPassword?: string): Promise<void>;
}

export class AuthenticationError extends Error {
  constructor() {
    super("아이디 또는 비밀번호가 올바르지 않습니다.");
    this.name = "AuthenticationError";
  }
}
