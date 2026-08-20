import type { Brand, WorkType } from "../lib/dealer-flow-data";

export type QuickRegisterShopInput = {
  shopName: string;
  address: string;
  phone: string;
  supportedServices: WorkType[];
  supportedBrands: Brand[];
  /** Links back to the Phase 2 shop_search_requests row this registration came from, if any. */
  requestId?: string;
  confirmDuplicate?: boolean;
  /** Real geocoded coordinates for `address` (services/geocoding-service.ts),
   * best-effort — undefined when geocoding wasn't configured/failed. Never a
   * fabricated fallback coordinate; registration must still succeed either way. */
  latitude?: number;
  longitude?: number;
};

export type DuplicateShopCandidate = {
  id: string;
  shopName: string;
  address: string;
  phone: string;
  approvalStatus: string;
  ownershipStatus: "unclaimed" | "claimed";
};

export type RegisteredShopResult = {
  id: string;
  shopName: string;
  address: string;
  phone: string;
  supportedServices: WorkType[];
  supportedBrands: Brand[];
};

/** A result row from admin_search_shops — used when Admin proposes an existing Shop for a Phase 2 request. */
export type SearchableShop = {
  id: string;
  shopName: string;
  address: string;
  phone: string;
  supportedServices: string[];
  supportedBrands: string[];
};

/** A row from the general "모든 Shop 관리" browse list — unlike SearchableShop
 * this includes every approval_status, not just approved. */
export type AdminShopListItem = {
  id: string;
  shopName: string;
  address: string;
  phone: string;
  supportedServices: string[];
  supportedBrands: string[];
  /** "업체 노출 상태" — approved = 검색/거래에 실제 사용 가능. */
  approvalStatus: "pending" | "approved" | "rejected" | "suspended";
  /** "업체 연결 상태" — claimed = 실제 운영자 계정이 연결됨. Never conflated with approvalStatus. */
  ownershipStatus: "unclaimed" | "claimed";
  createdAt: string;
};
