import { createSupabaseBrowserClient } from "../lib/supabase/client";
import type { InstallerApprovalStatus } from "../types/auth";

export type InstallerApplication = {
  userId: string; email: string; shopName: string; representativeName: string; businessName: string; businessRegistrationNumber: string;
  address: string; detailAddress?: string; phone: string; contactPhone: string; supportedServices: string[]; supportedBrands: string[];
  status: InstallerApprovalStatus; reviewNote?: string;
};
type InstallerApplicationJoinRow = { user_id: string; shop_name: string; representative_name: string; business_name: string; business_registration_number: string; address: string; detail_address: string | null; phone: string; contact_phone: string; supported_services: string[]; supported_brands: string[]; profiles: { email: string } | { email: string }[]; installer_approvals: { status: InstallerApprovalStatus; review_note: string | null } | { status: InstallerApprovalStatus; review_note: string | null }[] };

export class SupabaseMembershipRepository {
  async getInstallerApplications(): Promise<InstallerApplication[]> {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.from("installer_profiles").select("user_id,shop_name,representative_name,business_name,business_registration_number,address,detail_address,phone,contact_phone,supported_services,supported_brands,profiles!inner(email),installer_approvals!inner(status,review_note)");
    if (error) throw error;
    return ((data ?? []) as unknown as InstallerApplicationJoinRow[]).map((row) => {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      const approval = Array.isArray(row.installer_approvals) ? row.installer_approvals[0] : row.installer_approvals;
      return { userId: row.user_id, email: profile?.email ?? "", shopName: row.shop_name, representativeName: row.representative_name, businessName: row.business_name, businessRegistrationNumber: row.business_registration_number, address: row.address, detailAddress: row.detail_address ?? undefined, phone: row.phone, contactPhone: row.contact_phone, supportedServices: row.supported_services ?? [], supportedBrands: row.supported_brands ?? [], status: approval?.status ?? "pending", reviewNote: approval?.review_note ?? undefined } as InstallerApplication;
    });
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
