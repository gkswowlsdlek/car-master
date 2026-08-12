import { createSupabaseBrowserClient } from "../lib/supabase/client";
import type { DuplicateShopCandidate, QuickRegisterShopInput, SearchableShop } from "../types/admin-shop";

type DuplicateRow = { id: string; shop_name: string; address: string; phone: string; approval_status: string; ownership_status: "unclaimed" | "claimed" };
type SearchableShopRow = { id: string; shop_name: string; address: string; phone: string; supported_services: string[]; supported_brands: string[] };

/** DUPLICATE_CANDIDATE_EXISTS from admin_register_shop's own server-side re-check. */
export const DUPLICATE_CANDIDATE_ERROR = "DUPLICATE_CANDIDATE_EXISTS";

export class AdminShopRepository {
  async findDuplicateCandidates(phone: string, shopName: string, address: string): Promise<DuplicateShopCandidate[]> {
    const { data, error } = await createSupabaseBrowserClient().rpc("find_duplicate_shop_candidates", {
      p_phone: phone, p_shop_name: shopName, p_address: address,
    });
    if (error) throw error;
    return ((data ?? []) as DuplicateRow[]).map((row) => ({
      id: row.id, shopName: row.shop_name, address: row.address, phone: row.phone,
      approvalStatus: row.approval_status, ownershipStatus: row.ownership_status,
    }));
  }

  /** Real, stored Shop data — never a fake/local placeholder. Throws with
   * message DUPLICATE_CANDIDATE_ERROR when a candidate exists and the
   * caller hasn't set confirmDuplicate. */
  async quickRegister(input: QuickRegisterShopInput): Promise<string> {
    const { data, error } = await createSupabaseBrowserClient().rpc("admin_register_shop", { payload: {
      shopName: input.shopName, address: input.address, phone: input.phone,
      supportedServices: input.supportedServices, supportedBrands: input.supportedBrands,
      requestId: input.requestId, confirmDuplicate: input.confirmDuplicate ?? false,
    } });
    if (error) throw error;
    return data as string;
  }

  /** Approved Shops only, real DB data — used when Admin proposes an existing Shop (not one they just quick-registered). */
  async searchShops(query: string): Promise<SearchableShop[]> {
    const { data, error } = await createSupabaseBrowserClient().rpc("admin_search_shops", { p_query: query });
    if (error) throw error;
    return ((data ?? []) as SearchableShopRow[]).map((row) => ({
      id: row.id, shopName: row.shop_name, address: row.address, phone: row.phone,
      supportedServices: row.supported_services ?? [], supportedBrands: row.supported_brands ?? [],
    }));
  }
}

export const adminShopRepository = new AdminShopRepository();
