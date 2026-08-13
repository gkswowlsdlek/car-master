"use client";

import { useCallback } from "react";
import { chatRepository } from "../repositories/chat-repository";
import { demoChatRepository } from "../repositories/demo-chat-repository";
import { demoTransactionRepository } from "../repositories/demo-transaction-repository";
import { supabaseChatRepository } from "../repositories/supabase-chat-repository";
import { supabaseTransactionRepository } from "../repositories/supabase-transaction-repository";
import { transactionRepository } from "../repositories/transaction-repository";
import { resolveDemoContact } from "../services/contact-directory";
import { createId } from "../services/id-service";
import { notificationService } from "../services/notifications/notification-service";
import { transitionPayment, transitionStage } from "../services/transaction-state-service";
import type { Role } from "../types/dealer";
import type { PaymentStatus, Transaction, TransactionChatMessage, TransactionStage } from "../types/transactions";

type UseTransactionActionsOptions = {
  useSupabaseData: boolean;
  transactions: Transaction[];
  sharedRoomIds: Set<string>;
  demoActorId: string;
  role: Role;
  refresh: () => Promise<void>;
};

export function useTransactionActions({ useSupabaseData, transactions, sharedRoomIds, demoActorId, role, refresh }: UseTransactionActionsOptions) {
  const isSharedDemoTransaction = useCallback(
    (transaction: Transaction) => sharedRoomIds.has(transaction.chatRoomId),
    [sharedRoomIds],
  );
  const demoActorRole: "dealer" | "shop" | "admin" = role === "shop" ? "shop" : role === "admin" ? "admin" : "dealer";

  const notifyNewMessage = useCallback((transaction: Transaction, message: TransactionChatMessage) => {
    const recipientId = message.senderId === transaction.dealerId ? transaction.installerId : transaction.dealerId;
    // A Shop with no linked Installer Account has no recipient to notify —
    // never fabricate one, just skip (this is a no-op placeholder service today anyway).
    if (!recipientId) return;
    void notificationService.notify({ type: "new_message", transactionId: transaction.id, roomId: transaction.chatRoomId, recipientId, preview: message.text || "사진을 보냈습니다" });
  }, []);

  const sendMessage = useCallback(async (transaction: Transaction, message: TransactionChatMessage) => {
    if (useSupabaseData) {
      try {
        await supabaseChatRepository.addMessage(transaction.chatRoomId, message);
        await refresh();
        notifyNewMessage(transaction, message);
      } catch (error) { throw new Error(error instanceof Error ? error.message : "메시지를 전송하지 못했습니다."); }
      return;
    }
    const nextMessage = { ...message, id: createId("MSG") };
    if (isSharedDemoTransaction(transaction)) {
      try {
        // The shared transaction row is updated server-side by the Demo chat
        // insert trigger; clients do not have a direct table write grant.
        await demoChatRepository.addMessage(transaction.chatRoomId, nextMessage);
        await refresh();
        notifyNewMessage(transaction, nextMessage);
      } catch (error) { throw new Error(error instanceof Error ? error.message : "메시지를 전송하지 못했습니다."); }
      return;
    }
    chatRepository.addMessage(transaction.chatRoomId, nextMessage);
    transactionRepository.update({ ...transaction, lastMessage: message.text || (message.attachments?.length ? "사진을 보냈습니다" : transaction.lastMessage), status: { ...transaction.status, updatedAt: message.createdAt } });
    notifyNewMessage(transaction, nextMessage);
  }, [isSharedDemoTransaction, notifyNewMessage, refresh, useSupabaseData]);

  const markRoomRead = useCallback(async (roomId: string) => {
    try {
      if (useSupabaseData) await supabaseChatRepository.markRead(roomId);
      else if (sharedRoomIds.has(roomId)) await demoChatRepository.markRead(roomId, demoActorId);
    } catch { /* read-receipts are best-effort and must never block the chat UI */ }
  }, [demoActorId, sharedRoomIds, useSupabaseData]);

  const loadContact = useCallback(async (transaction: Transaction) => {
    if (useSupabaseData) return supabaseTransactionRepository.getContact(transaction.id);
    return resolveDemoContact(transaction, role === "shop" ? "shop" : "dealer");
  }, [role, useSupabaseData]);

  const hideTransaction = useCallback(async (id: string, targetRole: "dealer" | "shop") => {
    if (useSupabaseData) {
      try { await supabaseTransactionRepository.setVisibility(id, true); await refresh(); }
      catch (error) { alert(error instanceof Error ? error.message : "거래를 숨길 수 없습니다."); }
      return;
    }
    const target = transactions.find((item) => item.id === id);
    if (target && isSharedDemoTransaction(target)) {
      try { await demoTransactionRepository.setVisibility(id, true, targetRole); await refresh(); }
      catch (error) { alert(error instanceof Error ? error.message : "거래를 숨길 수 없습니다."); }
      return;
    }
    if (targetRole === "dealer") transactionRepository.hideForDealer(id); else transactionRepository.hideForInstaller(id);
  }, [isSharedDemoTransaction, refresh, transactions, useSupabaseData]);

  const unhideTransaction = useCallback(async (id: string, targetRole: "dealer" | "shop") => {
    if (useSupabaseData) {
      try { await supabaseTransactionRepository.setVisibility(id, false); await refresh(); }
      catch (error) { alert(error instanceof Error ? error.message : "숨김을 해제할 수 없습니다."); }
      return;
    }
    const target = transactions.find((item) => item.id === id);
    if (target && isSharedDemoTransaction(target)) {
      try { await demoTransactionRepository.setVisibility(id, false, targetRole); await refresh(); }
      catch (error) { alert(error instanceof Error ? error.message : "숨김을 해제할 수 없습니다."); }
      return;
    }
    if (targetRole === "dealer") transactionRepository.unhideForDealer(id); else transactionRepository.unhideForInstaller(id);
  }, [isSharedDemoTransaction, refresh, transactions, useSupabaseData]);

  const changeStage = useCallback(async (transaction: Transaction, stage: TransactionStage) => {
    const next = transitionStage(transaction, stage, role === "shop" ? "shop" : "dealer");
    if (useSupabaseData) { await supabaseTransactionRepository.transitionStage(transaction.id, stage); await refresh(); }
    else if (isSharedDemoTransaction(transaction)) { await demoTransactionRepository.transitionStage(transaction.id, stage, demoActorRole); await refresh(); }
    else transactionRepository.update(next);
    if (stage === "시공예약") void notificationService.notify({ type: "stage_confirmed", transactionId: transaction.id, stage, recipientId: transaction.dealerId });
  }, [demoActorRole, isSharedDemoTransaction, refresh, role, useSupabaseData]);

  /** 취소/시공불가 — never deletes the Transaction/Room/Messages/Shop, just ends the work lifecycle (Phase 5). */
  const endOutcome = useCallback(async (transaction: Transaction, outcome: "취소" | "시공불가", note?: string) => {
    if (useSupabaseData) { await supabaseTransactionRepository.endOutcome(transaction.id, outcome, note); await refresh(); return; }
    if (isSharedDemoTransaction(transaction)) {
      // Demo's transition RPC only mirrors 취소 (the pre-existing legacy
      // special case) — 시공불가 isn't modeled in the Demo backend this
      // phase, and will surface as a normal error to the demo user.
      await demoTransactionRepository.transitionStage(transaction.id, outcome, demoActorRole);
      await refresh();
      return;
    }
    const next = transitionStage(transaction, outcome, role === "shop" ? "shop" : "dealer");
    transactionRepository.update({ ...next, outcomeNote: note });
  }, [demoActorRole, isSharedDemoTransaction, refresh, role, useSupabaseData]);

  const changeFinalPrice = useCallback(async (transaction: Transaction, finalPrice: number) => {
    try {
      if (useSupabaseData) { await supabaseTransactionRepository.setFinalPrice(transaction.id, finalPrice); await refresh(); }
      else if (isSharedDemoTransaction(transaction)) { await demoTransactionRepository.setFinalPrice(transaction.id, finalPrice, demoActorRole); await refresh(); }
      else transactionRepository.update({ ...transaction, pricing: { ...transaction.pricing, finalPrice }, status: { ...transaction.status, updatedAt: new Date().toISOString() } });
    } catch (error) { alert(error instanceof Error ? error.message : "최종 금액을 저장할 수 없습니다."); }
  }, [demoActorRole, isSharedDemoTransaction, refresh, useSupabaseData]);

  const changePayment = useCallback(async (transaction: Transaction, status: PaymentStatus) => {
    try {
      const next = transitionPayment(transaction, status, role === "admin" ? "admin" : role);
      if (useSupabaseData) { await supabaseTransactionRepository.transitionPayment(transaction.id, status); await refresh(); }
      else if (isSharedDemoTransaction(transaction)) { await demoTransactionRepository.transitionPayment(transaction.id, status, demoActorRole); await refresh(); }
      else transactionRepository.update(next);
    } catch (error) { alert(error instanceof Error ? error.message : "결제 상태를 변경할 수 없습니다."); }
  }, [demoActorRole, isSharedDemoTransaction, refresh, role, useSupabaseData]);

  return { sendMessage, markRoomRead, loadContact, hideTransaction, unhideTransaction, changeStage, endOutcome, changeFinalPrice, changePayment };
}
