"use client";
import { useEffect, useState } from "react";
import { chatRepository } from "../repositories/chat-repository";
import { demoChatRepository } from "../repositories/demo-chat-repository";
import { transactionRepository } from "../repositories/transaction-repository";
import { demoTransactionRepository } from "../repositories/demo-transaction-repository";
import { supabaseChatRepository } from "../repositories/supabase-chat-repository";
import { supabaseTransactionRepository } from "../repositories/supabase-transaction-repository";
import type { ChatRoom, Transaction } from "../types/transactions";

// Demo mode merges two sources for both transactions and their rooms: this
// browser's own localStorage copies, and the shared, anon-open demo_* backend
// (see repositories/demo-transaction-repository.ts / demo-chat-repository.ts).
// Which room/transaction ids are "shared" is discovered at read time from
// whatever demo_chat_rooms / demo_transactions actually return — not a fixed
// compile-time list — so newly-created demo transactions (v0.3.12+) are
// automatically shared without any code change. Local ids that also appear
// in the shared set are dropped from the local half of the merge so nothing
// is shown twice; this only matters for transactions/rooms created before
// v0.3.12 shipped (or before the migration below was applied) that a browser
// still has sitting in its own localStorage.
async function loadDemoRooms(demoActorId: string): Promise<{ rooms: ChatRoom[]; sharedRoomIds: Set<string> }> {
  const [localRooms, sharedRooms] = await Promise.all([
    Promise.resolve(chatRepository.getAll()),
    demoChatRepository.getAll(demoActorId),
  ]);
  const sharedRoomIds = new Set(sharedRooms.map((room) => room.id));
  return { rooms: [...localRooms.filter((room) => !sharedRoomIds.has(room.id)), ...sharedRooms], sharedRoomIds };
}

async function loadDemoTransactions(schemaReady: boolean): Promise<Transaction[]> {
  const local = transactionRepository.getAll();
  if (!schemaReady) return local;
  const shared = await demoTransactionRepository.getAll();
  const sharedIds = new Set(shared.map((item) => item.id));
  return [...local.filter((item) => !sharedIds.has(item.id)), ...shared];
}

export function useTransactionStore(useSupabase = false, demoActorId = "") {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  // null while the one-time capability probe (does demo_transactions exist
  // yet?) is in flight; true/false once known. Only meaningful in Demo mode.
  const [demoSchemaReady, setDemoSchemaReady] = useState<boolean | null>(null);
  const [sharedRoomIds, setSharedRoomIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const schemaReady = useSupabase ? true : await demoTransactionRepository.isSchemaReady();
        if (!active) return;
        if (!useSupabase) setDemoSchemaReady(schemaReady);
        const [nextTransactions, roomResult] = await Promise.all([
          useSupabase ? supabaseTransactionRepository.getAll() : loadDemoTransactions(schemaReady),
          useSupabase ? supabaseChatRepository.getAll().then((value) => ({ rooms: value, sharedRoomIds: new Set<string>() })) : loadDemoRooms(demoActorId),
        ]);
        if (!active) return;
        setTransactions(nextTransactions);
        setRooms(roomResult.rooms);
        setSharedRoomIds(roomResult.sharedRoomIds);
        setError("");
      } catch {
        if (active) setError("거래 정보를 불러오지 못했습니다. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.");
      } finally {
        if (active) setIsLoading(false);
      }
    };
    const frame = requestAnimationFrame(() => { setIsLoading(true); void load(); });
    const unsubscribeTransactions = useSupabase ? supabaseTransactionRepository.subscribe(() => void load()) : transactionRepository.subscribe(() => void load());
    const unsubscribeDemoTransactions = useSupabase ? () => {} : demoTransactionRepository.subscribe(() => void load());
    const unsubscribeLocalRooms = useSupabase ? () => {} : chatRepository.subscribe(() => void load());
    const unsubscribeSharedRooms = useSupabase ? supabaseChatRepository.subscribe(() => void load()) : demoChatRepository.subscribe(() => void load());
    return () => { active = false; cancelAnimationFrame(frame); unsubscribeTransactions(); unsubscribeDemoTransactions(); unsubscribeLocalRooms(); unsubscribeSharedRooms(); };
  }, [useSupabase, demoActorId]);

  const refresh = async () => {
    setIsLoading(true);
    try {
      const schemaReady = useSupabase ? true : await demoTransactionRepository.isSchemaReady();
      const [nextTransactions, roomResult] = await Promise.all([
        useSupabase ? supabaseTransactionRepository.getAll() : loadDemoTransactions(schemaReady),
        useSupabase ? supabaseChatRepository.getAll().then((value) => ({ rooms: value, sharedRoomIds: new Set<string>() })) : loadDemoRooms(demoActorId),
      ]);
      setTransactions(nextTransactions); setRooms(roomResult.rooms); setSharedRoomIds(roomResult.sharedRoomIds); setError("");
    } catch {
      setError("거래 정보를 불러오지 못했습니다. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.");
      throw new Error("거래 정보를 새로고침하지 못했습니다.");
    } finally { setIsLoading(false); }
  };
  return { transactions, rooms, isLoading, error, refresh, demoSchemaReady, sharedRoomIds };
}
