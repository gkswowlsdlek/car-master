import { createSupabaseBrowserClient } from "../lib/supabase/client";
import type { InstallerApprovalStatus } from "../types/auth";

export type InstallerApplication = {
  userId: string; email: string; shopName: string; representativeName: string; businessName: string; businessRegistrationNumber: string;
  address: string; detailAddress?: string; phone: string; contactPhone: string; supportedServices: string[]; supportedBrands: string[];
  status: InstallerApprovalStatus; reviewNote?: string; createdAt?: string;
};
type InstallerApplicationJoinRow = { user_id: string; shop_name: string; representative_name: string; business_name: string; business_registration_number: string; address: string; detail_address: string | null; phone: string; contact_phone: string; supported_services: string[]; supported_brands: string[]; profiles: { email: string; created_at: string } | { email: string; created_at: string }[]; installer_approvals: { status: InstallerApprovalStatus; review_note: string | null } | { status: InstallerApprovalStatus; review_note: string | null }[] };

// Admin 회원 관리 화면의 공용 회원 행. 실제 데이터든 Demo 데이터든 같은
// 모양으로 매핑해서 AdminMemberPanel이 데이터소스를 구분하지 않고 렌더링한다.
export type AdminMemberRole = "dealer" | "installer";
export type AdminMember = {
  userId: string; email: string; role: AdminMemberRole; name: string; companyName: string; phone: string;
  createdAt: string | null; approvalStatus: InstallerApprovalStatus | null;
};
type DealerProfileJoinRow = { user_id: string; name: string; phone: string; company_name: string | null; profiles: { email: string; created_at: string } | { email: string; created_at: string }[] };

export class SupabaseMembershipRepository {
  async getInstallerApplications(): Promise<InstallerApplication[]> {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.from("installer_profiles").select("user_id,shop_name,representative_name,business_name,business_registration_number,address,detail_address,phone,contact_phone,supported_services,supported_brands,profiles!inner(email,created_at),installer_approvals!inner(status,review_note)");
    if (error) throw error;
    return ((data ?? []) as unknown as InstallerApplicationJoinRow[]).map((row) => {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      const approval = Array.isArray(row.installer_approvals) ? row.installer_approvals[0] : row.installer_approvals;
      return { userId: row.user_id, email: profile?.email ?? "", shopName: row.shop_name, representativeName: row.representative_name, businessName: row.business_name, businessRegistrationNumber: row.business_registration_number, address: row.address, detailAddress: row.detail_address ?? undefined, phone: row.phone, contactPhone: row.contact_phone, supportedServices: row.supported_services ?? [], supportedBrands: row.supported_brands ?? [], status: approval?.status ?? "pending", reviewNote: approval?.review_note ?? undefined, createdAt: profile?.created_at } as InstallerApplication;
    });
  }

  /**
   * Admin 전용 전체 회원 조회. 새 RPC/마이그레이션 없이 기존 RLS만으로 동작한다:
   * profiles/dealer_profiles/installer_profiles/installer_approvals 4개 테이블
   * 모두 "select ... using (user_id = auth.uid() or is_admin())" 정책이라
   * is_admin()인 세션에는 이미 전체 행이 열려 있다(202607190001 migration).
   * Dealer/Installer 본인 세션은 자기 행만 보이므로 이 메서드를 호출해도
   * 전체 회원이 노출되지 않는다 — 새 권한을 추가하는 게 아니라 이미 admin에게
   * 열려 있던 select 권한을 화면으로 옮기는 것뿐이다.
   */
  async getAllMembers(): Promise<AdminMember[]> {
    const supabase = createSupabaseBrowserClient();
    const [dealerResult, installerApplications] = await Promise.all([
      supabase.from("dealer_profiles").select("user_id,name,phone,company_name,profiles!inner(email,created_at)"),
      this.getInstallerApplications(),
    ]);
    if (dealerResult.error) throw dealerResult.error;
    const dealers: AdminMember[] = ((dealerResult.data ?? []) as unknown as DealerProfileJoinRow[]).map((row) => {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      return { userId: row.user_id, email: profile?.email ?? "", role: "dealer", name: row.name, companyName: row.company_name || "-", phone: row.phone, createdAt: profile?.created_at ?? null, approvalStatus: null };
    });
    const installers: AdminMember[] = installerApplications.map((item) => ({
      userId: item.userId, email: item.email, role: "installer", name: item.representativeName, companyName: item.shopName, phone: item.phone, createdAt: item.createdAt ?? null, approvalStatus: item.status,
    }));
    return [...dealers, ...installers].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  }

  async reviewInstaller(userId: string, status: InstallerApprovalStatus, reviewNote = "") {
    const supabase = createSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("로그인이 필요합니다.");
    const { error } = await supabase.from("installer_approvals").update({ status, review_note: reviewNote || null, reviewed_by: user.id, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("user_id", userId);
    if (error) throw error;
  }

  async getCurrentInstallerApplication() {
    const items = await this.getInstallerApplications();
    const { data: { user } } = await createSupabaseBrowserClient().auth.getUser();
    return items.find((item) => item.userId === user?.id) ?? null;
  }

  async updateInstallerApplication(value: InstallerApplication) {
    const { error } = await createSupabaseBrowserClient().from("installer_profiles").update({ shop_name: value.shopName, representative_name: value.representativeName, business_name: value.businessName, business_registration_number: value.businessRegistrationNumber, address: value.address, detail_address: value.detailAddress ?? null, phone: value.phone, contact_phone: value.contactPhone, supported_services: value.supportedServices, supported_brands: value.supportedBrands, updated_at: new Date().toISOString() }).eq("user_id", value.userId);
    if (error) throw error;
  }
}

export const membershipRepository = new SupabaseMembershipRepository();
