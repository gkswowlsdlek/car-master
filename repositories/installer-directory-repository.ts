import { createSupabaseBrowserClient } from "../lib/supabase/client";
import type { Brand, RegionKey, WorkType } from "../lib/dealer-flow-data";
import type { InstallerListing } from "../types/installer";

type DirectoryRow = {
  id: string; name: string; address: string; brands: string[]; works: string[];
  hours: string | null; available: boolean; latitude: number | null; longitude: number | null;
};

// Real installer addresses are free text entered at sign-up (types/auth.ts
// InstallerSignUpInput), not structured 시/도·시/군/구 fields, so this is a
// best-effort split for filter/display purposes only.
function splitAddress(address: string): { province: string; city: string } {
  const [province = "", city = ""] = address.trim().split(/\s+/, 2);
  return { province: province || "정보 없음", city: city || "" };
}

export class InstallerDirectoryRepository {
  async getApproved(): Promise<InstallerListing[]> {
    const { data, error } = await createSupabaseBrowserClient().rpc("get_approved_installer_directory");
    if (error) throw error;
    return ((data ?? []) as DirectoryRow[]).map((item) => {
      const { province, city } = splitAddress(item.address);
      return {
        id: item.id, name: item.name, address: item.address, district: item.address,
        province, city, region: "metro" as RegionKey, lat: item.latitude ?? undefined, lng: item.longitude ?? undefined,
        brands: item.brands as Brand[], works: item.works as WorkType[], hours: item.hours ?? "영업시간 확인 필요",
        available: item.available, approved: true, rating: 0, reviewCount: 0, responseTime: "응답 정보 없음",
        recentTransactionCount: 0, nextAvailableDate: "일정 확인 필요", isDemo: false,
      };
    });
  }
}

export const installerDirectoryRepository = new InstallerDirectoryRepository();
