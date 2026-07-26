"use client";
import { useEffect, useState } from "react";
import { chatRepository } from "../repositories/chat-repository";
import { demoChatRepository } from "../repositories/demo-chat-repository";
import { transactionRepository, SHARED_DEMO_ROOM_IDS } from "../repositories/transaction-repository";
import { supabaseChatRepository } from "../repositories/supabase-chat-repository";
import { supabaseTransactionRepository } from "../repositories/supabase-transaction-repository";
import type { ChatRoom, Transaction } from "../types/transactions";

// Demo mode merges two chat sources: this browser's own localStorage rooms
// (any transaction the dealer created here) and the shared, anon-open
// demo_chat_* backend (only the fixed seed room — see SHARED_DEMO_ROOM_IDS).
// Only the latter is ever visible to other browsers, so only its ids are
// swapped out of the local set before merging — nothing dynamically created
// in one browser leaks into the globally-shared demo tables.
async function loadDemoRooms(demoActorId: string): Promise<ChatRoom[]> {
  const [localRooms, sharedRooms] = await Promise.all([
    Promise.resolve(chatRepository.getAll()),
    demoChatRepository.getAll(demoActorId),
  ]);
  return [...localRooms.filter((room) => !SHARED_DEMO_ROOM_IDS.has(room.id)), ...sharedRooms];
}

export function useTransactionStore(useSupabase = false, demoActorId = "") {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [nextTransactions, nextRooms] = await Promise.all([
          useSupabase ? supabaseTransactionRepository.getAll() : Promise.resolve(transactionRepository.getAll()),
          useSupabase ? supabaseChatRepository.getAll() : loadDemoRooms(demoActorId),
        ]);
        if (!active) return;
        setTransactions(nextTransactions);
        setRooms(nextRooms);
        setError("");
      } catch {
        if (active) setError("거래 정보를 불러오지 못했습니다. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.");
      } finally {
        if (active) setIsLoading(false);
      }
    };
    const frame = requestAnimationFrame(() => { setIsLoading(true); void load(); });
    const unsubscribeTransactions = useSupabase ? supabaseTransactionRepository.subscribe(() => void load()) : transactionRepository.subscribe(() => void load());
    const unsubscribeLocalRooms = useSupabase ? () => {} : chatRepository.subscribe(() => void load());
    const unsubscribeSharedRooms = useSupabase ? supabaseChatRepository.subscribe(() => void load()) : demoChatRepository.subscribe(() => void load());
    return () => { active = false; cancelAnimationFrame(frame); unsubscribeTransactions(); unsubscribeLocalRooms(); unsubscribeSharedRooms(); };
  }, [useSupabase, demoActorId]);
  const refresh = async () => {
    setIsLoading(true);
    try {
      const [nextTransactions, nextRooms] = await Promise.all([
        useSupabase ? supabaseTransactionRepository.getAll() : Promise.resolve(transactionRepository.getAll()),
        useSupabase ? supabaseChatRepository.getAll() : loadDemoRooms(demoActorId),
      ]);
      setTransactions(nextTransactions); setRooms(nextRooms); setError("");
    } catch {
      setError("거래 정보를 불러오지 못했습니다. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.");
      throw new Error("거래 정보를 새로고침하지 못했습니다.");
    } finally { setIsLoading(false); }
  };
  const markRoomRead = async (roomId: string) => {
    try {
      if (useSupabase) await supabaseChatRepository.markRead(roomId);
      else if (SHARED_DEMO_ROOM_IDS.has(roomId)) await demoChatRepository.markRead(roomId, demoActorId);
    } catch { /* read-receipts are a nice-to-have; a failed mark-read must never block or error out the chat UI */ }
  };
  return { transactions, rooms, isLoading, error, refresh, markRoomRead };
}
