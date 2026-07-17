"use client";
import { useEffect, useState } from "react";
import { chatRepository } from "../repositories/chat-repository";
import { transactionRepository } from "../repositories/transaction-repository";
import type { ChatRoom, Transaction } from "../types/transactions";

export function useTransactionStore() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  useEffect(() => {
    const loadTransactions = () => setTransactions(transactionRepository.getAll());
    const loadRooms = () => setRooms(chatRepository.getAll());
    const frame = requestAnimationFrame(() => { loadTransactions(); loadRooms(); });
    const unsubscribeTransactions = transactionRepository.subscribe(loadTransactions);
    const unsubscribeRooms = chatRepository.subscribe(loadRooms);
    return () => { cancelAnimationFrame(frame); unsubscribeTransactions(); unsubscribeRooms(); };
  }, []);
  return { transactions, rooms };
}
