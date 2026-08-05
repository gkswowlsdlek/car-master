import type { DemoAccount } from "../../types/dealer";
import { normalizeUserRole, type CurrentUser, type DealerOnboardingInput, type InstallerOnboardingInput, type SignUpInput, type SignUpResult } from "../../types/auth.ts";
import { AuthenticationError, type AuthCredentials, type AuthProvider } from "./auth-provider.ts";

export class DemoAuthProvider implements AuthProvider {
  private currentUser: CurrentUser | null = null;
  private readonly accounts: readonly DemoAccount[];

  constructor(accounts: readonly DemoAccount[]) {
    this.accounts = accounts;
  }

  getCurrentUser() {
    return this.currentUser;
  }

  async initialize() { return this.currentUser; }

  async login({ email, password }: AuthCredentials) {
    const account = this.accounts.find((item) => item.email.toLowerCase() === email.trim().toLowerCase() && item.password === password);
    if (!account) throw new AuthenticationError();

    this.currentUser = {
      id: account.id,
      email: account.email,
      name: account.name,
      role: normalizeUserRole(account.role),
      installerId: account.shopId,
    };
    return this.currentUser;
  }

  async logout() {
    this.currentUser = null;
  }

  async signUp(_input: SignUpInput): Promise<SignUpResult> {
    void _input;
    throw new Error("개발 데모 모드에서는 실제 회원가입을 사용할 수 없습니다. Supabase 환경변수를 설정해 주세요.");
  }

  async requestPasswordReset(_email: string): Promise<void> {
    void _email;
    throw new Error("개발 데모 모드에서는 비밀번호 재설정을 사용할 수 없습니다. Supabase 환경변수를 설정해 주세요.");
  }

  async exchangeRecoveryCode(_code: string): Promise<boolean> {
    void _code;
    return false;
  }

  async completeDealerOnboarding(_input: DealerOnboardingInput): Promise<CurrentUser> {
    void _input;
    throw new Error("개발 데모 모드에서는 온보딩을 사용할 수 없습니다. Supabase 환경변수를 설정해 주세요.");
  }

  async completeInstallerOnboarding(_input: InstallerOnboardingInput): Promise<CurrentUser> {
    void _input;
    throw new Error("개발 데모 모드에서는 온보딩을 사용할 수 없습니다. Supabase 환경변수를 설정해 주세요.");
  }

  async updatePassword(_newPassword: string, _currentPassword?: string): Promise<void> {
    void _newPassword; void _currentPassword;
    throw new Error("개발 데모 모드에서는 비밀번호 변경을 사용할 수 없습니다. Supabase 환경변수를 설정해 주세요.");
  }
}
