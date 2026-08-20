import { createSupabaseBrowserClient } from "../lib/supabase/client";
import type {
  AdminShopListItem,
  DuplicateShopCandidate,
  QuickRegisterShopInput,
  SearchableShop,
} from "../types/admin-shop";

type DuplicateRow = {
  id: string;
  shop_name: string;
  address: string;
  phone: string;
  approval_status: string;
  ownership_status: "unclaimed" | "claimed";
};
type SearchableShopRow = {
  id: string;
  shop_name: string;
  address: string;
  phone: string;
  supported_services: string[];
  supported_brands: string[];
};
type ShopListRow = {
  id: string;
  shop_name: string;
  address: string;
  phone: string;
  supported_services: string[];
  supported_brands: string[];
  approval_status: "pending" | "approved" | "rejected" | "suspended";
  ownership_status: "unclaimed" | "claimed";
  created_at: string;
};

/** DUPLICATE_CANDIDATE_EXISTS from admin_register_shop's own server-side re-check. */
export const DUPLICATE_CANDIDATE_ERROR = "DUPLICATE_CANDIDATE_EXISTS";

export class AdminShopRepository {
  async findDuplicateCandidates(phone: string, shopName: string, address: string): Promise<DuplicateShopCandidate[]> {
    const { data, error } = await createSupabaseBrowserClient().rpc("find_duplicate_shop_candidates", {
      p_phone: phone,
      p_shop_name: shopName,
      p_address: address,
    });
    if (error) throw error;
    return ((data ?? []) as DuplicateRow[]).map((row) => ({
      id: row.id,
      shopName: row.shop_name,
      address: row.address,
      phone: row.phone,
      approvalStatus: row.approval_status,
      ownershipStatus: row.ownership_status,
    }));
  }

  /** Real, stored Shop data — never a fake/local placeholder. Throws with
   * message DUPLICATE_CANDIDATE_ERROR when a candidate exists and the
   * caller hasn't set confirmDuplicate. */
  async quickRegister(input: QuickRegisterShopInput): Promise<string> {
    const { data, error } = await createSupabaseBrowserClient().rpc("admin_register_shop", {
      payload: {
        shopName: input.shopName,
        address: input.address,
        phone: input.phone,
        supportedServices: input.supportedServices,
        supportedBrands: input.supportedBrands,
        requestId: input.requestId,
        confirmDuplicate: input.confirmDuplicate ?? false,
        // Omitted entirely (not sent as null) when geocoding didn't run/failed —
        // admin_register_shop's nullif(...,'') coercion only sees the key at
        // all when it's actually present, same effect either way but this
        // keeps the payload honest about what was actually known.
        ...(input.latitude != null && input.longitude != null
          ? { latitude: input.latitude, longitude: input.longitude }
          : {}),
      },
    });
    if (error) throw error;
    return data as string;
  }

  /** Approved Shops only, real DB data — used when Admin proposes an existing Shop (not one they just quick-registered). */
  async searchShops(query: string): Promise<SearchableShop[]> {
    const { data, error } = await createSupabaseBrowserClient().rpc("admin_search_shops", { p_query: query });
    if (error) throw error;
    return ((data ?? []) as SearchableShopRow[]).map((row) => ({
      id: row.id,
      shopName: row.shop_name,
      address: row.address,
      phone: row.phone,
      supportedServices: row.supported_services ?? [],
      supportedBrands: row.supported_brands ?? [],
    }));
  }

  /**
   * Admin-only "browse all Shops regardless of approval status" — no new
   * RPC/migration. installer_shops' existing SELECT policy is
   * `is_admin() or exists(active shop_memberships row)`
   * (202608090001_account_foundation_a_shop_membership.sql), so an admin
   * session already has full row access; admin_search_shops (used for the
   * proposal flow) deliberately excludes non-approved shops, which is wrong
   * for a general management view, so this is a separate direct query
   * instead of reusing that RPC. Capped at 200 — a new admin list, given a
   * limit from the start rather than left unbounded.
   */
  async listAll(query = "", limit = 200): Promise<AdminShopListItem[]> {
    const client = createSupabaseBrowserClient();
    let request = client
      .from("installer_shops")
      .select(
        "id,shop_name,address,phone,supported_services,supported_brands,approval_status,ownership_status,created_at",
      )
      .order("created_at", { ascending: false })
      .limit(limit);
    const trimmed = query.trim();
    if (trimmed)
      request = request.or(`shop_name.ilike.%${trimmed}%,address.ilike.%${trimmed}%,phone.ilike.%${trimmed}%`);
    const { data, error } = await request;
    if (error) throw error;
    return ((data ?? []) as ShopListRow[]).map((row) => ({
      id: row.id,
      shopName: row.shop_name,
      address: row.address,
      phone: row.phone,
      supportedServices: row.supported_services ?? [],
      supportedBrands: row.supported_brands ?? [],
      approvalStatus: row.approval_status,
      ownershipStatus: row.ownership_status,
      createdAt: row.created_at,
    }));
  }
}

export const adminShopRepository = new AdminShopRepository();
