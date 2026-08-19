"use client";

import { useEffect, useMemo, useState } from "react";
import { useNotifications } from "../../hooks/use-notifications";
import { defaultRequest } from "../../data/default-request";
import { isDemoAccountId } from "../../data/demo-accounts";
import { districtCenters } from "../../data/district-centers";
import { demoInstallerListings } from "../../data/installer-directory-demo";
import { chatRepository } from "../../repositories/chat-repository";
import { demoTransactionRepository } from "../../repositories/demo-transaction-repository";
import { installerDirectoryRepository } from "../../repositories/installer-directory-repository";
import { profileRepository } from "../../repositories/profile-repository";
import { supabaseTransactionRepository } from "../../repositories/supabase-transaction-repository";
import { transactionRepository } from "../../repositories/transaction-repository";
import type { AttachmentProvider } from "../../services/attachments";
import { createId, createTransactionNumber } from "../../services/id-service";
import { searchNearbyInstallers } from "../../services/installer-search";
import { translateTransactionError } from "../../services/transaction-errors";
import { searchLocation } from "../../services/location-search";
import { notificationService } from "../../services/notifications/notification-service";
import type { DemoAccount, Screen, ServiceRequest } from "../../types/dealer";
import type { InstallerListing } from "../../types/installer";
import type { SearchLocation } from "../../types/location";
import type {
  ChatRoom,
  ContactStatus,
  PaymentStatus,
  Transaction,
  TransactionChatMessage,
  TransactionStage,
} from "../../types/transactions";
import { DealerDashboard } from "../dealer/DealerDashboard";
import { InstallerDirectoryScreen } from "../dealer/InstallerDirectoryScreen";
import { RequestSummary } from "../dealer/RequestSummary";
import { ServiceRequestScreen } from "../dealer/ServiceRequestScreen";
import { ShopSearchRequestScreen } from "../dealer/ShopSearchRequestScreen";
import { MessengerScreen } from "../messenger/MessengerScreen";
import { ProfileEditor, defaultDealerCompanyName } from "../profile/ProfileEditor";
import { HelpCenterScreen } from "../support/HelpCenterScreen";
import { DealerTransactionManagementScreen } from "../transactions/DealerTransactionManagementScreen";

const initialDistrict = districtCenters.find((item) => item.id === "gyeonggi-hanam") ?? districtCenters[0];
const initialLocation: SearchLocation = {
  id: initialDistrict.id,
  city: initialDistrict.city,
  district: initialDistrict.district,
  label: initialDistrict.label,
  latitude: initialDistrict.latitude,
  longitude: initialDistrict.longitude,
};
const SERVICE_REQUEST_DRAFT_KEY = "car-master-service-request-draft";

function initialServiceRequest() {
  if (typeof window === "undefined") return defaultRequest;
  try {
    const stored = window.sessionStorage.getItem(SERVICE_REQUEST_DRAFT_KEY);
    return stored ? { ...defaultRequest, ...(JSON.parse(stored) as ServiceRequest) } : defaultRequest;
  } catch {
    return defaultRequest;
  }
}

type DealerWorkspaceProps = {
  account: DemoAccount;
  screen: Screen;
  transactions: Transaction[];
  rooms: ChatRoom[];
  useSupabaseData: boolean;
  useDemoSharedBackend: boolean;
  demoAttachmentProvider?: AttachmentProvider;
  isLoading: boolean;
  loadError: string;
  onNavigate: (screen: Screen) => void;
  onRefresh: () => Promise<void>;
  onSend: (transaction: Transaction, message: TransactionChatMessage) => Promise<void>;
  onHide: (id: string, role: "dealer" | "shop") => void;
  onFinalPriceChange: (transaction: Transaction, finalPrice: number) => void;
  onStageChange: (transaction: Transaction, stage: TransactionStage) => Promise<void>;
  onPaymentChange: (transaction: Transaction, status: PaymentStatus) => void;
  onEndOutcome: (transaction: Transaction, outcome: "취소" | "시공불가", note?: string) => Promise<void>;
  onSetContactStatus: (transaction: Transaction, status: ContactStatus) => Promise<void>;
  onSetWarrantyInfo: (
    transaction: Transaction,
    info: { customerName?: string; customerPhone?: string; vehicleNumber?: string; vin?: string },
  ) => Promise<void>;
  onFindAnotherShop: () => void;
  onMarkRead: (roomId: string) => void;
  /** Prepends the previous page of chat history for one room. */
  onLoadOlderMessages?: (roomId: string) => Promise<boolean>;
  onLoadContact: (transaction: Transaction) => Promise<{ name: string; phone: string } | null>;
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  onCompanyNameChange: (name: string | undefined) => void;
  onUnreadMessageCountChange: (count: number) => void;
  onUnreadNotificationCountChange: (count: number) => void;
  onMobileFullscreenChange: (open: boolean) => void;
};

