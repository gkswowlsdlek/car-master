"use client";

import { useEffect, useMemo, useState } from "react";
import { defaultRequest } from "../../data/default-request";
import { isDemoAccountId } from "../../data/demo-accounts";
import { districtCenters } from "../../data/district-centers";
import { demoInstallerListings } from "../../data/installer-directory-demo";
import { formatGuidePrice } from "../../data/installation-price-guide";
import { pricePackages, type PriceGuideFilter, type PricePackage, type VehicleClass } from "../../data/pricePackages";
import { calculateVehicleClassPrice } from "../../data/vehicle-class-options";
import type { Brand } from "../../lib/dealer-flow-data";
import { chatRepository } from "../../repositories/chat-repository";
import { demoTransactionRepository } from "../../repositories/demo-transaction-repository";
import { installerDirectoryRepository } from "../../repositories/installer-directory-repository";
import { profileRepository } from "../../repositories/profile-repository";
import { supabaseTransactionRepository } from "../../repositories/supabase-transaction-repository";
import { transactionRepository } from "../../repositories/transaction-repository";
import type { AttachmentProvider } from "../../services/attachments";
import { createId, createTransactionNumber } from "../../services/id-service";
import { searchNearbyInstallers } from "../../services/installer-search";
import { searchLocation } from "../../services/location-search";
import { notificationService } from "../../services/notifications/notification-service";
import type { DemoAccount, RequestType, Screen, ServiceRequest } from "../../types/dealer";
import type { InstallerListing } from "../../types/installer";
import type { SearchLocation } from "../../types/location";
import type { ChatRoom, PaymentStatus, Transaction, TransactionChatMessage, TransactionStage } from "../../types/transactions";
import { DealerDashboard } from "../dealer/DealerDashboard";
import { InstallerDirectoryScreen } from "../dealer/InstallerDirectoryScreen";
import { PriceGuideScreen } from "../dealer/PriceGuideScreen";
import { RequestSummary } from "../dealer/RequestSummary";
import { ServiceRequestScreen } from "../dealer/ServiceRequestScreen";
import { MessengerScreen } from "../messenger/MessengerScreen";
import { ProfileEditor, defaultDealerCompanyName } from "../profile/ProfileEditor";
import { TransactionManagementScreen } from "../transactions/TransactionManagementScreen";

const initialDistrict = districtCenters.find((item) => item.id === "gyeonggi-hanam") ?? districtCenters[0];
const initialLocation: SearchLocation = { id: initialDistrict.id, city: initialDistrict.city, district: initialDistrict.district, label: initialDistrict.label, latitude: initialDistrict.latitude, longitude: initialDistrict.longitude };
const SERVICE_REQUEST_DRAFT_KEY = "car-master-service-request-draft";

