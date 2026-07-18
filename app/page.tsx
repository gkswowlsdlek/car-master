"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminOverview } from "../components/admin/AdminOverview";
import { LoginScreen } from "../components/auth/LoginScreen";
import { DealerDashboard } from "../components/dealer/DealerDashboard";
import { DealerMapScreen } from "../components/dealer/DealerMapScreen";
import { PriceGuideScreen } from "../components/dealer/PriceGuideScreen";
import { RequestSummary } from "../components/dealer/RequestSummary";
import { ServiceRequestScreen } from "../components/dealer/ServiceRequestScreen";
import { LandingPage } from "../components/landing/LandingPage";
import { AppShell } from "../components/layout/AppShell";
import { ProfileEditor } from "../components/profile/ProfileEditor";
import { ShopDashboard } from "../components/shop/ShopDashboard";
import { TransactionManagementScreen } from "../components/transactions/TransactionManagementScreen";
import { defaultRequest } from "../data/default-request";
import { demoAccounts } from "../data/demo-accounts";
import { districtCenters } from "../data/district-centers";
import { formatGuidePrice } from "../data/installation-price-guide";
import { pricePackages, type PriceGuideFilter, type PricePackage, type VehicleClass } from "../data/pricePackages";
import { calculateVehicleClassPrice } from "../data/vehicle-class-options";
import { useTransactionStore } from "../hooks/use-transaction-store";
import { installerShops, type Brand } from "../lib/dealer-flow-data";
import { chatRepository } from "../repositories/chat-repository";
import { transactionRepository } from "../repositories/transaction-repository";
import { searchNearbyInstallers } from "../services/installer-search";
import { createId, createTransactionNumber } from "../services/id-service";
import { searchLocation } from "../services/location-search";
import { authProvider } from "../services/auth";
import { transitionPayment, transitionStage } from "../services/transaction-state-service";
import type { DemoAccount, RequestType, Role, Screen, ServiceRequest } from "../types/dealer";
import type { SearchLocation } from "../types/location";
import type { ChatRoom, PaymentStatus, Transaction, TransactionChatMessage, TransactionStage } from "../types/transactions";

const initialDistrict = districtCenters.find((item) => item.id === "gyeonggi-hanam") ?? districtCenters[0];
const initialLocation: SearchLocation = { id: initialDistrict.id, city: initialDistrict.city, district: initialDistrict.district, label: initialDistrict.label, latitude: initialDistrict.latitude, longitude: initialDistrict.longitude };

function pathForScreen(screen: Screen, role: Role) {
  if (screen === "landing") return "/";
  if (screen === "login") return "/login";
  if (role === "shop") return "/shop";
  if (role === "admin") return "/admin";
  return "/dealer";
}

function roleTransactionsForActivity(transactions: Transaction[], role: Role, shopId?: string) {
  return role === "shop" ? transactions.filter((item) => item.installerId === shopId) : transactions;
}

