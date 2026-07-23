import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";
import type { CurrentUser, InstallerApprovalStatus, SignUpInput } from "../../types/auth";
import { AuthenticationError, type AuthCredentials, type AuthProvider } from "./auth-provider";

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
