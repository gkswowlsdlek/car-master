import type {
  CurrentUser,
  DealerOnboardingInput,
  InstallerOnboardingInput,
  SignUpInput,
  SignUpResult,
} from "../../types/auth";

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
  /**
   * Completes onboarding for a `role: "pending"` user (created with no
   * signup_role — e.g. a future OAuth sign-in) as a Dealer. Calls the
   * complete_dealer_onboarding SECURITY DEFINER RPC, which itself enforces
   * `profiles.role = 'pending'` server-side — this can only ever act on the
   * caller's own row and can only ever run once. Returns the updated
   * CurrentUser on success.
   */
  completeDealerOnboarding(input: DealerOnboardingInput): Promise<CurrentUser>;
  /** Same as completeDealerOnboarding but for Installer — puts the new installer_approvals row into "pending" review, same as the existing signup flow. */
  completeInstallerOnboarding(input: InstallerOnboardingInput): Promise<CurrentUser>;
}

export class AuthenticationError extends Error {
  constructor() {
    super("아이디 또는 비밀번호가 올바르지 않습니다.");
    this.name = "AuthenticationError";
  }
}
