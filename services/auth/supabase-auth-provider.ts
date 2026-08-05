import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";
import type { CurrentUser, InstallerApprovalStatus, SignUpInput } from "../../types/auth";
import { AuthenticationError, type AuthCredentials, type AuthProvider } from "./auth-provider";

/**
 * Supabase Auth error messages arrive in English. Pattern-match the few
 * documented, recurring cases into short Korean copy; anything unrecognized
 * falls back to a generic message rather than guessing at exact server
 * wording. Never used for logging — this only ever reaches the screen.
 */
function translateAuthError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : "";
  const lower = message.toLowerCase();
  if (lower.includes("rate limit") || lower.includes("too many requests")) return "요청이 너무 많아요. 잠시 후 다시 시도해 주세요.";
  if (lower.includes("current") && lower.includes("password")) return "현재 비밀번호가 올바르지 않습니다.";
  if (lower.includes("should be at least") || lower.includes("weak") || (lower.includes("password") && lower.includes("short"))) return "비밀번호가 너무 짧거나 취약해요. 다른 비밀번호를 입력해 주세요.";
  if (lower.includes("should be different") || (lower.includes("same") && lower.includes("password"))) return "이전과 다른 비밀번호를 입력해 주세요.";
  if (lower.includes("expired") || (lower.includes("invalid") && (lower.includes("code") || lower.includes("token") || lower.includes("otp") || lower.includes("link") || lower.includes("flow")))) return "링크가 만료되었거나 이미 사용된 링크예요. 다시 요청해 주세요.";
  return fallback;
}

type ProfileRow = { id: string; email: string; role: "dealer" | "installer" | "admin" };

export class SupabaseAuthProvider implements AuthProvider {
  private currentUser: CurrentUser | null = null;

  getCurrentUser() { return this.currentUser; }

  private async resolveUser(user: User): Promise<CurrentUser> {
    const supabase = createSupabaseBrowserClient();
    const { data: profileData, error } = await supabase.from("profiles").select("id,email,role").eq("id", user.id).single();
    const profile = profileData as ProfileRow | null;
    if (error || !profile) throw new Error("회원 프로필을 불러오지 못했습니다. 관리자에게 문의해 주세요.");
    let name = profile.email;
    let approvalStatus: InstallerApprovalStatus | undefined;
    if (profile.role === "dealer") {
      const { data: dealerData } = await supabase.from("dealer_profiles").select("name").eq("user_id", user.id).single();
      const data = dealerData as { name: string } | null;
      name = data?.name ?? name;
    } else if (profile.role === "installer") {
      const [{ data: installerData }, { data: approvalData }] = await Promise.all([
        supabase.from("installer_profiles").select("shop_name").eq("user_id", user.id).single(),
        supabase.from("installer_approvals").select("status").eq("user_id", user.id).single(),
      ]);
      const installer = installerData as { shop_name: string } | null;
      const approval = approvalData as { status: InstallerApprovalStatus } | null;
      name = installer?.shop_name ?? name;
      approvalStatus = approval?.status ?? "pending";
    }
    this.currentUser = { id: profile.id, email: profile.email, name, role: profile.role, installerId: profile.role === "installer" ? profile.id : undefined, approvalStatus };
    return this.currentUser;
  }

  async initialize() {
    const { data: { user }, error } = await createSupabaseBrowserClient().auth.getUser();
    if (error?.name === "AuthSessionMissingError") { this.currentUser = null; return null; }
    if (error) throw error;
    if (!user) { this.currentUser = null; return null; }
    return this.resolveUser(user);
  }

  async login({ email, password }: AuthCredentials) {
    const { data, error } = await createSupabaseBrowserClient().auth.signInWithPassword({ email, password });
    if (error || !data.user) throw new AuthenticationError();
    return this.resolveUser(data.user);
  }

  async signUp(input: SignUpInput) {
    const origin = typeof window === "undefined" ? "" : window.location.origin;
    const metadata = input.role === "dealer" ? {
      signup_role: "dealer", name: input.name, phone: input.phone, company_name: input.companyName ?? "", activity_region: input.activityRegion ?? "",
    } : {
      signup_role: "installer", shop_name: input.shopName, representative_name: input.representativeName, business_name: input.businessName,
      business_registration_number: input.businessRegistrationNumber, address: input.address, detail_address: input.detailAddress ?? "", phone: input.phone,
      contact_phone: input.contactPhone, supported_services: input.supportedServices, supported_brands: input.supportedBrands,
    };
    const { data, error } = await createSupabaseBrowserClient().auth.signUp({ email: input.email, password: input.password, options: { data: metadata, emailRedirectTo: `${origin}/auth/callback?next=/login` } });
    if (error || !data.user) throw new Error(error?.message ?? "회원가입을 완료하지 못했습니다.");
    const user = data.session ? await this.resolveUser(data.user) : null;
    return { userId: data.user.id, requiresEmailConfirmation: !data.session, user };
  }

  async logout() {
    await createSupabaseBrowserClient().auth.signOut();
    this.currentUser = null;
  }

  async requestPasswordReset(email: string) {
    const origin = typeof window === "undefined" ? "" : window.location.origin;
    const { error } = await createSupabaseBrowserClient().auth.resetPasswordForEmail(email, { redirectTo: `${origin}/update-password` });
    // Supabase does not report "email not found" as an error (by design, to
    // avoid revealing which emails are registered) — only genuine failures
    // (malformed input, rate limiting) reach here.
    if (error) throw new Error(translateAuthError(error, "재설정 이메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요."));
  }

  async exchangeRecoveryCode(code: string): Promise<boolean> {
    try {
      const { data, error } = await createSupabaseBrowserClient().auth.exchangeCodeForSession(code);
      return !error && Boolean(data.session);
    } catch {
      return false;
    }
  }

  async hasValidSession(): Promise<boolean> {
    try {
      const { data, error } = await createSupabaseBrowserClient().auth.getUser();
      return !error && Boolean(data.user);
    } catch {
      return false;
    }
  }

  async updatePassword(newPassword: string, currentPassword?: string) {
    const { error } = await createSupabaseBrowserClient().auth.updateUser({
      password: newPassword,
      ...(currentPassword ? { current_password: currentPassword } : {}),
    });
    if (error) throw new Error(translateAuthError(error, "비밀번호를 변경하지 못했습니다. 잠시 후 다시 시도해 주세요."));
  }

  subscribe(listener: (user: CurrentUser | null) => void) {
    const { data: subscription } = createSupabaseBrowserClient().auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") return;
      if (event === "SIGNED_OUT" || !session?.user) {
        this.currentUser = null;
        listener(null);
        return;
      }
      if (event !== "SIGNED_IN") return;
      queueMicrotask(() => { void this.resolveUser(session.user).then(listener).catch(() => listener(null)); });
    });
    return () => subscription.subscription.unsubscribe();
  }
}
