import { createSupabaseBrowserClient } from "../lib/supabase/client";
import type { PaymentStatus, Transaction, TransactionStageEvent } from "../types/transactions";

type StageEventRow = {
  id: number; from_stage: TransactionStageEvent["fromStage"]; to_stage: TransactionStageEvent["toStage"];
  actor_role: TransactionStageEvent["actorRole"]; direction: TransactionStageEvent["direction"]; created_at: string;
};

type TransactionRow = {
  id: string; dealer_id: string; installer_id: string | null; shop_id: string | null; installer_name: string;
  vehicle: Transaction["vehicle"]; service: Transaction["service"]; pricing: Transaction["pricing"];
  schedule: Transaction["schedule"]; stage: Transaction["status"]["stage"]; outcome_note: string | null;
  hidden_by_dealer: boolean; hidden_by_installer: boolean; last_message: string;
  created_at: string; updated_at: string; transaction_rooms: { id: string } | { id: string }[] | null;
  transaction_stage_events: StageEventRow[] | null;
};

function mapTransaction(row: TransactionRow): Transaction {
  const room = Array.isArray(row.transaction_rooms) ? row.transaction_rooms[0] : row.transaction_rooms;
  const stageLog: TransactionStageEvent[] = (row.transaction_stage_events ?? [])
    .map((event) => ({ id: `EVT-${event.id}`, fromStage: event.from_stage, toStage: event.to_stage, actorRole: event.actor_role, direction: event.direction, createdAt: event.created_at }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return {
    id: row.id, dealerId: row.dealer_id, installerId: row.installer_id, shopId: row.shop_id ?? null, installerName: row.installer_name,
    vehicle: row.vehicle, service: row.service, pricing: row.pricing, schedule: row.schedule,
    status: { stage: row.stage, createdAt: row.created_at, updatedAt: row.updated_at },
    outcomeNote: row.outcome_note ?? undefined,
    visibility: { hiddenByDealer: row.hidden_by_dealer, hiddenByInstaller: row.hidden_by_installer },
    chatRoomId: room?.id ?? "", lastMessage: row.last_message, stageLog,
  };
}

export class SupabaseTransactionRepository {
  async getAll() {
    const { data, error } = await createSupabaseBrowserClient().from("transactions")
      .select("id,dealer_id,installer_id,shop_id,installer_name,vehicle,service,pricing,schedule,stage,outcome_note,hidden_by_dealer,hidden_by_installer,last_message,created_at,updated_at,transaction_rooms(id),transaction_stage_events(id,from_stage,to_stage,actor_role,direction,created_at)")
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return ((data ?? []) as unknown as TransactionRow[]).map(mapTransaction);
  }

  async createWithRoom(value: Pick<Transaction, "installerId" | "vehicle" | "service" | "pricing" | "schedule">) {
    const { data, error } = await createSupabaseBrowserClient().rpc("create_transaction_with_room", { payload: {
      installerId: value.installerId, vehicle: value.vehicle, service: value.service, pricing: value.pricing, schedule: value.schedule,
    } });
    if (error) throw error;
    return data as { transactionId: string; roomId: string; messageId: string };
  }

  /** Shop-centric creation — the Dealer selects an installer_shops row (not
   * an Installer Account), and the room is created immediately, no
   * acceptance gate. Works whether or not the Shop has a linked Installer
   * Account. */
  async createWithShopRoom(shopId: string, value: Pick<Transaction, "vehicle" | "service" | "pricing" | "schedule">) {
    const { data, error } = await createSupabaseBrowserClient().rpc("create_shop_transaction_with_room", { payload: {
      shopId, vehicle: value.vehicle, service: value.service, pricing: value.pricing, schedule: value.schedule,
    } });
    if (error) throw error;
    return data as { transactionId: string; roomId: string; messageId: string };
  }

  async setVisibility(transactionId: string, hidden: boolean) {
    const { error } = await createSupabaseBrowserClient().rpc("set_transaction_visibility", {
      p_transaction_id: transactionId,
      p_hidden: hidden,
    });
    if (error) throw error;
  }

  async setFinalPrice(transactionId: string, finalPrice: number) {
    const { error } = await createSupabaseBrowserClient().rpc("set_transaction_final_price", {
      p_transaction_id: transactionId,
      p_final_price: finalPrice,
    });
    if (error) throw error;
  }

  async transitionPayment(transactionId: string, nextStatus: PaymentStatus) {
    const { error } = await createSupabaseBrowserClient().rpc("transition_transaction_payment", {
      p_transaction_id: transactionId,
      p_next_status: nextStatus,
    });
    if (error) throw error;
  }

  async transitionStage(transactionId: string, nextStage: Transaction["status"]["stage"]) {
    const { error } = await createSupabaseBrowserClient().rpc("transition_transaction_stage", {
      p_transaction_id: transactionId,
      p_next_stage: nextStage,
    });
    if (error) throw error;
  }

  /** 취소/시공불가 — never deletes the Transaction/Room/Messages/Shop, just ends the work lifecycle. */
  async endOutcome(transactionId: string, outcome: "취소" | "시공불가", note?: string) {
    const { error } = await createSupabaseBrowserClient().rpc("end_transaction_outcome", {
      p_transaction_id: transactionId,
      p_outcome: outcome,
      p_note: note ?? null,
    });
    if (error) throw error;
  }

  subscribe(listener: () => void) {
    const client = createSupabaseBrowserClient();
    const channel = client.channel("car-master-transactions").on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, listener).subscribe();
    return () => { void client.removeChannel(channel); };
  }

  /** Returns null when the counterpart has no phone on file — never fabricate one. */
  async getContact(transactionId: string): Promise<{ name: string; phone: string } | null> {
    const { data, error } = await createSupabaseBrowserClient().rpc("get_transaction_contact", { p_transaction_id: transactionId });
    if (error) throw error;
    const row = (data as { contact_name: string; contact_phone: string }[] | null)?.[0];
    return row?.contact_phone ? { name: row.contact_name, phone: row.contact_phone } : null;
  }
}

export const supabaseTransactionRepository = new SupabaseTransactionRepository();