export default function Home() {
  const [role, setRole] = useState<Role>("dealer");
  const [account, setAccount] = useState<DemoAccount>(demoAccounts[0]);
  const [screen, setScreen] = useState<Screen>("landing");
  const [query, setQuery] = useState("하남시");
  const [location, setLocation] = useState<SearchLocation>(initialLocation);
  const [locationError, setLocationError] = useState("");
  const [selectedShopId, setSelectedShopId] = useState("SHOP-MISA-001");
  const [favoriteShopIds, setFavoriteShopIds] = useState<string[]>(["SHOP-MISA-001"]);
  const [request, setRequest] = useState<ServiceRequest>(defaultRequest);
  const [priceFilter, setPriceFilter] = useState<PriceGuideFilter>("전체");
  const [priceSearch, setPriceSearch] = useState("");
  const [vehicleClass, setVehicleClass] = useState<VehicleClass>("국산 승용");
  const [selectedPackageId, setSelectedPackageId] = useState(pricePackages[0].id);
  const [selectedTransactionId, setSelectedTransactionId] = useState("");
  const { transactions, rooms } = useTransactionStore();

  const nearbyResults = useMemo(() => searchNearbyInstallers(location, installerShops).filter((item) => item.shop.approved && item.shop.available).slice(0, 28), [location]);
  const selectedShop = installerShops.find((shop) => shop.id === selectedShopId) ?? nearbyResults[0]?.shop ?? installerShops[0];
  const selectedPackage = pricePackages.find((item) => item.id === selectedPackageId) ?? pricePackages[0];
  const filteredPackages = pricePackages.filter((item) => {
    const keyword = priceSearch.trim().toLowerCase();
    const matchesFilter = priceFilter === "전체" || priceFilter === "기타" && item.brandGroup === "기타" || priceFilter === "솔라가드" && item.brand.startsWith("솔라가드") || item.brand === priceFilter;
    return matchesFilter && (!keyword || `${item.brand} ${item.product} ${item.description}`.toLowerCase().includes(keyword));
  });

  const goToScreen = useCallback((next: Screen, nextRole = role) => {
    setScreen(next);
    window.history.pushState(null, "", pathForScreen(next, nextRole));
  }, [role]);

  const login = useCallback((nextAccount: DemoAccount, replace = false) => {
    setAccount(nextAccount); setRole(nextAccount.role); setScreen(nextAccount.entryScreen);
    if (nextAccount.shopId) setSelectedShopId(nextAccount.shopId);
    const path = pathForScreen(nextAccount.entryScreen, nextAccount.role);
    window.history[replace ? "replaceState" : "pushState"](null, "", path);
  }, []);

  const authenticate = useCallback(async (email: string, password: string) => {
    const user = await authProvider.login({ email, password });
    const nextAccount = demoAccounts.find((item) => item.id === user.id);
    if (!nextAccount) throw new Error("로그인 계정 정보를 찾을 수 없습니다.");
    login(nextAccount);
  }, [login]);

  const logout = useCallback(async () => {
    await authProvider.logout();
    goToScreen("login");
  }, [goToScreen]);

  useEffect(() => {
    const pathname = window.location.pathname;
    const routeAccount = pathname === "/dealer" ? demoAccounts[0] : pathname === "/shop" ? demoAccounts[1] : pathname === "/admin" ? demoAccounts[2] : null;
    const frame = requestAnimationFrame(() => routeAccount ? login(routeAccount, true) : setScreen(pathname === "/login" ? "login" : "landing"));
    return () => cancelAnimationFrame(frame);
  }, [login]);

  const activeTransactionId = selectedTransactionId || transactions[0]?.id || "";
  const profileActivity = useMemo(() => {
    const now = new Date();
    const monthly = roleTransactionsForActivity(transactions, role, account.shopId).filter((item) => { const date = new Date(item.status.createdAt); return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth(); }).length;
    const scoped = roleTransactionsForActivity(transactions, role, account.shopId);
    return { total: scoped.length, monthly, completed: scoped.filter((item) => item.status.stage === "완료").length, favorites: role === "dealer" ? favoriteShopIds.length : 0 };
  }, [transactions, role, account.shopId, favoriteShopIds.length]);

  const searchArea = async (value = query) => {
    const result = await searchLocation(value);
    if (!result) { setLocationError("검색 가능한 행정구역을 찾지 못했습니다."); return; }
    setLocationError(""); setLocation(result); setQuery(result.district);
    setRequest((current) => ({ ...current, deliveryArea: `${result.city} ${result.district}` }));
    const nearest = searchNearbyInstallers(result, installerShops).find((item) => item.shop.approved && item.shop.available);
    if (nearest) setSelectedShopId(nearest.shop.id);
  };

  const applyPackage = (item: PricePackage, nextClass = vehicleClass, optionalServices: string[] = [], requestType: RequestType = "실제 시공 요청") => {
    const price = calculateVehicleClassPrice(item.guidePrice, nextClass);
    const expectedPrice = price.priceRequiresInquiry ? nextClass === "국산 대형/SUV" ? "추가금 발생 가능" : "별도 견적" : formatGuidePrice(price.finalGuidePrice ?? item.guidePrice);
    setSelectedPackageId(item.id); setVehicleClass(nextClass);
    setRequest((current) => ({ ...current, preferredBrand: item.brand as Brand, works: [`${item.brand} ${item.product} 썬팅`], workDescription: `${item.brand} ${item.product} 썬팅`, memo: item.name, requestType, vehicleClass: nextClass, selectedPackageId: item.id, selectedPackageName: item.product, selectedPackageBrand: item.brand, selectedPackageProduct: item.product, expectedPrice, baseGuidePrice: item.guidePrice, surcharge: price.surcharge, finalGuidePrice: price.finalGuidePrice, priceRequiresInquiry: price.priceRequiresInquiry, includedServices: item.includedServices, optionalServices }));
    goToScreen("request");
  };

  const createTransaction = () => {
    const existing = transactionRepository.getAll();
    const sequence = existing.reduce((max, item) => Math.max(max, Number(item.id.match(/-(\d{4})$/)?.[1] ?? 0)), 0) + 1;
    const now = new Date().toISOString();
    const id = createTransactionNumber(sequence);
    const chatRoomId = createId("CHAT");
    const transaction: Transaction = { id, dealerId: demoAccounts[0].id, installerId: selectedShop.id, installerName: selectedShop.name, vehicle: { maker: request.maker, model: request.model, class: request.vehicleClass }, service: { brand: request.selectedPackageBrand, product: request.selectedPackageProduct, workDescription: request.workDescription, extraRequest: request.extraRequest }, pricing: { baseGuidePrice: request.baseGuidePrice, surcharge: request.surcharge, finalPrice: request.priceRequiresInquiry ? undefined : request.finalGuidePrice, paymentStatus: "미결제" }, schedule: { requestedInboundAt: request.inboundStart }, status: { stage: "접수", createdAt: now, updatedAt: now }, visibility: { hiddenByDealer: false, hiddenByInstaller: false }, chatRoomId, lastMessage: "새 시공 요청이 접수되었습니다." };
    const room: ChatRoom = { id: chatRoomId, transactionId: id, createdAt: now, updatedAt: now, messages: [{ id: createId("MSG"), roomId: chatRoomId, senderId: "system", senderRole: "system", text: "거래방이 생성되었습니다. 자동 작업 브리핑을 확인하세요.", createdAt: now, readBy: [account.id] }] };
    transactionRepository.create(transaction); chatRepository.create(room); setSelectedTransactionId(id); goToScreen("deals");
  };

  const sendMessage = (transaction: Transaction, message: TransactionChatMessage) => {
    chatRepository.addMessage(transaction.chatRoomId, { ...message, id: createId("MSG") });
    transactionRepository.update({ ...transaction, lastMessage: message.text, status: { ...transaction.status, updatedAt: message.createdAt } });
  };
  const hideTransaction = (id: string, targetRole: "dealer" | "shop") => targetRole === "dealer" ? transactionRepository.hideForDealer(id) : transactionRepository.hideForInstaller(id);
  const changeStage = (transaction: Transaction, stage: TransactionStage) => {
    try { transactionRepository.update(transitionStage(transaction, stage, role === "shop" ? "shop" : "dealer")); } catch (error) { alert(error instanceof Error ? error.message : "상태를 변경할 수 없습니다."); }
  };
  const changePayment = (transaction: Transaction, status: PaymentStatus) => {
    try { transactionRepository.update(transitionPayment(transaction, status, role === "admin" ? "admin" : role)); } catch (error) { alert(error instanceof Error ? error.message : "결제 상태를 변경할 수 없습니다."); }
  };

  if (screen === "landing") return <LandingPage onStart={() => goToScreen("login")} onPriceGuide={() => goToScreen("login")} />;
  if (screen === "login") return <LoginScreen onLogin={authenticate} onExplore={() => goToScreen("landing")} />;

  const roleTransactions = role === "shop" ? transactions.filter((item) => item.installerId === (account.shopId ?? selectedShop.id)) : transactions;
  return <AppShell role={role} account={account} screen={screen} onNavigate={goToScreen} onLogout={() => void logout()}>
    {screen === "dealerDashboard" && <DealerDashboard dealerName={account.name} deals={transactions.filter((item) => !item.visibility.hiddenByDealer)} onFilterDeals={() => goToScreen("deals")} onOpenDeal={(id) => { setSelectedTransactionId(id); goToScreen("deals"); }} onNewRequest={() => goToScreen("request")} onFindShop={() => goToScreen("dealerMap")} onPriceGuide={() => goToScreen("priceGuide")} onOpenChat={() => goToScreen("deals")} />}
    {screen === "priceGuide" && <PriceGuideScreen packages={filteredPackages} selectedPackage={selectedPackage} selectedPackageId={selectedPackageId} setSelectedPackageId={setSelectedPackageId} brandFilter={priceFilter} setBrandFilter={setPriceFilter} search={priceSearch} setSearch={setPriceSearch} vehicleClass={vehicleClass} setVehicleClass={setVehicleClass} onRequest={applyPackage} />}
    {screen === "dealerMap" && <DealerMapScreen query={query} setQuery={setQuery} searchArea={searchArea} location={location} searchError={locationError} results={nearbyResults} selectedShop={selectedShop} selectedShopId={selectedShopId} setSelectedShopId={setSelectedShopId} favoriteShopIds={favoriteShopIds} toggleFavoriteShop={(id) => setFavoriteShopIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])} selectedBrand={request.selectedPackageBrand} isOtherBrand={selectedPackage.brandGroup === "기타"} onRequest={() => goToScreen("request")} />}
    {screen === "request" && <ServiceRequestScreen request={request} setRequest={setRequest} shops={nearbyResults.map((item) => ({ shop: item.shop, distanceLabel: item.distanceLabel }))} selectedShop={selectedShop} selectedShopId={selectedShopId} setSelectedShopId={setSelectedShopId} onFindShops={() => void searchArea(request.deliveryArea)} onSummary={() => goToScreen("requestSummary")} onPriceGuide={() => goToScreen("priceGuide")} />}
    {screen === "requestSummary" && <RequestSummary request={request} shop={selectedShop} onBack={() => goToScreen("request")} onSubmit={createTransaction} />}
    {screen === "shopDashboard" && <ShopDashboard transactions={roleTransactions} onOpenTransactions={() => goToScreen("shopRequests")} onOpenTransaction={(id) => { setSelectedTransactionId(id); goToScreen("shopRequests"); }} />}
    {(screen === "deals" || screen === "shopRequests") && <TransactionManagementScreen role={role === "shop" ? "shop" : "dealer"} userId={account.id} transactions={roleTransactions} rooms={rooms} selectedId={activeTransactionId} onSelect={setSelectedTransactionId} onSend={sendMessage} onHide={hideTransaction} onUpdate={(value) => transactionRepository.update(value)} onStageChange={changeStage} onPaymentChange={changePayment} onNewRequest={() => goToScreen("request")} />}
    {screen === "dealerProfile" && <ProfileEditor key={role} role={role === "shop" ? "shop" : "dealer"} activity={profileActivity} />}
    {screen === "ops" && <AdminOverview transactions={transactions} rooms={rooms} />}
  </AppShell>;
}
