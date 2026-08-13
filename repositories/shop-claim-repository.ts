import { createSupabaseBrowserClient } from "../lib/supabase/client";
import type { AdminShopClaimRequest, ShopClaimRequestStatus } from "../types/shop-claim";

type ShopClaimRow = {
  id: string; shop_id: string; requester_id: string; status: ShopClaimRequestStatus; note: string;
  review_note: string | null; created_at: string; updated_at: string;
  installer_shops: { shop_name: string; address: string; phone: string } | { shop_name: string; address: string; phone: string }[] | null;
  profiles: { email: string } | { email: string }[] | null;
};

function mapRow(row: ShopClaimRow): AdminShopClaimRequest {
  const shop = Array.isArray(row.installer_shops) ? row.installer_shops[0] : row.installer_shops;
  const requester = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  return {
    id: row.id, shopId: row.shop_id, shopName: shop?.shop_name ?? "-", shopAddress: shop?.address ?? "", shopPhone: shop?.phone ?? "",
    requesterId: row.requester_id, requesterEmail: requester?.email ?? "-",
    status: row.status, note: row.note, reviewNote: row.review_note ?? undefined,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

export class ShopClaimRepository {
  /**
   * Admin-only listing — no new RPC/migration needed. shop_claim_requests'
   * existing SELECT policy is `requester_id = auth.uid() or is_admin()`
   * (202608120001_pre_kakao_shop_claim_foundation.sql), so an admin session
   * already has full row access; this just moves that access onto a screen.
   * Pending-first, then oldest first within each group, matching the same
   * "오래된 미처리 건 우선" ordering already used for Shop Search Requests.
   * Capped at 200 — Shop Claim volume is inherently small (one claim per
   * unclaimed Shop at most), but every new admin list gets a limit from the start.
   */
  async getAllForAdmin(): Promise<AdminShopClaimRequest[]> {
    const { data, error } = await createSupabaseBrowserClient().from("shop_claim_requests")
      .select("id,shop_id,requester_id,status,note,review_note,created_at,updated_at,installer_shops(shop_name,address,phone),profiles!requester_id(email)")
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) throw error;
    const rows = ((data ?? []) as unknown as ShopClaimRow[]).map(mapRow);
    const rank = (status: ShopClaimRequestStatus) => (status === "pending" ? 0 : 1);
    return rows.sort((a, b) => rank(a.status) - rank(b.status));
  }

  /** Reuses the existing admin-gated review_shop_claim RPC (approve inserts
   * the shop_membership + flips ownership_status to claimed; reject just
   * records the decision) — no new business logic, no new RPC. */
  async review(requestId: string, approve: boolean, note = ""): Promise<void> {
    const { error } = await createSupabaseBrowserClient().rpc("review_shop_claim", {
      p_request_id: requestId, p_approve: approve, p_note: note || null,
    });
    if (error) throw error;
  }
}

export const shopClaimRepository = new ShopClaimRepository();
