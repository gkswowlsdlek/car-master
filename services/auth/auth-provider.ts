import type { CurrentUser, SignUpInput, SignUpResult } from "../../types/auth";

export type AuthCredentials = { email: string; password: string };

export interface AuthProvider {
  getCurrentUser(): CurrentUser | null;
  initialize(): Promise<CurrentUser | null>;
  login(credentials: AuthCredentials): Promise<CurrentUser>;
  signUp(input: SignUpInput): Promise<SignUpResult>;
  logout(): Promise<void>;
  subscribe?(listener: (user: CurrentUser | null) => void): () => void;
}

export class AuthenticationError extends Error {
  constructor() {
    super("아이디 또는 비밀번호가 올바르지 않습니다.");
    this.name = "AuthenticationError";
  }
}
