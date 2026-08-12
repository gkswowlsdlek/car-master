export type ShopSearchRequestStatus = "requested" | "in_progress" | "cancelled" | "unable_to_connect";

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
};

/** Admin-facing view — includes dealer contact snapshot and the internal-only operational note. */
export type AdminShopSearchRequest = ShopSearchRequest & {
  dealerId: string;
  dealerName: string;
  dealerPhone: string;
  adminNote?: string;
  /** Set once an Admin has quick-registered a Shop while working this request (Phase 3). */
  registeredShopId?: string;
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
