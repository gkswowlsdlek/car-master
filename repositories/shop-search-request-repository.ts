import { createSupabaseBrowserClient } from "../lib/supabase/client";
import type { AdminShopSearchRequest, CreateShopSearchRequestInput, ShopSearchRequest, ShopSearchRequestStatus } from "../types/shop-search-request";

type DealerRow = {
  id: string; region: string; work_type: string; vehicle_maker: string; vehicle_model: string;
  desired_inbound_date: string; date_flexible: boolean; dealer_note: string | null;
  status: ShopSearchRequestStatus; created_at: string; updated_at: string;
};

type AdminRow = DealerRow & { dealer_id: string; dealer_name: string; dealer_phone: string; admin_note: string | null };

function mapDealerRow(row: DealerRow): ShopSearchRequest {
  return {
    id: row.id, region: row.region, workType: row.work_type, vehicleMaker: row.vehicle_maker, vehicleModel: row.vehicle_model,
    desiredInboundDate: row.desired_inbound_date, dateFlexible: row.date_flexible, dealerNote: row.dealer_note ?? undefined,
    status: row.status, createdAt: row.created_at, updatedAt: row.updated_at,
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

  async getAllForAdmin(): Promise<AdminShopSearchRequest[]> {
    const { data, error } = await createSupabaseBrowserClient().rpc("get_admin_shop_search_requests");
    if (error) throw error;
    return ((data ?? []) as AdminRow[]).map((row) => ({
      ...mapDealerRow(row), dealerId: row.dealer_id, dealerName: row.dealer_name, dealerPhone: row.dealer_phone,
      adminNote: row.admin_note ?? undefined,
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
}

export const shopSearchRequestRepository = new ShopSearchRequestRepository();
