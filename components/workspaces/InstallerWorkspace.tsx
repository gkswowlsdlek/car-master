"use client";

import { useEffect, useMemo, useState } from "react";
import { useNotifications } from "../../hooks/use-notifications";
import type { DemoAccount, Screen } from "../../types/dealer";
import type { InstallerListing } from "../../types/installer";
import type { AttachmentProvider } from "../../services/attachments";
import type {
  ChatRoom,
  PaymentStatus,
  Transaction,
  TransactionChatMessage,
  TransactionStage,
} from "../../types/transactions";
import { MessengerScreen } from "../messenger/MessengerScreen";
import { ShopManagementScreen } from "../shop/ShopManagementScreen";
import { ShopDashboard } from "../shop/ShopDashboard";
import { HelpCenterScreen } from "../support/HelpCenterScreen";
import { TransactionManagementScreen } from "../transactions/TransactionManagementScreen";
import { isDemoAccountId } from "../../data/demo-accounts";
import { shopManagementRepository } from "../../repositories/shop-management-repository";

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
  onEndOutcome: (transaction: Transaction, outcome: "취소" | "시공불가", note?: string) => Promise<void>;
  onIssueWarranty: (transaction: Transaction) => Promise<void>;
  onMarkRead: (roomId: string) => void;
  /** Prepends the previous page of chat history for one room. */
  onLoadOlderMessages?: (roomId: string) => Promise<boolean>;
  onLoadContact: (transaction: Transaction) => Promise<{ name: string; phone: string } | null>;
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  onUnreadMessageCountChange: (count: number) => void;
  onUnreadNotificationCountChange: (count: number) => void;
  onMobileFullscreenChange: (open: boolean) => void;
};

export function InstallerWorkspace({
  account,
  screen,
  transactions,
  rooms,
  installers,
  useRemoteAttachments,
  demoAttachmentProvider,
  isLoading,
  loadError,
  onNavigate,
  onSend,
  onHide,
  onUnhide,
  onFinalPriceChange,
  onStageChange,
  onPaymentChange,
  onEndOutcome,
  onIssueWarranty,
  onMarkRead,
  onLoadOlderMessages,
  onLoadContact,
  onChangePassword,
  onUnreadMessageCountChange,
  onUnreadNotificationCountChange,
  onMobileFullscreenChange,
}: InstallerWorkspaceProps) {
  const [selectedTransactionId, setSelectedTransactionId] = useState("");
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [activeShopIds, setActiveShopIds] = useState<string[]>([]);

  useEffect(() => {
    if (isDemoAccountId(account.id)) {
      return;
    }
    let cancelled = false;
    void shopManagementRepository
      .getActiveShopIdsForUser(account.id)
      .then((shopIds) => {
        if (!cancelled) setActiveShopIds(shopIds);
      })
      .catch(() => {
        if (!cancelled) setActiveShopIds([]);
      });
    return () => {
      cancelled = true;
    };
  }, [account.id]);

  const roleTransactions = useMemo(() => {
    const demo = isDemoAccountId(account.id);
    const legacyInstallerId = demo ? account.shopId : account.id;
    return transactions.filter((item) => {
      if (item.shopId) return activeShopIds.includes(item.shopId);
      return Boolean(legacyInstallerId && item.installerId === legacyInstallerId);
    });
  }, [account.id, account.shopId, activeShopIds, transactions]);
  const activeTransactionId = selectedTransactionId || roleTransactions[0]?.id || "";
  const unreadMessageCount = useMemo(
    () =>
      rooms
        .filter((room) => roleTransactions.some((item) => item.chatRoomId === room.id))
        .reduce((sum, room) => sum + room.unreadCount, 0),
    [rooms, roleTransactions],
  );
  const notifications = useNotifications({ role: "shop", transactions: roleTransactions, rooms });

  useEffect(() => onUnreadMessageCountChange(unreadMessageCount), [onUnreadMessageCountChange, unreadMessageCount]);
  useEffect(
    () => onUnreadNotificationCountChange(notifications.unreadCount),
    [onUnreadNotificationCountChange, notifications.unreadCount],
  );
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

  return (
    <>
      {screen === "shopDashboard" && (
        <ShopDashboard
          transactions={roleTransactions}
          rooms={rooms}
          onOpenTransaction={openTransaction}
          onOpenMessage={openMessages}
          onStageChange={onStageChange}
        />
      )}
      {screen === "shopRequests" && (
        <TransactionManagementScreen
          role="shop"
          userId={account.id}
          transactions={roleTransactions}
          rooms={rooms}
          selectedId={activeTransactionId}
          useRemoteAttachments={useRemoteAttachments}
          onSelect={setSelectedTransactionId}
          onSend={onSend}
          onHide={onHide}
          onUnhide={onUnhide}
          onFinalPriceChange={onFinalPriceChange}
          onStageChange={onStageChange}
          onPaymentChange={onPaymentChange}
          onEndOutcome={onEndOutcome}
          onNewRequest={() => onNavigate("request")}
          onMarkRead={onMarkRead}
          onLoadOlder={onLoadOlderMessages}
          onLoadContact={onLoadContact}
          onOpenMessages={openMessages}
        />
      )}
      {screen === "messages" && (
        <MessengerScreen
          role="shop"
          userId={account.id}
          transactions={roleTransactions}
          rooms={rooms}
          installers={installers}
          selectedId={activeTransactionId}
          useRemoteAttachments={useRemoteAttachments}
          demoAttachmentProvider={demoAttachmentProvider}
          isLoading={isLoading}
          loadError={loadError}
          onSelect={setSelectedTransactionId}
          onSend={onSend}
          onHide={onHide}
          onFinalPriceChange={onFinalPriceChange}
          onStageChange={onStageChange}
          onPaymentChange={onPaymentChange}
          onEndOutcome={onEndOutcome}
          onIssueWarranty={onIssueWarranty}
          onMarkRead={onMarkRead}
          onLoadOlder={onLoadOlderMessages}
          onLoadContact={onLoadContact}
          onMobileChatOpenChange={setMobileChatOpen}
        />
      )}
      {screen === "dealerProfile" && <ShopManagementScreen userId={account.id} onChangePassword={onChangePassword} />}
      {screen === "shopHelp" && <HelpCenterScreen role="shop" embedded />}
    </>
  );
}
