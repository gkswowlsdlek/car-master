import { createSupabaseBrowserClient } from "../lib/supabase/client";
import { isSupabaseConfigured } from "../lib/supabase/config";
import { demoAccounts } from "../data/demo-accounts";
import { defaultDealerCompanyName } from "../components/profile/ProfileEditor";
import type { InstallerApprovalStatus } from "../types/auth";
import type { AdminMember, InstallerApplication } from "./membership-repository";

// Demo-mode installer-membership backend — gives Demo Admin 3/3 an actual
// 시공점 가입 승인 workflow to exercise instead of a static placeholder.
// Mirrors membership-repository.ts's SupabaseMembershipRepository shape so
// InstallerApprovalPanel can call either one the same way. Physically
// isolated from installer_profiles/installer_approvals — see the migration
// comment (202608030001) for why anon has select-only here and every
// mutation goes through demo_review_installer_application instead.
//
// isSchemaReady() lets the panel detect "the migration hasn't been applied
// yet" and fall back to the pre-v0.3.13 placeholder instead of throwing —
// same graceful-degrade pattern as demo-transaction-repository.ts.

type ApplicationRow = {
  id: string;
  shop_name: string;
  representative_name: string;
  business_name: string;
  business_registration_number: string;
  address: string;
  detail_address: string;
  phone: string;
  contact_phone: string;
  supported_services: string[];
  supported_brands: string[];
  status: InstallerApprovalStatus;
  review_note: string;
};

function mapApplication(row: ApplicationRow): InstallerApplication {
  return {
    userId: row.id,
    email: "",
    shopName: row.shop_name,
    representativeName: row.representative_name,
    businessName: row.business_name,
    businessRegistrationNumber: row.business_registration_number,
    address: row.address,
    detailAddress: row.detail_address || undefined,
    phone: row.phone,
    contactPhone: row.contact_phone,
    supportedServices: row.supported_services ?? [],
    supportedBrands: row.supported_brands ?? [],
    status: row.status,
    reviewNote: row.review_note || undefined,
  };
}

/** Postgres codes for "relation/function does not exist" — the migration hasn't been applied yet. */
const SCHEMA_MISSING_CODES = new Set(["42P01", "42883", "PGRST202", "PGRST205"]);

export class DemoMembershipRepository {
  private schemaReadyPromise: Promise<boolean> | null = null;

  async isSchemaReady(): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    if (!this.schemaReadyPromise) {
      this.schemaReadyPromise = (async () => {
        try {
          const { error } = await createSupabaseBrowserClient()
            .from("demo_installer_applications")
            .select("id")
            .limit(1);
          return !error || !SCHEMA_MISSING_CODES.has(error.code ?? "");
        } catch {
          return false;
        }
      })();
    }
    return this.schemaReadyPromise;
  }

  async getInstallerApplications(): Promise<InstallerApplication[]> {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await createSupabaseBrowserClient()
      .from("demo_installer_applications")
      .select(
        "id,shop_name,representative_name,business_name,business_registration_number,address,detail_address,phone,contact_phone,supported_services,supported_brands,status,review_note",
      )
      .order("created_at", { ascending: true });
    if (error) throw error;
    return ((data ?? []) as ApplicationRow[]).map(mapApplication);
  }

  async reviewInstaller(applicationId: string, status: InstallerApprovalStatus, reviewNote = "") {
    const { error } = await createSupabaseBrowserClient().rpc("demo_review_installer_application", {
      p_application_id: applicationId,
      p_status: status,
      p_review_note: reviewNote,
      p_actor_role: "admin",
    });
    if (error) throw error;
  }

  /**
   * Demo Admin 3/3의 회원 목록은 demo_installer_applications(연습용 승인
   * 대기열 fixture 3건)이 아니라 demoAccounts의 고정 roster(Demo Dealer 1/1,
   * Demo Installer 2/2)에서 나온다 — 이미 정상 동작 중인 데모 시공점 계정의
   * 상태를 연습용 큐 데이터와 섞으면 둘의 의미가 달라 혼란만 커진다. 그래서
   * 이 메서드는 스키마 준비 여부와 무관하게 항상 즉시 반환된다 (Real 회원을
   * 절대 포함하지 않음 — Demo/Real isolation 유지).
   */
  async getAllMembers(): Promise<AdminMember[]> {
    return demoAccounts
      .filter(
        (account): account is typeof account & { role: "dealer" | "shop" } =>
          account.role === "dealer" || account.role === "shop",
      )
      .map((account) => ({
        userId: account.id,
        email: account.email || "-",
        role: account.role === "shop" ? "installer" : "dealer",
        name: account.name,
        companyName: account.role === "shop" ? account.name : defaultDealerCompanyName,
        phone: account.phone ?? "-",
        createdAt: null,
        approvalStatus: account.role === "shop" ? "approved" : null,
      }));
  }

  subscribe(listener: () => void) {
    if (!isSupabaseConfigured) return () => {};
    const client = createSupabaseBrowserClient();
    const channel = client
      .channel("car-master-demo-installer-applications")
      .on("postgres_changes", { event: "*", schema: "public", table: "demo_installer_applications" }, listener)
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }
}

export const demoMembershipRepository = new DemoMembershipRepository();
