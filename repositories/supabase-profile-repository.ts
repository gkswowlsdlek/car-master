import { createSupabaseBrowserClient } from "../lib/supabase/client";
import type { UserProfile } from "../types/transactions";

export class SupabaseProfileRepository {
  async getById(userId: string, role: "dealer" | "shop"): Promise<UserProfile | null> {
    const supabase = createSupabaseBrowserClient();
    const { data: baseData } = await supabase.from("profiles").select("email").eq("id", userId).single();
    const base = baseData as { email: string } | null;
    if (!base) return null;
    if (role === "dealer") {
      const { data: dealerData } = await supabase.from("dealer_profiles").select("name,phone,company_name,activity_region").eq("user_id", userId).single();
      const data = dealerData as { name: string; phone: string; company_name: string | null; activity_region: string | null } | null;
      return data ? { id: userId, role, name: data.name, phone: data.phone, email: base.email, companyName: data.company_name ?? undefined, activityArea: data.activity_region ?? undefined, notifications: { request: true, chat: true, schedule: true, marketing: false } } : null;
    }
    const { data: installerData } = await supabase.from("installer_profiles").select("shop_name,representative_name,address,detail_address,phone,contact_phone,supported_brands,supported_services,business_hours,closed_days,introduction,emergency_available").eq("user_id", userId).single();
    const data = installerData as { shop_name: string; representative_name: string; address: string; detail_address: string | null; phone: string; contact_phone: string; supported_brands: string[]; supported_services: string[]; business_hours: string | null; closed_days: string | null; introduction: string | null; emergency_available: boolean } | null;
    return data ? { id: userId, role, name: data.shop_name, representativeName: data.representative_name, address: `${data.address}${data.detail_address ? ` ${data.detail_address}` : ""}`, phone: data.phone, email: base.email, brands: data.supported_brands, works: data.supported_services, hours: data.business_hours ?? undefined, closedDays: data.closed_days ?? undefined, introduction: data.introduction ?? undefined, emergencyAvailable: data.emergency_available, notifications: { request: true, chat: true, schedule: true, marketing: false } } : null;
  }

  async save(profile: UserProfile) {
    const supabase = createSupabaseBrowserClient();
    const table = profile.role === "dealer" ? "dealer_profiles" : "installer_profiles";
    const values = profile.role === "dealer" ? { name: profile.name, phone: profile.phone, company_name: profile.companyName ?? null, activity_region: profile.activityArea ?? null, updated_at: new Date().toISOString() } : { shop_name: profile.name, representative_name: profile.representativeName ?? "", address: profile.address ?? "", detail_address: null, phone: profile.phone, supported_brands: profile.brands ?? [], supported_services: profile.works ?? [], business_hours: profile.hours ?? null, closed_days: profile.closedDays ?? null, introduction: profile.introduction ?? null, emergency_available: Boolean(profile.emergencyAvailable), updated_at: new Date().toISOString() };
    const { error } = await supabase.from(table).update(values).eq("user_id", profile.id);
    if (error) throw error;
  }
}

export const supabaseProfileRepository = new SupabaseProfileRepository();
