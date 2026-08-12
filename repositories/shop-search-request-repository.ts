import { createSupabaseBrowserClient } from "../lib/supabase/client";
import type { AdminShopSearchRequest, CreateShopSearchRequestInput, ShopSearchRequest, ShopSearchRequestStatus } from "../types/shop-search-request";

type DealerRow = {
  id: string; region: string; work_type: string; vehicle_maker: string; vehicle_model: string;
  desired_inbound_date: string; date_flexible: boolean; dealer_note: string | null;
  status: ShopSearchRequestStatus; created_at: string; updated_at: string;
  proposal_id: string | null; proposed_shop_id: string | null; proposed_shop_name: string | null;
  proposed_shop_address: string | null; proposed_shop_phone: string | null;
  proposed_shop_services: string[] | null; proposed_shop_brands: string[] | null;
};

type AdminRow = DealerRow & {
  dealer_id: string; dealer_name: string; dealer_phone: string; admin_note: string | null; registered_shop_id: string | null;
};

function mapDealerRow(row: DealerRow): ShopSearchRequest {
  return {
    id: row.id, region: row.region, workType: row.work_type, vehicleMaker: row.vehicle_maker, vehicleModel: row.vehicle_model,
    desiredInboundDate: row.desired_inbound_date, dateFlexible: row.date_flexible, dealerNote: row.dealer_note ?? undefined,
    status: row.status, createdAt: row.created_at, updatedAt: row.updated_at,
    proposedShop: row.proposal_id && row.proposed_shop_id ? {
      proposalId: row.proposal_id, shopId: row.proposed_shop_id, shopName: row.proposed_shop_name ?? "",
      address: row.proposed_shop_address ?? "", phone: row.proposed_shop_phone ?? undefined,
      supportedServices: row.proposed_shop_services ?? [], supportedBrands: row.proposed_shop_brands ?? [],
    } : undefined,
  };
}

export class ShopSearchRequestRepository {
  async create(input: CreateShopSearchRequestInput): Promise<string> {
    const { data, error } = await createSupabaseBrowserClient().rpc("create_shop_search_request", { payload: {
      region: input.region, workType: input.workType, vehicleMaker: input.vehicleMaker, vehicleModel: input.vehicleModel,
      desiredInboundDate: input.desiredInboundDate, dateFlexible: input.dateFlexible, dealerNote: input.dealerNote,
    } });
    if (error) throw error;
    return data as string;
  }

  async getMine(): Promise<ShopSearchRequest[]> {
    const { data, error } = await createSupabaseBrowserClient().rpc("get_my_shop_search_requests");
    if (error) throw error;
    return ((data ?? []) as DealerRow[]).map(mapDealerRow);
  }

  async cancel(requestId: string): Promise<void> {
    const { error } = await createSupabaseBrowserClient().rpc("cancel_shop_search_request", { p_request_id: requestId });
    if (error) throw error;
  }

  /** Reuses Phase 1's create_shop_transaction_with_room under the hood (server-side) — same Transaction/Room shape, no parallel creation path. */
  async acceptProposal(proposalId: string, vehicleClass: string): Promise<{ transactionId: string; roomId: string }> {
    const { data, error } = await createSupabaseBrowserClient().rpc("accept_shop_search_proposal", { p_proposal_id: proposalId, p_vehicle_class: vehicleClass });
    if (error) throw error;
    const result = data as { transactionId: string; roomId: string };
    return { transactionId: result.transactionId, roomId: result.roomId };
  }

  async declineProposal(proposalId: string, note?: string): Promise<void> {
    const { error } = await createSupabaseBrowserClient().rpc("decline_shop_search_proposal", { p_proposal_id: proposalId, p_note: note ?? null });
    if (error) throw error;
  }

  async getAllForAdmin(): Promise<AdminShopSearchRequest[]> {
    const { data, error } = await createSupabaseBrowserClient().rpc("get_admin_shop_search_requests");
    if (error) throw error;
    return ((data ?? []) as AdminRow[]).map((row) => ({
      ...mapDealerRow(row), dealerId: row.dealer_id, dealerName: row.dealer_name, dealerPhone: row.dealer_phone,
      adminNote: row.admin_note ?? undefined, registeredShopId: row.registered_shop_id ?? undefined,
      proposedShopName: row.proposed_shop_name ?? undefined,
    }));
  }

  async startProcessing(requestId: string): Promise<void> {
    const { error } = await createSupabaseBrowserClient().rpc("admin_start_shop_search_request", { p_request_id: requestId });
    if (error) throw error;
  }

  async markUnableToConnect(requestId: string): Promise<void> {
    const { error } = await createSupabaseBrowserClient().rpc("admin_mark_shop_search_request_unable", { p_request_id: requestId });
    if (error) throw error;
  }

  async setAdminNote(requestId: string, note: string): Promise<void> {
    const { error } = await createSupabaseBrowserClient().rpc("admin_set_shop_search_request_note", { p_request_id: requestId, p_note: note });
    if (error) throw error;
  }

  async proposeShop(requestId: string, shopId: string): Promise<string> {
    const { data, error } = await createSupabaseBrowserClient().rpc("admin_propose_shop_for_request", { p_request_id: requestId, p_shop_id: shopId });
    if (error) throw error;
    return data as string;
  }
}

export const shopSearchRequestRepository = new ShopSearchRequestRepository();