function initialServiceRequest() {
  if (typeof window === "undefined") return defaultRequest;
  try {
    const stored = window.sessionStorage.getItem(SERVICE_REQUEST_DRAFT_KEY);
    return stored ? { ...defaultRequest, ...JSON.parse(stored) as ServiceRequest } : defaultRequest;
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
  onUnhide: (id: string, role: "dealer" | "shop") => void;
  onFinalPriceChange: (transaction: Transaction, finalPrice: number) => void;
  onStageChange: (transaction: Transaction, stage: TransactionStage) => Promise<void>;
  onPaymentChange: (transaction: Transaction, status: PaymentStatus) => void;
  onMarkRead: (roomId: string) => void;
  onLoadContact: (transaction: Transaction) => Promise<{ name: string; phone: string } | null>;
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  onCompanyNameChange: (name: string | undefined) => void;
  onUnreadMessageCountChange: (count: number) => void;
  onMobileFullscreenChange: (open: boolean) => void;
};

export function DealerWorkspace({ account, screen, transactions, rooms, useSupabaseData, useDemoSharedBackend, demoAttachmentProvider, isLoading, loadError, onNavigate, onRefresh, onSend, onHide, onUnhide, onFinalPriceChange, onStageChange, onPaymentChange, onMarkRead, onLoadContact, onChangePassword, onCompanyNameChange, onUnreadMessageCountChange, onMobileFullscreenChange }: DealerWorkspaceProps) {
  const [query, setQuery] = useState("하남시");
  const [location, setLocation] = useState<SearchLocation>(initialLocation);
  const [locationError, setLocationError] = useState("");
  const [selectedShopId, setSelectedShopId] = useState("SHOP-MISA-001");
  const [favoriteShopIds, setFavoriteShopIds] = useState<string[]>(["SHOP-MISA-001"]);
  const [request, setRequest] = useState<ServiceRequest>(initialServiceRequest);
  const [priceFilter, setPriceFilter] = useState<PriceGuideFilter>("전체");
  const [priceSearch, setPriceSearch] = useState("");
  const [vehicleClass, setVehicleClass] = useState<VehicleClass>("국산 승용");
  const [selectedPackageId, setSelectedPackageId] = useState(pricePackages[0].id);
  const [selectedTransactionId, setSelectedTransactionId] = useState("");
  const [dealFilter, setDealFilter] = useState<TransactionStage | "전체">("전체");
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [approvedInstallerShops, setApprovedInstallerShops] = useState<InstallerListing[]>([]);
  const [installerDirectoryLoading, setInstallerDirectoryLoading] = useState(useSupabaseData);
  const [isCreatingTransaction, setIsCreatingTransaction] = useState(false);

  const availableShops = useMemo<InstallerListing[]>(() => useSupabaseData ? [...approvedInstallerShops, ...demoInstallerListings] : demoInstallerListings, [approvedInstallerShops, useSupabaseData]);
  const nearbyResults = useMemo(() => searchNearbyInstallers(location, availableShops).filter((item) => item.shop.approved && item.shop.available).slice(0, 28), [availableShops, location]);
  const selectedShop = availableShops.find((shop) => shop.id === selectedShopId) ?? nearbyResults[0]?.shop ?? demoInstallerListings[0];
  const selectedPackage = pricePackages.find((item) => item.id === selectedPackageId) ?? pricePackages[0];
  const filteredPackages = pricePackages.filter((item) => {
    const keyword = priceSearch.trim().toLowerCase();
    const matchesFilter = priceFilter === "전체" || priceFilter === "기타" && item.brandGroup === "기타" || priceFilter === "솔라가드" && item.brand.startsWith("솔라가드") || item.brand === priceFilter;
    return matchesFilter && (!keyword || `${item.brand} ${item.product} ${item.description}`.toLowerCase().includes(keyword));
  });
  const unreadMessageCount = useMemo(() => rooms.filter((room) => transactions.some((item) => item.chatRoomId === room.id)).reduce((sum, room) => sum + room.unreadCount, 0), [rooms, transactions]);
  const activeTransactionId = selectedTransactionId || transactions[0]?.id || "";
  const profileActivity = useMemo(() => {
    const now = new Date();
    const monthly = transactions.filter((item) => { const date = new Date(item.status.createdAt); return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth(); }).length;
    return { total: transactions.length, monthly, completed: transactions.filter((item) => item.status.stage === "작업완료").length, favorites: favoriteShopIds.length };
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
    void installerDirectoryRepository.getApproved().then((shops) => {
      if (active) setApprovedInstallerShops(shops);
    }).catch(() => { if (active) setApprovedInstallerShops([]); }).finally(() => { if (active) setInstallerDirectoryLoading(false); });
    return () => { active = false; };
  }, [useSupabaseData]);

  useEffect(() => {
    const refreshCompany = () => {
      const fallback = isDemoAccountId(account.id) ? defaultDealerCompanyName : undefined;
      onCompanyNameChange(profileRepository.getById(account.id)?.companyName ?? fallback);
    };
    refreshCompany();
    const unsubscribe = profileRepository.subscribe(refreshCompany);
    return () => { unsubscribe(); onCompanyNameChange(undefined); };
  }, [account.id, onCompanyNameChange]);

  useEffect(() => onUnreadMessageCountChange(unreadMessageCount), [onUnreadMessageCountChange, unreadMessageCount]);
  useEffect(() => {
    onMobileFullscreenChange(screen === "messages" && mobileChatOpen);
    return () => onMobileFullscreenChange(false);
  }, [mobileChatOpen, onMobileFullscreenChange, screen]);

  const searchArea = async (value = query) => {
    const result = await searchLocation(value);
    if (!result) { setLocationError("검색 가능한 행정구역을 찾지 못했습니다."); return; }
    setLocationError(""); setLocation(result); setQuery(result.district);
    setRequest((current) => ({ ...current, deliveryArea: `${result.city} ${result.district}` }));
    const nearest = searchNearbyInstallers(result, availableShops).find((item) => item.shop.approved && item.shop.available);
    if (nearest) setSelectedShopId(nearest.shop.id);
  };

  const applyPackage = (item: PricePackage, nextClass = vehicleClass, optionalServices: string[] = [], requestType: RequestType = "실제 시공 요청") => {
    const price = calculateVehicleClassPrice(item.guidePrice, nextClass);
    const expectedPrice = price.priceRequiresInquiry ? nextClass === "국산 대형/SUV" ? "추가금 발생 가능" : "별도 견적" : formatGuidePrice(price.finalGuidePrice ?? item.guidePrice);
    setSelectedPackageId(item.id); setVehicleClass(nextClass);
    setRequest((current) => ({ ...current, preferredBrand: item.brand as Brand, works: [`${item.brand} ${item.product} 썬팅`], workDescription: `${item.brand} ${item.product} 썬팅`, memo: item.name, requestType, vehicleClass: nextClass, selectedPackageId: item.id, selectedPackageName: item.product, selectedPackageBrand: item.brand, selectedPackageProduct: item.product, expectedPrice, baseGuidePrice: item.guidePrice, surcharge: price.surcharge, finalGuidePrice: price.finalGuidePrice, priceRequiresInquiry: price.priceRequiresInquiry, includedServices: item.includedServices, optionalServices }));
    onNavigate("request");
  };

  const createTransaction = async () => {
    if (isCreatingTransaction) return;
    setIsCreatingTransaction(true);
    try {
      if (useSupabaseData) {
        if (!approvedInstallerShops.some((shop) => shop.id === selectedShop.id)) { alert("관리자에게 승인된 시공점을 선택해 주세요."); return; }
        try {
          const created = await supabaseTransactionRepository.createWithRoom({
            installerId: selectedShop.id,
            vehicle: { maker: request.maker, model: request.model, class: request.vehicleClass },
            service: { brand: request.selectedPackageBrand, product: request.selectedPackageProduct, workDescription: request.workDescription, extraRequest: request.extraRequest },
            pricing: { baseGuidePrice: request.baseGuidePrice, surcharge: request.surcharge, finalPrice: request.priceRequiresInquiry ? undefined : request.finalGuidePrice, paymentStatus: "미결제" },
            schedule: { requestedInboundAt: request.inboundStart },
          });
          await onRefresh();
          window.sessionStorage.removeItem(SERVICE_REQUEST_DRAFT_KEY);
          setRequest(defaultRequest);
          setSelectedTransactionId(created.transactionId); setDealFilter("전체"); onNavigate("deals");
          void notificationService.notify({ type: "new_service_request", transactionId: created.transactionId, installerId: selectedShop.id });
        } catch (error) { alert(error instanceof Error ? error.message : "거래를 생성하지 못했습니다."); }
        return;
      }
      if (useDemoSharedBackend) {
        try {
          const created = await demoTransactionRepository.createWithRoom({
            installerId: selectedShop.id, installerName: selectedShop.name,
            vehicle: { maker: request.maker, model: request.model, class: request.vehicleClass },
            service: { brand: request.selectedPackageBrand, product: request.selectedPackageProduct, workDescription: request.workDescription, extraRequest: request.extraRequest },
            pricing: { baseGuidePrice: request.baseGuidePrice, surcharge: request.surcharge, finalPrice: request.priceRequiresInquiry ? undefined : request.finalGuidePrice, paymentStatus: "미결제" },
            schedule: { requestedInboundAt: request.inboundStart },
          }, account.id);
          await onRefresh();
          window.sessionStorage.removeItem(SERVICE_REQUEST_DRAFT_KEY);
          setRequest(defaultRequest);
          setSelectedTransactionId(created.transactionId); setDealFilter("전체"); onNavigate("deals");
          void notificationService.notify({ type: "new_service_request", transactionId: created.transactionId, installerId: selectedShop.id });
        } catch (error) { alert(error instanceof Error ? error.message : "거래를 생성하지 못했습니다."); }
        return;
      }
      const existing = transactionRepository.getAll();
      const sequence = existing.reduce((max, item) => Math.max(max, Number(item.id.match(/-(\d{4})$/)?.[1] ?? 0)), 0) + 1;
      const now = new Date().toISOString();
      const id = createTransactionNumber(sequence);
      const chatRoomId = createId("CHAT");
      const transaction: Transaction = { id, dealerId: account.id, installerId: selectedShop.id, installerName: selectedShop.name, vehicle: { maker: request.maker, model: request.model, class: request.vehicleClass }, service: { brand: request.selectedPackageBrand, product: request.selectedPackageProduct, workDescription: request.workDescription, extraRequest: request.extraRequest }, pricing: { baseGuidePrice: request.baseGuidePrice, surcharge: request.surcharge, finalPrice: request.priceRequiresInquiry ? undefined : request.finalGuidePrice, paymentStatus: "미결제" }, schedule: { requestedInboundAt: request.inboundStart }, status: { stage: "견적", createdAt: now, updatedAt: now }, visibility: { hiddenByDealer: false, hiddenByInstaller: false }, chatRoomId, lastMessage: "새 시공 요청이 접수되었습니다.", stageLog: [{ id: createId("EVT"), fromStage: null, toStage: "견적", actorRole: "dealer", direction: "forward", createdAt: now }] };
      const room: ChatRoom = { id: chatRoomId, transactionId: id, createdAt: now, updatedAt: now, unreadCount: 0, messages: [{ id: createId("MSG"), roomId: chatRoomId, senderId: "system", senderRole: "system", text: "거래방이 생성되었습니다. 자동 작업 브리핑을 확인하세요.", createdAt: now, readBy: [account.id] }] };
      transactionRepository.create(transaction); chatRepository.create(room);
      window.sessionStorage.removeItem(SERVICE_REQUEST_DRAFT_KEY);
      setRequest(defaultRequest);
      setSelectedTransactionId(id); setDealFilter("전체"); onNavigate("deals");
      void notificationService.notify({ type: "new_service_request", transactionId: id, installerId: selectedShop.id });
    } finally {
      setIsCreatingTransaction(false);
    }
  };

  return <>
    {screen === "dealerDashboard" && <DealerDashboard dealerName={account.name} deals={transactions.filter((item) => !item.visibility.hiddenByDealer)} onFilterDeals={(filter) => { setDealFilter(filter); onNavigate("deals"); }} onOpenTransaction={(id) => { setSelectedTransactionId(id); setDealFilter("전체"); onNavigate("deals"); }} onNewRequest={() => onNavigate("request")} onFindShop={() => onNavigate("dealerMap")} onPriceGuide={() => onNavigate("priceGuide")} />}
    {screen === "priceGuide" && <PriceGuideScreen packages={filteredPackages} selectedPackage={selectedPackage} selectedPackageId={selectedPackageId} setSelectedPackageId={setSelectedPackageId} brandFilter={priceFilter} setBrandFilter={setPriceFilter} search={priceSearch} setSearch={setPriceSearch} vehicleClass={vehicleClass} setVehicleClass={setVehicleClass} onRequest={applyPackage} />}
    {screen === "dealerMap" && <InstallerDirectoryScreen installers={availableShops} loading={useSupabaseData && installerDirectoryLoading} selectedId={selectedShopId} setSelectedId={setSelectedShopId} favoriteIds={favoriteShopIds} toggleFavorite={(id) => setFavoriteShopIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])} selectedBrand={request.selectedPackageBrand} isOtherBrand={selectedPackage.brandGroup === "기타"} onRequest={() => onNavigate("request")} />}
    {screen === "request" && locationError && <div className="location-search-error"><b>{locationError}</b></div>}
    {screen === "request" && <ServiceRequestScreen request={request} setRequest={setRequest} shops={nearbyResults.map((item) => ({ shop: item.shop, distanceLabel: item.distanceLabel }))} selectedShop={selectedShop} selectedShopId={selectedShopId} setSelectedShopId={setSelectedShopId} onFindShops={(area) => void searchArea(area ?? request.deliveryArea)} onSummary={() => onNavigate("requestSummary")} onPriceGuide={() => onNavigate("priceGuide")} />}
    {screen === "requestSummary" && <RequestSummary request={request} shop={selectedShop} submitting={isCreatingTransaction} onBack={() => onNavigate("request")} onSubmit={createTransaction} />}
    {screen === "deals" && <TransactionManagementScreen role="dealer" userId={account.id} transactions={transactions} rooms={rooms} selectedId={activeTransactionId} initialStageFilter={dealFilter} useRemoteAttachments={useSupabaseData} onSelect={setSelectedTransactionId} onSend={onSend} onHide={onHide} onUnhide={onUnhide} onFinalPriceChange={onFinalPriceChange} onStageChange={onStageChange} onPaymentChange={onPaymentChange} onNewRequest={() => onNavigate("request")} onMarkRead={onMarkRead} onLoadContact={onLoadContact} onOpenMessages={(id) => { setSelectedTransactionId(id); onNavigate("messages"); }} />}
    {screen === "messages" && <MessengerScreen role="dealer" userId={account.id} transactions={transactions} rooms={rooms} installers={availableShops} selectedId={activeTransactionId} useRemoteAttachments={useSupabaseData} demoAttachmentProvider={demoAttachmentProvider} isLoading={isLoading} loadError={loadError} onSelect={setSelectedTransactionId} onSend={onSend} onHide={onHide} onFinalPriceChange={onFinalPriceChange} onStageChange={onStageChange} onPaymentChange={onPaymentChange} onMarkRead={onMarkRead} onLoadContact={onLoadContact} onMobileChatOpenChange={setMobileChatOpen} />}
    {screen === "dealerProfile" && <ProfileEditor role="dealer" userId={account.id} activity={profileActivity} onChangePassword={onChangePassword} />}
  </>;
}