export function DealerWorkspace({
  account,
  screen,
  transactions,
  rooms,
  useSupabaseData,
  useDemoSharedBackend,
  demoAttachmentProvider,
  isLoading,
  loadError,
  onNavigate,
  onRefresh,
  onSend,
  onHide,
  onFinalPriceChange,
  onStageChange,
  onPaymentChange,
  onEndOutcome,
  onSetContactStatus,
  onSetWarrantyInfo,
  onFindAnotherShop,
  onMarkRead,
  onLoadOlderMessages,
  onLoadContact,
  onChangePassword,
  onCompanyNameChange,
  onUnreadMessageCountChange,
  onUnreadNotificationCountChange,
  onMobileFullscreenChange,
}: DealerWorkspaceProps) {
  const [query, setQuery] = useState("하남시");
  const [location, setLocation] = useState<SearchLocation>(initialLocation);
  // `location` starts at a default district, so it cannot tell "the dealer
  // searched 하남시" from "nothing has been searched yet". This holds only a
  // real, dealer-initiated search result and is what the directory screen
  // sorts by; null means fall back to the dealer's own GPS.
  const [searchOrigin, setSearchOrigin] = useState<SearchLocation | null>(null);
  const [locationError, setLocationError] = useState("");
  const [selectedShopId, setSelectedShopId] = useState("SHOP-MISA-001");
  const [favoriteShopIds, setFavoriteShopIds] = useState<string[]>(["SHOP-MISA-001"]);
  const [request, setRequest] = useState<ServiceRequest>(initialServiceRequest);
  const [selectedTransactionId, setSelectedTransactionId] = useState("");
  const [dealFilter, setDealFilter] = useState<TransactionStage | "전체">("전체");
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [approvedInstallerShops, setApprovedInstallerShops] = useState<InstallerListing[]>([]);
  const [installerDirectoryLoading, setInstallerDirectoryLoading] = useState(useSupabaseData);
  const [isCreatingTransaction, setIsCreatingTransaction] = useState(false);

  // Phase 8: a real, Supabase-authenticated Dealer must only ever see real
  // Shops — demoInstallerListings (≈250 fictional "데모 시공점"-badged
  // entries) previously got concatenated in here too, so they could rank
  // into the top real-shop search/map results by literal distance. Demo
  // listings now only ever appear for an actual Demo session (useSupabaseData === false).
  const availableShops = useMemo<InstallerListing[]>(
    () => (useSupabaseData ? approvedInstallerShops : demoInstallerListings),
    [approvedInstallerShops, useSupabaseData],
  );
  const nearbyResults = useMemo(
    () =>
      searchNearbyInstallers(location, availableShops)
        .filter((item) => item.shop.approved && item.shop.available)
        .slice(0, 28),
    [availableShops, location],
  );
  const selectedShop =
    availableShops.find((shop) => shop.id === selectedShopId) ?? nearbyResults[0]?.shop ?? demoInstallerListings[0];
  const unreadMessageCount = useMemo(
    () =>
      rooms
        .filter((room) => transactions.some((item) => item.chatRoomId === room.id))
        .reduce((sum, room) => sum + room.unreadCount, 0),
    [rooms, transactions],
  );
  const notifications = useNotifications({ role: "dealer", transactions, rooms, useSupabaseData });
  const activeTransactionId = selectedTransactionId || transactions[0]?.id || "";
  const profileActivity = useMemo(() => {
    const now = new Date();
    const monthly = transactions.filter((item) => {
      const date = new Date(item.status.createdAt);
      return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    }).length;
    return {
      total: transactions.length,
      monthly,
      completed: transactions.filter((item) => item.status.stage === "작업완료" || item.status.stage === "출고").length,
      favorites: favoriteShopIds.length,
    };
  }, [favoriteShopIds.length, transactions]);

  useEffect(() => {
    if (JSON.stringify(request) === JSON.stringify(defaultRequest)) {
      window.sessionStorage.removeItem(SERVICE_REQUEST_DRAFT_KEY);
      return;
    }
    window.sessionStorage.setItem(SERVICE_REQUEST_DRAFT_KEY, JSON.stringify(request));
  }, [request]);

  useEffect(() => {
    if (!useSupabaseData) return;
    let active = true;
    void installerDirectoryRepository
      .getApproved()
      .then((shops) => {
        if (active) setApprovedInstallerShops(shops);
      })
      .catch(() => {
        if (active) setApprovedInstallerShops([]);
      })
      .finally(() => {
        if (active) setInstallerDirectoryLoading(false);
      });
    return () => {
      active = false;
    };
  }, [useSupabaseData]);

  useEffect(() => {
    const refreshCompany = () => {
      const fallback = isDemoAccountId(account.id) ? defaultDealerCompanyName : undefined;
      onCompanyNameChange(profileRepository.getById(account.id)?.companyName ?? fallback);
    };
    refreshCompany();
    const unsubscribe = profileRepository.subscribe(refreshCompany);
    return () => {
      unsubscribe();
      onCompanyNameChange(undefined);
    };
  }, [account.id, onCompanyNameChange]);

  useEffect(() => onUnreadMessageCountChange(unreadMessageCount), [onUnreadMessageCountChange, unreadMessageCount]);
  useEffect(
    () => onUnreadNotificationCountChange(notifications.unreadCount),
    [onUnreadNotificationCountChange, notifications.unreadCount],
  );
  useEffect(() => {
    onMobileFullscreenChange(screen === "messages" && mobileChatOpen);
    return () => onMobileFullscreenChange(false);
  }, [mobileChatOpen, onMobileFullscreenChange, screen]);

  const searchArea = async (value = query) => {
    const result = await searchLocation(value);
    if (!result) {
      setLocationError("검색 가능한 행정구역을 찾지 못했습니다.");
      return;
    }
    setLocationError("");
    setLocation(result);
    setSearchOrigin(result);
    setQuery(result.district);
    setRequest((current) => ({ ...current, deliveryArea: `${result.city} ${result.district}` }));
    const nearest = searchNearbyInstallers(result, availableShops).find(
      (item) => item.shop.approved && item.shop.available,
    );
    if (nearest) setSelectedShopId(nearest.shop.id);
  };

  const searchHomeLocation = async (value: string) => {
    await searchArea(value);
    onNavigate("dealerMap");
  };

  const createTransaction = async () => {
    if (isCreatingTransaction) return;
    setIsCreatingTransaction(true);
    // Optional info the dealer may already know at request time (§9 "차량·고객
    // 정보" section) — reuses the existing warranty-info shape/RPC instead of a
    // new column or table. Omitted entirely if nothing was filled in.
    const optionalWarranty = {
      vehicleNumber: request.vehicleNumber?.trim() || undefined,
      vin: request.vin?.trim() || undefined,
      customerName: request.customerName?.trim() || undefined,
      customerPhone: request.customerPhone?.trim() || undefined,
    };
    const hasOptionalWarrantyInfo = Object.values(optionalWarranty).some(Boolean);
    try {
      if (useSupabaseData) {
        if (!approvedInstallerShops.some((shop) => shop.id === selectedShop.id)) {
          alert("관리자에게 승인된 시공점을 선택해 주세요.");
          return;
        }
        try {
          const created = await supabaseTransactionRepository.createWithShopRoom(selectedShop.id, {
            vehicle: { maker: request.maker, model: request.model, class: request.vehicleClass },
            service: {
              workDescription: request.workDescription,
              extraRequest: request.extraRequest,
            },
            pricing: {
              paymentStatus: "미결제",
            },
            schedule: { requestedInboundAt: request.inboundStart, desiredReleaseAt: request.releaseDate },
          });
          // Best-effort — the transaction/room already exist by this point,
          // so a failure here must never roll back or be reported as a
          // creation failure. It only ever changes whether we show the
          // dealer a follow-up notice after the (already-successful) create.
          let warrantyInfoSaveFailed = false;
          if (hasOptionalWarrantyInfo) {
            try {
              await supabaseTransactionRepository.setWarrantyInfo(created.transactionId, optionalWarranty);
            } catch {
              warrantyInfoSaveFailed = true;
            }
          }
          await onRefresh();
          window.sessionStorage.removeItem(SERVICE_REQUEST_DRAFT_KEY);
          setRequest(defaultRequest);
          setSelectedTransactionId(created.transactionId);
          setDealFilter("전체");
          onNavigate("deals");
          void notificationService.notify({
            type: "new_service_request",
            transactionId: created.transactionId,
            installerId: selectedShop.id,
          });
          if (warrantyInfoSaveFailed) {
            alert("시공 요청은 생성됐지만 차량·고객 정보 저장에 실패했습니다. 거래 상세에서 다시 입력해주세요.");
          }
        } catch (error) {
          alert(translateTransactionError(error, "거래를 생성하지 못했습니다."));
        }
        return;
      }
      if (useDemoSharedBackend) {
        try {
          const created = await demoTransactionRepository.createWithRoom(
            {
              installerId: selectedShop.id,
              installerName: selectedShop.name,
              vehicle: { maker: request.maker, model: request.model, class: request.vehicleClass },
              service: {
                workDescription: request.workDescription,
                extraRequest: request.extraRequest,
              },
              pricing: {
                paymentStatus: "미결제",
              },
              schedule: { requestedInboundAt: request.inboundStart, desiredReleaseAt: request.releaseDate },
            },
            account.id,
          );
          await onRefresh();
          window.sessionStorage.removeItem(SERVICE_REQUEST_DRAFT_KEY);
          setRequest(defaultRequest);
          setSelectedTransactionId(created.transactionId);
          setDealFilter("전체");
          onNavigate("deals");
          void notificationService.notify({
            type: "new_service_request",
            transactionId: created.transactionId,
            installerId: selectedShop.id,
          });
        } catch (error) {
          alert(translateTransactionError(error, "거래를 생성하지 못했습니다."));
        }
        return;
      }
      const existing = transactionRepository.getAll();
      const sequence =
        existing.reduce((max, item) => Math.max(max, Number(item.id.match(/-(\d{4})$/)?.[1] ?? 0)), 0) + 1;
      const now = new Date().toISOString();
      const id = createTransactionNumber(sequence);
      const chatRoomId = createId("CHAT");
      const transaction: Transaction = {
        id,
        dealerId: account.id,
        dealerName: account.name,
        dealerCompanyName: defaultDealerCompanyName,
        installerId: selectedShop.id,
        installerName: selectedShop.name,
        vehicle: { maker: request.maker, model: request.model, class: request.vehicleClass },
        service: {
          workDescription: request.workDescription,
          extraRequest: request.extraRequest,
        },
        pricing: {
          paymentStatus: "미결제",
        },
        schedule: { requestedInboundAt: request.inboundStart, desiredReleaseAt: request.releaseDate },
        status: { stage: "견적", createdAt: now, updatedAt: now },
        warranty: {
          ...optionalWarranty,
          // Mirrors set_transaction_warranty_info's own rule: stamp
          // infoSubmittedAt only once the 3 required fields are all present.
          infoSubmittedAt:
            optionalWarranty.customerName && optionalWarranty.customerPhone && optionalWarranty.vehicleNumber
              ? now
              : undefined,
        },
        visibility: { hiddenByDealer: false, hiddenByInstaller: false },
        chatRoomId,
        lastMessage: "새 시공 요청이 접수되었습니다.",
        stageLog: [
          {
            id: createId("EVT"),
            fromStage: null,
            toStage: "견적",
            actorRole: "dealer",
            direction: "forward",
            createdAt: now,
          },
        ],
      };
      const room: ChatRoom = {
        id: chatRoomId,
        transactionId: id,
        createdAt: now,
        updatedAt: now,
        unreadCount: 0,
        messages: [
          {
            id: createId("MSG"),
            roomId: chatRoomId,
            senderId: "system",
            senderRole: "system",
            text: "거래방이 생성되었습니다. 자동 작업 브리핑을 확인하세요.",
            createdAt: now,
            readBy: [account.id],
          },
        ],
      };
      transactionRepository.create(transaction);
      chatRepository.create(room);
      window.sessionStorage.removeItem(SERVICE_REQUEST_DRAFT_KEY);
      setRequest(defaultRequest);
      setSelectedTransactionId(id);
      setDealFilter("전체");
      onNavigate("deals");
      void notificationService.notify({ type: "new_service_request", transactionId: id, installerId: selectedShop.id });
    } finally {
      setIsCreatingTransaction(false);
    }
  };

  return (
    <>
      {screen === "dealerDashboard" && (
        <DealerDashboard
          dealerName={account.name}
          deals={transactions.filter((item) => !item.visibility.hiddenByDealer)}
          notifications={notifications.items}
          relativeTime={notifications.relativeTime}
          onFilterDeals={(filter) => {
            setDealFilter(filter);
            onNavigate("deals");
          }}
          onOpenTransaction={(id) => {
            setSelectedTransactionId(id);
            onNavigate("messages");
          }}
          onOpenMessages={() => onNavigate("messages")}
          onNewRequest={() => onNavigate("request")}
          onFindShop={() => onNavigate("dealerMap")}
          onSearchLocation={searchHomeLocation}
          onShopSearchRequests={useSupabaseData ? () => onNavigate("shopSearchRequests") : undefined}
        />
      )}
      {screen === "dealerMap" && (
        <InstallerDirectoryScreen
          installers={availableShops}
          loading={useSupabaseData && installerDirectoryLoading}
          selectedId={selectedShopId}
          setSelectedId={setSelectedShopId}
          favoriteIds={favoriteShopIds}
          toggleFavorite={(id) =>
            setFavoriteShopIds((current) =>
              current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
            )
          }
          isOtherBrand={false}
          searchOrigin={searchOrigin}
          onRequest={() => onNavigate("request")}
          onShopSearchRequest={useSupabaseData ? () => onNavigate("shopSearchRequests") : undefined}
        />
      )}
      {screen === "request" && locationError && (
        <div className="location-search-error">
          <b>{locationError}</b>
        </div>
      )}
      {screen === "request" && (
        <ServiceRequestScreen
          request={request}
          setRequest={setRequest}
          shops={nearbyResults.map((item) => ({ shop: item.shop, distanceLabel: item.distanceLabel }))}
          selectedShop={selectedShop}
          selectedShopId={selectedShopId}
          setSelectedShopId={setSelectedShopId}
          onFindShops={(area) => void searchArea(area ?? request.deliveryArea)}
          onSummary={() => onNavigate("requestSummary")}
        />
      )}
      {screen === "requestSummary" && (
        <RequestSummary
          request={request}
          shop={selectedShop}
          submitting={isCreatingTransaction}
          onBack={() => onNavigate("request")}
          onSubmit={createTransaction}
        />
      )}
      {screen === "deals" && (
        <DealerTransactionManagementScreen
          transactions={transactions}
          initialGroupFilter={dealFilter}
          onOpenTransaction={(id) => {
            setSelectedTransactionId(id);
            onNavigate("messages");
          }}
          onNewRequest={() => onNavigate("request")}
          onFindShop={() => onNavigate("dealerMap")}
        />
      )}
      {screen === "messages" && (
        <MessengerScreen
          role="dealer"
          userId={account.id}
          transactions={transactions}
          rooms={rooms}
          installers={availableShops}
          selectedId={activeTransactionId}
          useRemoteAttachments={useSupabaseData}
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
          onSetContactStatus={onSetContactStatus}
          onSetWarrantyInfo={onSetWarrantyInfo}
          onFindAnotherShop={onFindAnotherShop}
          onMarkRead={onMarkRead}
          onLoadOlder={onLoadOlderMessages}
          onLoadContact={onLoadContact}
          onMobileChatOpenChange={setMobileChatOpen}
        />
      )}
      {screen === "shopSearchRequests" && useSupabaseData && (
        <ShopSearchRequestScreen
          onTransactionCreated={(id) => {
            void onRefresh().then(() => {
              setSelectedTransactionId(id);
              setDealFilter("전체");
              onNavigate("deals");
            });
          }}
        />
      )}
      {screen === "dealerProfile" && (
        <ProfileEditor
          role="dealer"
          userId={account.id}
          activity={profileActivity}
          onChangePassword={onChangePassword}
        />
      )}
      {screen === "dealerHelp" && <HelpCenterScreen role="dealer" embedded />}
    </>
  );
}
