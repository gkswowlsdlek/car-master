import { createSupabaseBrowserClient } from "../lib/supabase/client";

export type ShopManagementRecord = {
  id: string;
  shopName: string;
  address: string;
  detailAddress: string | null;
  phone: string;
  contactPhone: string;
  businessHours: string | null;
  closedDays: string | null;
  supportedBrands: string[];
  supportedServices: string[];
  introduction: string | null;
  acceptingRequests: boolean;
  approvalStatus: string;
  ownershipStatus: string;
  membershipRole: "owner" | "manager" | "staff" | null;
  membershipStatus: "active" | "suspended" | "revoked" | null;
};

type ShopRow = {
  id: string;
  shop_name: string;
  address: string;
  detail_address: string | null;
  phone: string;
  contact_phone: string;
  business_hours: string | null;
  closed_days: string | null;
  supported_brands: string[];
  supported_services: string[];
  introduction: string | null;
  accepting_requests: boolean;
  approval_status: string;
  ownership_status: string;
};

function map(
  row: ShopRow,
  membershipRole: ShopManagementRecord["membershipRole"],
  membershipStatus: ShopManagementRecord["membershipStatus"],
): ShopManagementRecord {
  return {
    id: row.id,
    shopName: row.shop_name,
    address: row.address,
    detailAddress: row.detail_address,
    phone: row.phone,
    contactPhone: row.contact_phone,
    businessHours: row.business_hours,
    closedDays: row.closed_days,
    supportedBrands: row.supported_brands ?? [],
    supportedServices: row.supported_services ?? [],
    introduction: row.introduction,
    acceptingRequests: row.accepting_requests,
    approvalStatus: row.approval_status,
    ownershipStatus: row.ownership_status,
    membershipRole,
    membershipStatus,
  };
}

export class ShopManagementRepository {
  async getActiveShopIdsForUser(userId: string): Promise<string[]> {
    const { data, error } = await createSupabaseBrowserClient()
      .from("shop_memberships")
      .select("shop_id")
      .eq("user_id", userId)
      .eq("status", "active");
    if (error) throw error;
    return ((data ?? []) as { shop_id: string }[]).map((membership) => membership.shop_id).filter(Boolean);
  }

  async getForUser(userId: string): Promise<ShopManagementRecord | null> {
    const client = createSupabaseBrowserClient();
    const { data: memberships, error: membershipError } = await client
      .from("shop_memberships")
      .select("shop_id,membership_role,status")
      .eq("user_id", userId)
      .in("status", ["active", "suspended"]);
    if (membershipError) throw membershipError;
    const membership =
      (
        memberships as
          | {
              shop_id: string;
              membership_role: ShopManagementRecord["membershipRole"];
              status: ShopManagementRecord["membershipStatus"];
            }[]
          | null
      )?.find((item) => item.status === "active") ??
      (
        memberships as
          | {
              shop_id: string;
              membership_role: ShopManagementRecord["membershipRole"];
              status: ShopManagementRecord["membershipStatus"];
            }[]
          | null
      )?.[0];
    if (!membership) return null;
    const { data, error } = await client
      .from("installer_shops")
      .select(
        "id,shop_name,address,detail_address,phone,contact_phone,business_hours,closed_days,supported_brands,supported_services,introduction,accepting_requests,approval_status,ownership_status",
      )
      .eq("id", membership.shop_id)
      .single();
    if (error) throw error;
    return map(data as ShopRow, membership.membership_role, membership.status);
  }

  async updateOperatingProfile(
    shopId: string,
    payload: Partial<
      Omit<ShopManagementRecord, "id" | "approvalStatus" | "ownershipStatus" | "membershipRole" | "membershipStatus">
    >,
    /** Real geocoded coordinates for the NEW `payload.address`
     * (services/geocoding-service.ts) — pass only when the address actually
     * changed and geocoding succeeded. Omitted otherwise so the RPC's own
     * address-changed guard clears any now-stale coordinate to NULL instead
     * of silently keeping one that points at the old address. */
    coordinates?: { latitude: number; longitude: number },
  ): Promise<ShopManagementRecord> {
    const { data, error } = await createSupabaseBrowserClient().rpc("update_shop_operating_profile", {
      p_shop_id: shopId,
      p_payload: {
        shop_name: payload.shopName,
        address: payload.address,
        detail_address: payload.detailAddress,
        phone: payload.phone,
        contact_phone: payload.contactPhone,
        business_hours: payload.businessHours,
        closed_days: payload.closedDays,
        supported_brands: payload.supportedBrands,
        supported_services: payload.supportedServices,
        introduction: payload.introduction,
        accepting_requests: payload.acceptingRequests,
        ...(coordinates ? { latitude: coordinates.latitude, longitude: coordinates.longitude } : {}),
      },
    });
    if (error) throw error;
    const row = (Array.isArray(data) ? data[0] : data) as ShopRow | undefined;
    if (!row) throw new Error("Shop 운영정보를 저장하지 못했습니다.");
    return map(row, null, null);
  }
}

export const shopManagementRepository = new ShopManagementRepository();
