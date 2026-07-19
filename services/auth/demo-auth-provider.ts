import type { DemoAccount } from "../../types/dealer";
import { normalizeUserRole, type CurrentUser, type SignUpInput, type SignUpResult } from "../../types/auth.ts";
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
}
