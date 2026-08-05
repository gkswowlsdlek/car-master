import type { AuthProvider } from "./auth-provider";
import type { AuthCredentials } from "./auth-provider";
import type { CurrentUser, DealerOnboardingInput, InstallerOnboardingInput, SignUpInput, SignUpResult } from "../../types/auth";

const configurationError = () => new Error("현재 회원 시스템 설정을 확인하고 있습니다. 운영팀에 문의해 주세요.");

export class UnconfiguredAuthProvider implements AuthProvider {
  getCurrentUser() { return null; }
  async initialize() { return null; }
  async login(_credentials: AuthCredentials): Promise<CurrentUser> { void _credentials; throw configurationError(); }
  async signUp(_input: SignUpInput): Promise<SignUpResult> { void _input; throw configurationError(); }
  async logout() { /* no active session */ }
  async requestPasswordReset(_email: string): Promise<void> { void _email; throw configurationError(); }
  async exchangeRecoveryCode(_code: string): Promise<boolean> { void _code; return false; }
  async completeDealerOnboarding(_input: DealerOnboardingInput): Promise<CurrentUser> { void _input; throw configurationError(); }
  async completeInstallerOnboarding(_input: InstallerOnboardingInput): Promise<CurrentUser> { void _input; throw configurationError(); }
  async updatePassword(_newPassword: string, _currentPassword?: string): Promise<void> { void _newPassword; void _currentPassword; throw configurationError(); }
}
