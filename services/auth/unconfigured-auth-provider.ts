import type { AuthProvider } from "./auth-provider";
import type { AuthCredentials } from "./auth-provider";
import type { CurrentUser, SignUpInput, SignUpResult } from "../../types/auth";

const configurationError = () => new Error("현재 회원 시스템 설정을 확인하고 있습니다. 운영팀에 문의해 주세요.");

export class UnconfiguredAuthProvider implements AuthProvider {
  getCurrentUser() { return null; }
  async initialize() { return null; }
  async login(_credentials: AuthCredentials): Promise<CurrentUser> { void _credentials; throw configurationError(); }
  async signUp(_input: SignUpInput): Promise<SignUpResult> { void _input; throw configurationError(); }
  async logout() { /* no active session */ }
}
