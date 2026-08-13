export type ShopClaimRequestStatus = "pending" | "approved" | "rejected" | "cancelled";

/** A Shop Claim request as Admin sees it — joins in the shop and requester
 * identity so the panel never has to issue a second lookup. */
export type AdminShopClaimRequest = {
  id: string;
  shopId: string;
  shopName: string;
  shopAddress: string;
  shopPhone: string;
  requesterId: string;
  requesterEmail: string;
  status: ShopClaimRequestStatus;
  note: string;
  reviewNote?: string;
  createdAt: string;
  updatedAt: string;
};
