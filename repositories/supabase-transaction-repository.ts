import { createSupabaseBrowserClient } from "../lib/supabase/client";
import type { PaymentStatus, Transaction } from "../types/transactions";

type TransactionRow = {
  id: string; dealer_id: string; installer_id: string; installer_name: string;
  vehicle: Transaction["vehicle"]; service: Transaction["service"]; pricing: Transaction["pricing"];
  schedule: Transaction["schedule"]; stage: Transaction["status"]["stage"];
  hidden_by_dealer: boolean; hidden_by_installer: boolean; last_message: string;
  created_at: string; updated_at: string; transaction_rooms: { id: string } | { id: string }[] | null;
};

function mapTransaction(row: TransactionRow): Transaction {
  const room = Array.isArray(row.transaction_rooms) ? row.transaction_rooms[0] : row.transaction_rooms;
  return {
    id: row.id, dealerId: row.dealer_id, installerId: row.installer_id, installerName: row.installer_name,
    vehicle: row.vehicle, service: row.service, pricing: row.pricing, schedule: row.schedule,
    status: { stage: row.stage, createdAt: row.created_at, updatedAt: row.updated_at },
    visibility: { hiddenByDealer: row.hidden_by_dealer, hiddenByInstaller: row.hidden_by_installer },
    chatRoomId: room?.id ?? "", lastMessage: row.last_message,
  };
}

export class SupabaseTransactionRepository {
  async getAll() {
    const { data, error } = await createSupabaseBrowserClient().from("transactions")
      .select("id,dealer_id,installer_id,installer_name,vehicle,service,pricing,schedule,stage,hidden_by_dealer,hidden_by_installer,last_message,created_at,updated_at,transaction_rooms(id)")
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

  subscribe(listener: () => void) {
    const client = createSupabaseBrowserClient();
    const channel = client.channel("car-master-transactions").on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, listener).subscribe();
    return () => { void client.removeChannel(channel); };
  }
}

export const supabaseTransactionRepository = new SupabaseTransactionRepository();
