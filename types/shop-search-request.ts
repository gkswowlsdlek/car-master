export type ShopSearchRequestStatus = "requested" | "in_progress" | "shop_proposed" | "transaction_linked" | "cancelled" | "unable_to_connect";

/** The Shop currently proposed to the dealer for a request (status === "shop_proposed"). */
export type ProposedShop = {
  proposalId: string;
  shopId: string;
  shopName: string;
  address: string;
  phone?: string;
  supportedServices: string[];
  supportedBrands: string[];
};

/** Dealer-facing view — never carries adminNote. */
export type ShopSearchRequest = {
  id: string;
  region: string;
  workType: string;
  vehicleMaker: string;
  vehicleModel: string;
  desiredInboundDate: string;
  dateFlexible: boolean;
  dealerNote?: string;
  status: ShopSearchRequestStatus;
  createdAt: string;
  updatedAt: string;
  proposedShop?: ProposedShop;
};

/** Admin-facing view — includes dealer contact snapshot and the internal-only operational note. */
export type AdminShopSearchRequest = ShopSearchRequest & {
  dealerId: string;
  dealerName: string;
  dealerPhone: string;
  adminNote?: string;
  /** Set once an Admin has quick-registered a Shop while working this request (Phase 3). */
  registeredShopId?: string;
  /** Only the name, for the Admin's compact list row — full detail comes from proposedShop. */
  proposedShopName?: string;
};

export type CreateShopSearchRequestInput = {
  region: string;
  workType: string;
  vehicleMaker: string;
  vehicleModel: string;
  desiredInboundDate: string;
  dateFlexible: boolean;
  dealerNote?: string;
};
