"use client";

import { useEffect, useMemo, useState } from "react";
import type { DemoAccount, Screen } from "../../types/dealer";
import type { InstallerListing } from "../../types/installer";
import type { AttachmentProvider } from "../../services/attachments";
import type { ChatRoom, PaymentStatus, Transaction, TransactionChatMessage, TransactionStage } from "../../types/transactions";
import { MessengerScreen } from "../messenger/MessengerScreen";
import { ProfileEditor } from "../profile/ProfileEditor";
import { ShopDashboard } from "../shop/ShopDashboard";
import { TransactionManagementScreen } from "../transactions/TransactionManagementScreen";

type InstallerWorkspaceProps = {
  account: DemoAccount;
  screen: Screen;
  transactions: Transaction[];
  rooms: ChatRoom[];
  installers: InstallerListing[];
  useRemoteAttachments: boolean;
  demoAttachmentProvider?: AttachmentProvider;
  isLoading: boolean;
  loadError: string;
  onNavigate: (screen: Screen) => void;
  onSend: (transaction: Transaction, message: TransactionChatMessage) => Promise<void>;
  onHide: (id: string, role: "dealer" | "shop") => void;
  onUnhide: (id: string, role: "dealer" | "shop") => void;
  onFinalPriceChange: (transaction: Transaction, finalPrice: number) => void;
  onStageChange: (transaction: Transaction, stage: TransactionStage) => Promise<void>;
  onPaymentChange: (transaction: Transaction, status: PaymentStatus) => void;
  onMarkRead: (roomId: string) => void;
  onLoadContact: (transaction: Transaction) => Promise<{ name: string; phone: string } | null>;
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  onUnreadMessageCountChange: (count: number) => void;
  onMobileFullscreenChange: (open: boolean) => void;
};

export function InstallerWorkspace({ account, screen, transactions, rooms, installers, useRemoteAttachments, demoAttachmentProvider, isLoading, loadError, onNavigate, onSend, onHide, onUnhide, onFinalPriceChange, onStageChange, onPaymentChange, onMarkRead, onLoadContact, onChangePassword, onUnreadMessageCountChange, onMobileFullscreenChange }: InstallerWorkspaceProps) {
  const [selectedTransactionId, setSelectedTransactionId] = useState("");
  const [mobileChatOpen, setMobileChatOpen] = useState(false);

  const roleTransactions = useMemo(
    () => transactions.filter((item) => item.installerId === account.shopId),
    [transactions, account.shopId],
  );
  const activeTransactionId = selectedTransactionId || roleTransactions[0]?.id || "";
  const unreadMessageCount = useMemo(
    () => rooms.filter((room) => roleTransactions.some((item) => item.chatRoomId === room.id)).reduce((sum, room) => sum + room.unreadCount, 0),
    [rooms, roleTransactions],
  );
  const profileActivity = useMemo(() => {
    const now = new Date();
    const monthly = roleTransactions.filter((item) => {
      const date = new Date(item.status.createdAt);
      return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    }).length;
    return {
      total: roleTransactions.length,
      monthly,
      completed: roleTransactions.filter((item) => item.status.stage === "작업완료").length,
      favorites: 0,
    };
  }, [roleTransactions]);

  useEffect(() => onUnreadMessageCountChange(unreadMessageCount), [onUnreadMessageCountChange, unreadMessageCount]);
  useEffect(() => {
    onMobileFullscreenChange(mobileChatOpen);
    return () => onMobileFullscreenChange(false);
  }, [mobileChatOpen, onMobileFullscreenChange]);

  const openTransaction = (id: string) => {
    setSelectedTransactionId(id);
    onNavigate("shopRequests");
  };
  const openMessages = (id: string) => {
    setSelectedTransactionId(id);
    onNavigate("messages");
  };

  return <>
    {screen === "shopDashboard" && <ShopDashboard transactions={roleTransactions} rooms={rooms} onOpenTransaction={openTransaction} onOpenMessage={openMessages} onStageChange={onStageChange} />}
    {screen === "shopRequests" && <TransactionManagementScreen role="shop" userId={account.id} transactions={roleTransactions} rooms={rooms} selectedId={activeTransactionId} useRemoteAttachments={useRemoteAttachments} onSelect={setSelectedTransactionId} onSend={onSend} onHide={onHide} onUnhide={onUnhide} onFinalPriceChange={onFinalPriceChange} onStageChange={onStageChange} onPaymentChange={onPaymentChange} onNewRequest={() => onNavigate("request")} onMarkRead={onMarkRead} onLoadContact={onLoadContact} onOpenMessages={openMessages} />}
    {screen === "messages" && <MessengerScreen role="shop" userId={account.id} transactions={roleTransactions} rooms={rooms} installers={installers} selectedId={activeTransactionId} useRemoteAttachments={useRemoteAttachments} demoAttachmentProvider={demoAttachmentProvider} isLoading={isLoading} loadError={loadError} onSelect={setSelectedTransactionId} onSend={onSend} onHide={onHide} onFinalPriceChange={onFinalPriceChange} onStageChange={onStageChange} onPaymentChange={onPaymentChange} onMarkRead={onMarkRead} onLoadContact={onLoadContact} onMobileChatOpenChange={setMobileChatOpen} />}
    {screen === "dealerProfile" && <ProfileEditor role="shop" userId={account.id} activity={profileActivity} onChangePassword={onChangePassword} />}
  </>;
}
