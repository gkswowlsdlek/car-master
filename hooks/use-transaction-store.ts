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
  useEffect(() => {
    let active = true;
    const loadTransactions = async () => {
      const values = useSupabase ? await supabaseTransactionRepository.getAll() : transactionRepository.getAll();
      if (active) setTransactions(values);
    };
    const loadRooms = async () => {
      const values = useSupabase ? await supabaseChatRepository.getAll() : chatRepository.getAll();
      if (active) setRooms(values);
    };
    const frame = requestAnimationFrame(() => { void loadTransactions(); void loadRooms(); });
    const unsubscribeTransactions = useSupabase ? supabaseTransactionRepository.subscribe(() => void loadTransactions()) : transactionRepository.subscribe(() => void loadTransactions());
    const unsubscribeRooms = useSupabase ? supabaseChatRepository.subscribe(() => void loadRooms()) : chatRepository.subscribe(() => void loadRooms());
    return () => { active = false; cancelAnimationFrame(frame); unsubscribeTransactions(); unsubscribeRooms(); };
  }, [useSupabase]);
  const refresh = async () => {
    if (!useSupabase) return;
    const [nextTransactions, nextRooms] = await Promise.all([supabaseTransactionRepository.getAll(), supabaseChatRepository.getAll()]);
    setTransactions(nextTransactions); setRooms(nextRooms);
  };
  return { transactions, rooms, refresh };
}
