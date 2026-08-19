import { createSupabaseBrowserClient } from "../lib/supabase/client";
import { isSupabaseConfigured } from "../lib/supabase/config";
import type { PaymentStatus, Transaction, TransactionStage, TransactionStageEvent } from "../types/transactions";

// Demo-mode transaction backend. Mirrors supabase-transaction-repository.ts's
// shape exactly (same method names/signatures, same mapTransaction shape) so
// app/page.tsx's Demo branch can call this the same way it calls the real
// repository — only the actor's role must be passed explicitly, since demo
// login is a signed cookie (lib/demo-session.ts), never a real Supabase Auth
// session, so there is no auth.uid() for the RPCs to read a role from.
// Every table here (demo_transactions, demo_transaction_stage_events) has no
// FK to transactions/transaction_rooms/profiles/auth.users — physically
// isolated from real data exactly like demo_chat_* already is.
//
// isSchemaReady() lets callers detect "the 202608010001 migration hasn't
// been applied to this database yet" (a fresh v0.3.12 deploy, before the
// migration is run) and fall back to the older per-browser localStorage
// behavior instead of throwing — see hooks/use-transaction-store.ts.

export type DemoActorRole = "dealer" | "shop" | "admin";

type StageEventRow = {
  id: number;
  transaction_id: string;
  from_stage: TransactionStageEvent["fromStage"];
  to_stage: TransactionStageEvent["toStage"];
  actor_role: TransactionStageEvent["actorRole"];
  direction: TransactionStageEvent["direction"];
  created_at: string;
};

type TransactionRow = {
  id: string;
  dealer_id: string;
  installer_id: string;
  installer_name: string;
  vehicle: Transaction["vehicle"];
  service: Transaction["service"];
  pricing: Transaction["pricing"];
  schedule: Transaction["schedule"];
  stage: Transaction["status"]["stage"];
  hidden_by_dealer: boolean;
  hidden_by_installer: boolean;
  last_message: string;
  chat_room_id: string;
  created_at: string;
  updated_at: string;
  demo_transaction_stage_events: StageEventRow[] | null;
};

function mapTransaction(row: TransactionRow): Transaction {
  const stageLog: TransactionStageEvent[] = (row.demo_transaction_stage_events ?? [])
    .map((event) => ({
      id: `EVT-${event.id}`,
      fromStage: event.from_stage,
      toStage: event.to_stage,
      actorRole: event.actor_role,
      direction: event.direction,
      createdAt: event.created_at,
    }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return {
    id: row.id,
    dealerId: row.dealer_id,
    installerId: row.installer_id,
    installerName: row.installer_name,
    vehicle: row.vehicle,
    service: row.service,
    pricing: row.pricing,
    schedule: row.schedule,
    status: { stage: row.stage, createdAt: row.created_at, updatedAt: row.updated_at },
    // Shared-demo backend has no warranty columns/RPCs (out of scope for this
    // phase, same as contact_status before it) — always NOT_READY, which is
    // the correct/honest state since none of these rows ever carry the info.
    warranty: {},
    visibility: { hiddenByDealer: row.hidden_by_dealer, hiddenByInstaller: row.hidden_by_installer },
    chatRoomId: row.chat_room_id,
    lastMessage: row.last_message,
    stageLog,
  };
}

/** Postgres codes for "relation/function does not exist" — the migration hasn't been applied yet. */
const SCHEMA_MISSING_CODES = new Set(["42P01", "42883", "PGRST202", "PGRST205"]);

export class DemoTransactionRepository {
  private schemaReadyPromise: Promise<boolean> | null = null;

  /** Cached for the lifetime of the page load — a schema that isn't ready won't suddenly appear without a reload. */
  async isSchemaReady(): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    if (!this.schemaReadyPromise) {
      this.schemaReadyPromise = (async () => {
        try {
          const { error } = await createSupabaseBrowserClient().from("demo_transactions").select("id").limit(1);
          return !error || !SCHEMA_MISSING_CODES.has(error.code ?? "");
        } catch {
          return false;
        }
      })();
    }
    return this.schemaReadyPromise;
  }

  async getAll(): Promise<Transaction[]> {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await createSupabaseBrowserClient()
      .from("demo_transactions")
      .select(
        "id,dealer_id,installer_id,installer_name,vehicle,service,pricing,schedule,stage,hidden_by_dealer,hidden_by_installer,last_message,chat_room_id,created_at,updated_at,demo_transaction_stage_events(id,transaction_id,from_stage,to_stage,actor_role,direction,created_at)",
      )
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return ((data ?? []) as unknown as TransactionRow[]).map(mapTransaction);
  }

  async createWithRoom(
    value: Pick<Transaction, "installerId" | "installerName" | "vehicle" | "service" | "pricing" | "schedule">,
    dealerId: string,
  ) {
    const { data, error } = await createSupabaseBrowserClient().rpc("demo_create_transaction_with_room", {
      p_dealer_id: dealerId,
      p_installer_id: value.installerId,
      p_installer_name: value.installerName,
      p_vehicle: value.vehicle,
      p_service: value.service,
      p_pricing: value.pricing,
      p_schedule: value.schedule,
    });
    if (error) throw error;
    return data as { transactionId: string; roomId: string; messageId: string };
  }

  async setVisibility(transactionId: string, hidden: boolean, role: "dealer" | "shop") {
    const { error } = await createSupabaseBrowserClient().rpc("demo_set_transaction_visibility", {
      p_transaction_id: transactionId,
      p_hidden: hidden,
      p_role: role,
    });
    if (error) throw error;
  }

  async setFinalPrice(transactionId: string, finalPrice: number, role: DemoActorRole) {
    const { error } = await createSupabaseBrowserClient().rpc("demo_set_transaction_final_price", {
      p_transaction_id: transactionId,
      p_final_price: finalPrice,
      p_actor_role: role,
    });
    if (error) throw error;
  }

  async transitionPayment(transactionId: string, nextStatus: PaymentStatus, role: DemoActorRole) {
    const { error } = await createSupabaseBrowserClient().rpc("demo_transition_transaction_payment", {
      p_transaction_id: transactionId,
      p_next_status: nextStatus,
      p_actor_role: role,
    });
    if (error) throw error;
  }

  async transitionStage(transactionId: string, nextStage: TransactionStage, role: DemoActorRole) {
    const { error } = await createSupabaseBrowserClient().rpc("demo_transition_transaction_stage", {
      p_transaction_id: transactionId,
      p_next_stage: nextStage,
      p_actor_role: role,
    });
    if (error) throw error;
  }

  subscribe(listener: () => void) {
    if (!isSupabaseConfigured) return () => {};
    const client = createSupabaseBrowserClient();
    const channel = client
      .channel("car-master-demo-transactions")
      .on("postgres_changes", { event: "*", schema: "public", table: "demo_transactions" }, listener)
      .on("postgres_changes", { event: "*", schema: "public", table: "demo_transaction_stage_events" }, listener)
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }
}

export const demoTransactionRepository = new DemoTransactionRepository();
