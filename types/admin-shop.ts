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
