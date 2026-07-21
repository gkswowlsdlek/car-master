import { createSupabaseBrowserClient } from "../lib/supabase/client";
import type { Brand, InstallerShop, RegionKey, WorkType } from "../lib/dealer-flow-data";

type DirectoryRow = {
  id: string; name: string; address: string; brands: string[]; works: string[];
  hours: string | null; available: boolean; latitude: number | null; longitude: number | null;
};

export class InstallerDirectoryRepository {
  async getApproved(): Promise<InstallerShop[]> {
    const { data, error } = await createSupabaseBrowserClient().rpc("get_approved_installer_directory");
    if (error) throw error;
    return ((data ?? []) as DirectoryRow[]).map((item) => ({
      id: item.id, name: item.name, address: item.address, district: item.address,
      region: "metro" as RegionKey, lat: item.latitude ?? undefined, lng: item.longitude ?? undefined,
      brands: item.brands as Brand[], works: item.works as WorkType[], hours: item.hours ?? "영업시간 확인 필요",
      available: item.available, approved: true, rating: 0, responseTime: "응답 정보 없음", recentTransactionCount: 0,
    }));
  }
}

export const installerDirectoryRepository = new InstallerDirectoryRepository();
