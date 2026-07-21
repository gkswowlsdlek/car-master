"use client";
import { useEffect, useState } from "react";
import { chatRepository } from "../repositories/chat-repository";
import { transactionRepository } from "../repositories/transaction-repository";
import { supabaseChatRepository } from "../repositories/supabase-chat-repository";
import { supabaseTransactionRepository } from "../repositories/supabase-transaction-repository";
import type { ChatRoom, Transaction } from "../types/transactions";

export function useTransactionStore(useSupabase = false) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [nextTransactions, nextRooms] = await Promise.all([
          useSupabase ? supabaseTransactionRepository.getAll() : transactionRepository.getAll(),
          useSupabase ? supabaseChatRepository.getAll() : chatRepository.getAll(),
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
    const unsubscribeRooms = useSupabase ? supabaseChatRepository.subscribe(() => void load()) : chatRepository.subscribe(() => void load());
    return () => { active = false; cancelAnimationFrame(frame); unsubscribeTransactions(); unsubscribeRooms(); };
  }, [useSupabase]);
  const refresh = async () => {
    setIsLoading(true);
    try {
      const [nextTransactions, nextRooms] = useSupabase
        ? await Promise.all([supabaseTransactionRepository.getAll(), supabaseChatRepository.getAll()])
        : [transactionRepository.getAll(), chatRepository.getAll()];
      setTransactions(nextTransactions); setRooms(nextRooms); setError("");
    } catch {
      setError("거래 정보를 불러오지 못했습니다. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.");
      throw new Error("거래 정보를 새로고침하지 못했습니다.");
    } finally { setIsLoading(false); }
  };
  return { transactions, rooms, isLoading, error, refresh };
}
