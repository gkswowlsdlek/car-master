"use client";

import { useEffect, useMemo, useState } from "react";
import { initialChatMessages, sampleScheduleProposal, type ChatMessage } from "../lib/chat-data";
import { priceBrands, pricePackages, vehicleClassLabels, type PriceBrand, type PricePackage, type VehicleClass } from "../data/pricePackages";
import { classifyVehicleModel, vehicleClassGuides } from "../data/vehicleClasses";
import {
  distanceKm,
  findSearchLocation,
  formatDistance,
  installerShops,
  searchLocations,
  type Brand,
  type InstallerShop,
  type SearchLocation,
  type WorkType,
} from "../lib/dealer-flow-data";
import { calculateSettlement, formatWon } from "../lib/fees";

type Role = "dealer" | "shop" | "admin";
type Screen = "landing" | "login" | "dealerDashboard" | "priceGuide" | "dealerMap" | "request" | "requestSummary" | "deals" | "dealerSettlement" | "dealerProfile" | "shopRequests" | "chat" | "ops";
type RequestStatus = "draft" | "sent" | "accepted" | "scheduleAgreed";
type DealStatus = "시공점 확인중" | "진행중" | "작업완료" | "취소";
type RequestType = "견적 문의" | "실제 시공 요청";
type DealStage = "접수" | "입고" | "시공중" | "완료";
type DemoAccount = {
  id: string;
  email: string;
  password: string;
  name: string;
  role: Role;
  entryScreen: Screen;
  shopId?: string;
};
type StoredConversation = {
  requestStatus: RequestStatus;
  messages: ChatMessage[];
  request: ServiceRequest;
  selectedShopId: string;
};

type ServiceRequest = {
  maker: string;
  model: string;
  vehicleType: "신차" | "재시공";
  deliveryArea: string;
  preferredBrand: Brand;
  works: string[];
  inboundStart: string;
  inboundEnd: string;
  memo: string;
  requestType: RequestType;
  extraWorkNote: string;
  vehicleClass: VehicleClass | "";
  selectedPackageId?: string;
  selectedPackageName?: string;
  selectedPackageBrand?: string;
  expectedPrice?: string;
  includedServices?: string[];
  optionalServices?: string[];
};

type DealerDeal = {
  id: string;
  maker: string;
  model: string;
  shopName: string;
  shopAddress: string;
  region: string;
  works: string[];
  packageName: string;
  requestType?: RequestType;
  extraWorkNote?: string;
  vehicleClass?: VehicleClass | "";
  expectedPrice?: string;
  status: DealStatus;
  stage?: DealStage;
  inboundAt?: string;
  outboundAt?: string;
  completedAt?: string;
  lastMessage: string;
  updatedAt: string;
  unread: number;
  messages: ChatMessage[];
};

type DealerIconName = "dashboard" | "price" | "shop" | "request" | "chat" | "deals" | "settlement" | "profile" | "logout" | "bell" | "arrow" | "card";

function DealerIcon({ name }: { name: DealerIconName }) {
  const paths: Record<DealerIconName, React.ReactNode> = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    price: <><path d="M4 7h16v12H4z" /><path d="M4 11h16" /><path d="M8 15h3" /><path d="M16 15h1" /><path d="M7 7V5h10v2" /></>,
    shop: <><path d="M4 10v10h16V10" /><path d="M3 10l2-6h14l2 6" /><path d="M8 20v-6h8v6" /><path d="M3 10c1.2 2 3.8 2 5 0 1.2 2 3.8 2 5 0 1.2 2 3.8 2 5 0 1 1.6 2.2 1.8 3 1" /></>,
    request: <><path d="M6 3h9l3 3v15H6z" /><path d="M14 3v4h4" /><path d="M9 12h6M9 16h6" /></>,
    chat: <><path d="M4 5h16v11H9l-5 4z" /><path d="M8 9h8M8 12h6" /></>,
    deals: <><rect x="3" y="5" width="18" height="15" rx="2" /><path d="M8 5V3h8v2M3 11h18M9 15h6" /></>,
    settlement: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h3" /></>,
    profile: <><circle cx="12" cy="8" r="4" /><path d="M4 21c.8-4 3.5-6 8-6s7.2 2 8 6" /></>,
    logout: <><path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9" /></>,
    bell: <><path d="M18 8a6 6 0 00-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
    arrow: <><path d="M5 12h14M14 7l5 5-5 5" /></>,
    card: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18" /></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function LogoImage({ compact = false }: { compact?: boolean }) {
  // Vinext's image optimizer can fail in the local worker, so use the public asset directly.
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={compact ? "logo-image compact" : "logo-image"} src="/carmaster-logo-transparent.png" alt="Car-Master" />;
}

const roleLabel: Record<Role, string> = {
  dealer: "딜러",
  shop: "시공점",
  admin: "관리자",
};

const conversationStorageKey = "car-master-v02-active-transaction";

const demoAccounts: DemoAccount[] = [
  {
    id: "hanjaejin-dealer",
    email: "1",
    password: "1",
    name: "한재진딜러",
    role: "dealer",
    entryScreen: "dealerDashboard",
  },
  {
    id: "misa-starhills-shop",
    email: "2",
    password: "2",
    name: "미사 스타힐스 시공점",
    role: "shop",
    entryScreen: "shopRequests",
    shopId: "SHOP-MISA-001",
  },
  {
    id: "hanjaejin-admin",
    email: "3",
    password: "3",
    name: "관리자 한재진",
    role: "admin",
    entryScreen: "ops",
  },
];

const transactionSteps = [
  "시공점 확인중",
  "진행중",
  "작업완료",
];

const dealStages: DealStage[] = ["접수", "입고", "시공중", "완료"];

const dealStatuses: DealStatus[] = ["시공점 확인중", "진행중", "작업완료"];

const statusTone: Record<DealStatus, string> = {
  "시공점 확인중": "waiting",
  "진행중": "working",
  "작업완료": "done",
  "취소": "canceled",
};

const dashboardMetrics: { label: string; value: string; filter: DealStatus | "전체" }[] = [
  { label: "시공점 확인중", value: "3건", filter: "시공점 확인중" },
  { label: "진행중", value: "5건", filter: "진행중" },
  { label: "작업완료", value: "8건", filter: "작업완료" },
];

const initialDealerDeals: DealerDeal[] = [
  {
    id: "CM-260713-001",
    maker: "제네시스",
    model: "GV80",
    shopName: "미사 스타힐스 시공점",
    shopAddress: "경기 하남시 미사강변중앙로 180",
    region: "경기 하남시 미사",
    works: ["신차패키지", "신차검수", "생활보호 PPF"],
    packageName: "버텍스900",
    requestType: "실제 시공 요청",
    extraWorkNote: "PPF",
    status: "진행중",
    stage: "입고",
    inboundAt: "2026-07-24 10:00",
    outboundAt: "2026-07-24 18:00",
    lastMessage: "7월 24일 오전 10시 입고 가능합니다.",
    updatedAt: "09:42",
    unread: 1,
    messages: [
      { id: "d1-m1", sender: "dealer", text: "안녕하세요. GV80 신차패키지 요청드립니다.", time: "09:00" },
      { id: "d1-m2", sender: "shop", text: "요청 확인했습니다. 7월 24일 오전 10시 입고 가능합니다.", time: "09:18" },
      { id: "d1-m3", sender: "dealer", text: "오후 6시 출고 가능할까요?", time: "09:24" },
      { id: "d1-m4", sender: "shop", text: "가능합니다. 해당 일정으로 예약 확정하겠습니다.", time: "09:42" },
    ],
  },
  {
    id: "CM-260713-002",
    maker: "기아",
    model: "EV9",
    shopName: "부산 오토랩",
    shopAddress: "부산 해운대구 센텀중앙로 97",
    region: "부산 해운대구",
    works: ["신차패키지", "신차검수"],
    packageName: "후퍼옵틱",
    requestType: "견적 문의",
    extraWorkNote: "번호판 장착 가능 여부",
    status: "시공점 확인중",
    stage: "접수",
    lastMessage: "시공 요청을 전송했습니다.",
    updatedAt: "09:12",
    unread: 0,
    messages: [
      { id: "d2-m1", sender: "system", text: "시공 요청을 전송했습니다.", time: "09:10" },
      { id: "d2-m2", sender: "dealer", text: "부산 해운대구 인도 예정 차량입니다. 가능 여부 확인 부탁드립니다.", time: "09:12" },
    ],
  },
  {
    id: "CM-260713-003",
    maker: "기아",
    model: "카니발",
    shopName: "후퍼옵틱 강남점",
    shopAddress: "서울 강남구 논현로 640",
    region: "서울 강남구",
    works: ["신차패키지", "블랙박스"],
    packageName: "후퍼옵틱",
    requestType: "실제 시공 요청",
    extraWorkNote: "블랙박스",
    status: "진행중",
    stage: "시공중",
    inboundAt: "2026-07-13 09:30",
    outboundAt: "2026-07-13 17:00",
    lastMessage: "현재 썬팅 작업 진행 중입니다.",
    updatedAt: "11:20",
    unread: 1,
    messages: [
      { id: "d3-m1", sender: "shop", text: "차량 입고 확인했습니다.", time: "09:31" },
      { id: "d3-m2", sender: "shop", text: "현재 썬팅 작업 진행 중이며 오후 5시 출고 예정입니다.", time: "11:20" },
      { id: "d3-m3", sender: "dealer", text: "작업 완료 후 사진 부탁드립니다.", time: "11:25" },
    ],
  },
  {
    id: "CM-260713-004",
    maker: "제네시스",
    model: "G80",
    shopName: "브이쿨 성수점",
    shopAddress: "서울 성동구 아차산로 104",
    region: "서울 성동구",
    works: ["신차패키지", "생활보호 PPF"],
    packageName: "브이쿨",
    requestType: "실제 시공 요청",
    extraWorkNote: "생활보호 PPF",
    status: "진행중",
    stage: "접수",
    inboundAt: "2026-07-14 10:00",
    lastMessage: "내일 오전 10시 입고 부탁드립니다.",
    updatedAt: "어제",
    unread: 0,
    messages: [
      { id: "d4-m1", sender: "shop", text: "내일 오전 10시 입고 부탁드립니다.", time: "어제 17:10" },
      { id: "d4-m2", sender: "dealer", text: "확인했습니다. 탁송기사 정보는 입고 전 전달드리겠습니다.", time: "어제 17:16" },
    ],
  },
  {
    id: "CM-260713-005",
    maker: "현대",
    model: "싼타페",
    shopName: "레이노 분당점",
    shopAddress: "경기 성남시 분당구 판교역로 152",
    region: "경기 성남시 분당구",
    works: ["유리막코팅", "블랙박스"],
    packageName: "레이노",
    requestType: "실제 시공 요청",
    extraWorkNote: "유리막, 블랙박스",
    status: "작업완료",
    stage: "완료",
    completedAt: "2026-07-12 16:30",
    lastMessage: "출고 완료되었습니다.",
    updatedAt: "2026-07-12",
    unread: 0,
    messages: [
      { id: "d5-m1", sender: "shop", text: "모든 작업이 완료되었습니다.", time: "16:10" },
      { id: "d5-m2", sender: "shop", text: "출고 사진과 검수 결과를 등록했습니다.", time: "16:22" },
      { id: "d5-m3", sender: "dealer", text: "확인했습니다. 감사합니다.", time: "16:30" },
    ],
  },
  {
    id: "CM-260713-006",
    maker: "BMW",
    model: "X5",
    shopName: "솔라가드 판교점",
    shopAddress: "경기 성남시 분당구 대왕판교로 660",
    region: "경기 성남시 판교",
    works: ["신차패키지", "유리막코팅"],
    packageName: "솔라가드",
    requestType: "견적 문의",
    extraWorkNote: "유리막",
    status: "진행중",
    stage: "접수",
    inboundAt: "2026-07-25 11:00",
    outboundAt: "2026-07-25 19:00",
    lastMessage: "25일 오전 11시 일정으로 제안드립니다.",
    updatedAt: "10:36",
    unread: 0,
    messages: [
      { id: "d6-m1", sender: "dealer", text: "X5 신차패키지 가능 일정 문의드립니다.", time: "10:05" },
      { id: "d6-m2", sender: "shop", text: "25일 오전 11시 일정으로 제안드립니다.", time: "10:36" },
    ],
  },
  {
    id: "CM-260713-007",
    maker: "현대",
    model: "아이오닉 9",
    shopName: "버텍스 송도점",
    shopAddress: "인천 연수구 센트럴로 160",
    region: "인천 연수구 송도",
    works: ["신차패키지", "생활보호 PPF"],
    packageName: "버텍스900",
    requestType: "실제 시공 요청",
    extraWorkNote: "PPF 4종",
    status: "진행중",
    stage: "입고",
    inboundAt: "2026-07-20 09:00",
    outboundAt: "2026-07-20 17:00",
    lastMessage: "일정이 확정되었습니다. 결제를 진행해주세요.",
    updatedAt: "어제",
    unread: 0,
    messages: [
      { id: "d7-m1", sender: "system", text: "일정이 확정되었습니다. 결제를 진행해주세요.", time: "어제 14:22" },
    ],
  },
  {
    id: "CM-260713-008",
    maker: "벤츠",
    model: "E-Class",
    shopName: "글라스틴트 대전점",
    shopAddress: "대전 유성구 대학로 99",
    region: "대전 유성구",
    works: ["신차패키지", "신차검수"],
    packageName: "글라스틴트",
    requestType: "실제 시공 요청",
    extraWorkNote: "",
    status: "진행중",
    stage: "입고",
    inboundAt: "2026-07-14 08:40",
    outboundAt: "2026-07-14 16:30",
    lastMessage: "차량 입고와 외관 검수를 완료했습니다.",
    updatedAt: "08:52",
    unread: 0,
    messages: [
      { id: "d8-m1", sender: "shop", text: "차량 입고와 외관 검수를 완료했습니다.", time: "08:52" },
    ],
  },
  {
    id: "CM-260713-009",
    maker: "제네시스",
    model: "GV70",
    shopName: "레이노 광주점",
    shopAddress: "광주 서구 상무대로 901",
    region: "광주 서구",
    works: ["신차패키지", "블랙박스"],
    packageName: "레이노",
    requestType: "견적 문의",
    extraWorkNote: "블랙박스",
    status: "시공점 확인중",
    stage: "접수",
    lastMessage: "시공 가능 여부를 확인 중입니다.",
    updatedAt: "11:02",
    unread: 0,
    messages: [
      { id: "d9-m1", sender: "system", text: "시공 요청을 전송했습니다.", time: "10:58" },
      { id: "d9-m2", sender: "dealer", text: "이번 주 출고 예정 차량입니다. 확인 부탁드립니다.", time: "11:02" },
    ],
  },
  {
    id: "CM-260713-010",
    maker: "기아",
    model: "쏘렌토",
    shopName: "브이쿨 수원점",
    shopAddress: "경기 수원시 영통구 광교로 145",
    region: "경기 수원시 광교",
    works: ["신차패키지", "생활보호 PPF"],
    packageName: "브이쿨",
    requestType: "실제 시공 요청",
    extraWorkNote: "생활보호 PPF",
    status: "진행중",
    stage: "시공중",
    inboundAt: "2026-07-18 10:30",
    outboundAt: "2026-07-18 18:00",
    lastMessage: "18일 오전 10시 30분 입고로 확정했습니다.",
    updatedAt: "어제",
    unread: 0,
    messages: [
      { id: "d10-m1", sender: "shop", text: "18일 오전 10시 30분 입고로 확정했습니다.", time: "어제 16:40" },
      { id: "d10-m2", sender: "dealer", text: "확인했습니다. 감사합니다.", time: "어제 16:45" },
    ],
  },
];

const defaultRequest: ServiceRequest = {
  maker: "제네시스",
  model: "GV80",
  vehicleType: "신차",
  deliveryArea: "경기 하남시 미사",
  preferredBrand: "솔라가드",
  works: ["신차패키지", "신차검수", "생활보호 PPF", "블랙박스"],
  inboundStart: "2026-07-24",
  inboundEnd: "2026-07-25",
  memo: "하남 미사 인도 예정 차량입니다. 고객 출고 전 신차검수와 블랙박스 포함 패키지 가능 여부 확인 부탁드립니다.",
  requestType: "실제 시공 요청",
  extraWorkNote: "PPF, 블랙박스",
  vehicleClass: "특대형",
  selectedPackageId: "vertex-900",
  selectedPackageName: "버텍스 900",
  selectedPackageBrand: "버텍스",
  expectedPrice: "가격 입력 예정",
  includedServices: ["신차검수", "생활보호 PPF 4종", "기본 코팅"],
  optionalServices: [],
};

function pathForScreen(screen: Screen, role: Role) {
  if (screen === "landing") return "/";
  if (screen === "login") return "/login";
  if (role === "shop") return "/shop";
  if (role === "admin") return "/admin";
  return "/dealer";
}

export default function Home() {
  const [role, setRole] = useState<Role>("dealer");
  const [account, setAccount] = useState<DemoAccount>(demoAccounts[0]);
  const [screen, setScreen] = useState<Screen>("landing");
  const [query, setQuery] = useState("경기 하남시 미사");
  const [location, setLocation] = useState<SearchLocation>(searchLocations[3]);
  const [selectedShopId, setSelectedShopId] = useState("SHOP-MISA-001");
  const [brandFilter] = useState<Brand | "전체">("전체");
  const [workFilter] = useState<WorkType | "전체">("전체");
  const [onlyAvailable] = useState(true);
  const [onlyApproved] = useState(true);
  const [request, setRequest] = useState<ServiceRequest>(defaultRequest);
  const [requestStatus, setRequestStatus] = useState<RequestStatus>("draft");
  const [messages, setMessages] = useState<ChatMessage[]>(initialChatMessages);
  const [messageDraft, setMessageDraft] = useState("");
  const [dealerDeals, setDealerDeals] = useState<DealerDeal[]>(initialDealerDeals);
  const [selectedDealId, setSelectedDealId] = useState(initialDealerDeals[0].id);
  const [dealFilter, setDealFilter] = useState<DealStatus | "전체">("전체");
  const [dealerChatDraft, setDealerChatDraft] = useState("");
  const [favoriteShopIds, setFavoriteShopIds] = useState<string[]>(["SHOP-MISA-001", "SHOP-BS-001"]);
  const [showFavoritesOnly] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState<DealerDeal | null>(null);
  const [conversationLoaded, setConversationLoaded] = useState(false);
  const [hasStoredConversation, setHasStoredConversation] = useState(false);
  const [priceBrandFilter, setPriceBrandFilter] = useState<"전체" | PriceBrand>("전체");
  const [priceSearch, setPriceSearch] = useState("");
  const [priceVehicleClass, setPriceVehicleClass] = useState<VehicleClass>("특대형");
  const [selectedPricePackageId, setSelectedPricePackageId] = useState(pricePackages[0].id);

  const shopsWithDistance = useMemo(() => {
    return installerShops
      .map((shop) => ({ shop, distance: distanceKm(location, shop) }))
      .filter(({ shop }) => (onlyApproved ? shop.approved : true))
      .filter(({ shop }) => (onlyAvailable ? shop.available : true))
      .filter(({ shop }) => (brandFilter === "전체" ? true : shop.brands.includes(brandFilter)))
      .filter(({ shop }) => (workFilter === "전체" ? true : shop.works.includes(workFilter)))
      .filter(({ shop }) => (showFavoritesOnly ? favoriteShopIds.includes(shop.id) : true))
      .sort((a, b) => a.distance - b.distance);
  }, [brandFilter, favoriteShopIds, location, onlyApproved, onlyAvailable, showFavoritesOnly, workFilter]);

  const visibleShops = shopsWithDistance.slice(0, 28);
  const selectedShop = installerShops.find((shop) => shop.id === selectedShopId) ?? visibleShops[0]?.shop ?? installerShops[0];
  const selectedDistance = formatDistance(distanceKm(location, selectedShop));
  const filteredDealerDeals = dealFilter === "전체" ? dealerDeals.filter((deal) => deal.status !== "작업완료") : dealerDeals.filter((deal) => deal.status === dealFilter);
  const selectedDeal = dealerDeals.find((deal) => deal.id === selectedDealId) ?? requestSuccess ?? dealerDeals[0];
  const activeDealerDealsCount = dealerDeals.filter((deal) => deal.status !== "작업완료").length;
  const unreadDealerMessages = dealerDeals.reduce((sum, deal) => sum + deal.unread, 0);
  const fee = calculateSettlement(600000, 3, 2.9);
  const filteredPricePackages = pricePackages.filter((item) => {
    const keyword = priceSearch.trim().toLowerCase();
    const matchesBrand = priceBrandFilter === "전체" || item.brand === priceBrandFilter;
    const matchesSearch = !keyword || `${item.brand} ${item.name} ${item.description}`.toLowerCase().includes(keyword);
    return matchesBrand && matchesSearch && item.available;
  });
  const selectedPricePackage = pricePackages.find((item) => item.id === selectedPricePackageId) ?? pricePackages[0];

  useEffect(() => {
    const loadConversation = (storedValue: string | null) => {
      if (!storedValue) {
        setHasStoredConversation(false);
        return;
      }

      try {
        const stored = JSON.parse(storedValue) as StoredConversation;
        if (!stored.requestStatus || !stored.request || !Array.isArray(stored.messages)) return;
        setHasStoredConversation(true);
        setRequestStatus(stored.requestStatus);
        setRequest(stored.request);
        setMessages(stored.messages);
        setSelectedShopId(stored.selectedShopId);
      } catch {
        setHasStoredConversation(false);
        localStorage.removeItem(conversationStorageKey);
      }
    };

    loadConversation(localStorage.getItem(conversationStorageKey));
    queueMicrotask(() => setConversationLoaded(true));

    const handleStorage = (event: StorageEvent) => {
      if (event.key === conversationStorageKey) loadConversation(event.newValue);
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    if (!conversationLoaded) return;
    if (!hasStoredConversation && requestStatus === "draft" && messages.length === initialChatMessages.length) return;
    const stored: StoredConversation = { requestStatus, messages, request, selectedShopId };
    localStorage.setItem(conversationStorageKey, JSON.stringify(stored));
    queueMicrotask(() => setHasStoredConversation(true));
  }, [conversationLoaded, hasStoredConversation, messages, request, requestStatus, selectedShopId]);

  useEffect(() => {
    if (!visibleShops.some(({ shop }) => shop.id === selectedShopId) && visibleShops[0]) {
      queueMicrotask(() => setSelectedShopId(visibleShops[0].shop.id));
    }
  }, [selectedShopId, visibleShops]);

  const applyPricePackageToRequest = (pricePackage: PricePackage, nextVehicleClass = priceVehicleClass, optionalServices: string[] = [], requestType: RequestType = "실제 시공 요청") => {
    const expectedPrice = pricePackage.prices[nextVehicleClass];
    const workItems = [pricePackage.name, ...pricePackage.includedServices, ...optionalServices];
    setSelectedPricePackageId(pricePackage.id);
    setPriceVehicleClass(nextVehicleClass);
    setRequest((current) => ({
      ...current,
      preferredBrand: pricePackage.brand as Brand,
      works: workItems,
      memo: `${pricePackage.name} / ${workItems.slice(1).join(" / ")}`,
      requestType,
      vehicleClass: nextVehicleClass,
      selectedPackageId: pricePackage.id,
      selectedPackageName: pricePackage.name,
      selectedPackageBrand: pricePackage.brand,
      expectedPrice,
      includedServices: pricePackage.includedServices,
      optionalServices,
    }));
    goToScreen("request");
  };

  const searchArea = (nextQuery = query) => {
    const nextLocation = findSearchLocation(nextQuery);
    setQuery(nextLocation.label);
    setLocation(nextLocation);
    setRequest((current) => ({ ...current, deliveryArea: nextLocation.label }));
  };

  const sendRequest = () => {
    const dealNumber = `CM-260713-${String(dealerDeals.length + 1).padStart(3, "0")}`;
    const newDeal: DealerDeal = {
      id: dealNumber,
      maker: request.maker,
      model: request.model,
      shopName: selectedShop.name,
      shopAddress: selectedShop.address,
      region: request.deliveryArea,
      works: request.works,
      packageName: request.selectedPackageName ?? request.works[0] ?? request.preferredBrand,
      requestType: request.requestType,
      extraWorkNote: request.extraWorkNote,
      vehicleClass: request.vehicleClass,
      expectedPrice: request.expectedPrice,
      status: "시공점 확인중",
      stage: "접수",
      inboundAt: request.inboundStart,
      lastMessage: `${request.requestType}을 전송했습니다.`,
      updatedAt: "지금",
      unread: 0,
      messages: [
        { id: `${dealNumber}-m1`, sender: "system", text: `${request.requestType} 거래방이 생성되었습니다. 자동 작업 브리핑을 확인하세요.`, time: "지금" },
        { id: `${dealNumber}-m2`, sender: "dealer", text: `${request.model} / ${request.deliveryArea} / ${request.selectedPackageName ?? request.works.join(", ")} / 추가 작업 ${request.extraWorkNote || "없음"} / ${request.inboundStart} 입고 예정입니다.`, time: "지금" },
      ],
    };
    setDealerDeals((current) => [newDeal, ...current]);
    setSelectedDealId(newDeal.id);
    setDealFilter("전체");
    setRequestSuccess(newDeal);
    setHasStoredConversation(true);
    setRequestStatus("sent");
    setMessages((current) => [
      ...current,
      {
        id: `m${current.length + 1}`,
        sender: "system",
        text: `딜러가 ${request.requestType}을 보냈습니다. 시공점이 수락하면 거래 전용 채팅이 활성화됩니다.`,
        time: "지금",
      },
    ]);
    goToScreen("deals");
  };

  const acceptRequest = () => {
    setHasStoredConversation(true);
    setRequestStatus("accepted");
    setDealerDeals((current) =>
      current.map((deal) =>
        deal.id === selectedDealId || (deal.status === "시공점 확인중" && deal.model === request.model)
          ? {
              ...deal,
              status: "진행중",
              stage: deal.stage === "접수" ? "입고" : deal.stage,
              lastMessage: "시공점이 요청을 수락했습니다. 거래 채팅이 활성화되었습니다.",
              updatedAt: "지금",
              messages: [
                ...deal.messages,
                { id: `${deal.id}-accepted`, sender: "shop", text: "요청 수락했습니다. 입고 일정과 작업 내용을 채팅에서 조율하겠습니다.", time: "지금" },
                { id: `${deal.id}-accepted-system`, sender: "system", text: "시공점 수락으로 거래 채팅이 활성화되었습니다.", time: "지금" },
              ],
            }
          : deal,
      ),
    );
    setMessages((current) => [
      ...current,
      {
        id: `m${current.length + 1}`,
        sender: "shop",
        text: "요청 수락했습니다. 입고일과 출고일을 제안드리겠습니다.",
        time: "지금",
      },
      {
        id: `m${current.length + 2}`,
        sender: "system",
        text: "시공점 수락으로 거래 전용 채팅이 활성화되었습니다.",
        time: "지금",
      },
    ]);
    goToScreen("chat");
  };

  const completeShopWork = () => {
    setHasStoredConversation(true);
    setRequestStatus("scheduleAgreed");
    setDealerDeals((current) =>
      current.map((deal) =>
        deal.id === selectedDealId || deal.model === request.model
          ? {
              ...deal,
              status: "작업완료",
              stage: "완료",
              completedAt: "지금",
              lastMessage: "작업완료 처리되었습니다.",
              updatedAt: "지금",
              messages: [
                ...deal.messages,
                { id: `${deal.id}-done`, sender: "shop", text: "작업완료 처리했습니다. 출고 전 확인 부탁드립니다.", time: "지금" },
                { id: `${deal.id}-done-system`, sender: "system", text: "거래 상태가 작업완료로 변경되었습니다.", time: "지금" },
              ],
            }
          : deal,
      ),
    );
    setMessages((current) => [
      ...current,
      { id: `m${current.length + 1}`, sender: "shop", text: "작업완료 처리했습니다. 출고 전 확인 부탁드립니다.", time: "지금" },
      { id: `m${current.length + 2}`, sender: "system", text: "거래 상태가 작업완료로 변경되었습니다.", time: "지금" },
    ]);
  };

  const agreeSchedule = () => {
    setHasStoredConversation(true);
    setRequestStatus("scheduleAgreed");
    setMessages((current) => [
      ...current,
      {
        id: `m${current.length + 1}`,
        sender: "dealer",
        text: "제안해주신 입고일과 출고일로 진행하겠습니다.",
        time: "09:31",
      },
      {
        id: `m${current.length + 2}`,
        sender: "system",
        text: "딜러가 일정에 동의했습니다. 거래 상태가 진행중으로 변경되었습니다.",
        time: "09:31",
      },
    ]);
  };

  const sendMessage = () => {
    const text = messageDraft.trim();
    if (!text) return;
    setHasStoredConversation(true);
    setMessages((current) => [
      ...current,
      {
        id: `m${current.length + 1}`,
        sender: role === "shop" ? "shop" : "dealer",
        text,
        time: "지금",
      },
    ]);
    setMessageDraft("");
  };

  const sendDealerChatMessage = () => {
    const text = dealerChatDraft.trim();
    if (!text || !selectedDeal) return;
    const nextMessage: ChatMessage = {
      id: `${selectedDeal.id}-m${selectedDeal.messages.length + 1}`,
      sender: "dealer",
      text,
      time: "지금",
    };
    setDealerDeals((current) =>
      current.map((deal) =>
        deal.id === selectedDeal.id
          ? { ...deal, messages: [...deal.messages, nextMessage], lastMessage: text, updatedAt: "지금", unread: 0 }
          : deal,
      ),
    );
    setDealerChatDraft("");
  };

  const agreeDealerSchedule = () => {
    if (!selectedDeal) return;
    setDealerDeals((current) =>
      current.map((deal) =>
        deal.id === selectedDeal.id
          ? {
              ...deal,
              status: "진행중",
              stage: deal.stage === "접수" ? "입고" : deal.stage,
              lastMessage: "제안 일정에 동의했습니다.",
              updatedAt: "지금",
              messages: [
                ...deal.messages,
                { id: `${deal.id}-agree`, sender: "dealer", text: "제안 일정에 동의했습니다.", time: "지금" },
                { id: `${deal.id}-system-agree`, sender: "system", text: "거래 상태가 진행중으로 변경되었습니다.", time: "지금" },
              ],
            }
          : deal,
      ),
    );
  };

  const updateSelectedDealStage = (stage: DealStage) => {
    if (!selectedDeal) return;
    const nextStatus: DealStatus = stage === "완료" ? "작업완료" : stage === "접수" ? "시공점 확인중" : "진행중";
    setDealerDeals((current) =>
      current.map((deal) =>
        deal.id === selectedDeal.id
          ? {
              ...deal,
              stage,
              status: nextStatus,
              completedAt: stage === "완료" ? "지금" : deal.completedAt,
              lastMessage: `진행상태가 ${stage}(으)로 변경되었습니다.`,
              updatedAt: "지금",
              messages: [
                ...deal.messages,
                { id: `${deal.id}-stage-${stage}-${deal.messages.length}`, sender: "system", text: `거래 진행상태가 ${stage}(으)로 변경되었습니다.`, time: "지금" },
              ],
            }
          : deal,
      ),
    );
  };

  const openDeal = (dealId: string, nextScreen: Screen = "deals") => {
    setSelectedDealId(dealId);
    setDealerDeals((current) => current.map((deal) => (deal.id === dealId ? { ...deal, unread: 0 } : deal)));
    goToScreen(nextScreen);
  };

  const openFilteredDeals = (filter: DealStatus | "전체") => {
    setDealFilter(filter);
    goToScreen("deals");
  };

  const toggleFavoriteShop = (shopId: string) => {
    setFavoriteShopIds((current) => (current.includes(shopId) ? current.filter((id) => id !== shopId) : [...current, shopId]));
  };

  const goToScreen = (nextScreen: Screen) => {
    setScreen(nextScreen);
    window.history.pushState(null, "", pathForScreen(nextScreen, role));
  };

  const loginWithAccount = (nextAccount: DemoAccount, options: { replace?: boolean } = {}) => {
    const storedConversationExists = typeof window !== "undefined" && Boolean(localStorage.getItem(conversationStorageKey));
    setAccount(nextAccount);
    setRole(nextAccount.role);

    if (nextAccount.role === "dealer") {
      if (!storedConversationExists && requestStatus === "draft") {
        setSelectedShopId("SHOP-MISA-001");
        setRequest(defaultRequest);
      }
      setQuery("경기 하남시 미사");
      setLocation(searchLocations[3]);
      setScreen("dealerDashboard");
    }

    if (nextAccount.role === "shop") {
      setSelectedShopId(nextAccount.shopId ?? "SHOP-MISA-001");
      setQuery("경기 하남시 미사");
      setLocation(searchLocations[3]);
      if (!storedConversationExists) {
        setRequest(defaultRequest);
        setRequestStatus((current) => current === "draft" ? "sent" : current);
      }
    }

    if (nextAccount.role === "admin") {
      setRequestStatus("sent");
    }

    setScreen(nextAccount.entryScreen);
    const nextPath = pathForScreen(nextAccount.entryScreen, nextAccount.role);
    if (options.replace) {
      window.history.replaceState(null, "", nextPath);
    } else {
      window.history.pushState(null, "", nextPath);
    }
  };

  useEffect(() => {
    const pathname = window.location.pathname;
    const routeAccount =
      pathname === "/dealer"
        ? demoAccounts[0]
        : pathname === "/shop"
          ? demoAccounts[1]
          : pathname === "/admin"
            ? demoAccounts[2]
            : null;

    if (routeAccount) {
      queueMicrotask(() => loginWithAccount(routeAccount, { replace: true }));
      return;
    }

    if (pathname === "/login") {
      queueMicrotask(() => setScreen("login"));
      return;
    }

    queueMicrotask(() => setScreen("landing"));
    // The initial route bootstrap intentionally runs once on first mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (screen === "landing") {
    return <LandingPage onLogin={() => goToScreen("login")} onDealerStart={() => goToScreen("login")} />;
  }

  if (screen === "login") {
    return <LoginScreen accounts={demoAccounts} onLogin={loginWithAccount} />;
  }

  const navItems: { id: Screen; label: string; icon?: DealerIconName; disabled?: boolean }[] =
    role === "dealer"
      ? [
          { id: "dealerDashboard", label: "대시보드", icon: "dashboard" },
          { id: "priceGuide", label: "권장 시공가", icon: "price" },
          { id: "request", label: "내 시공 요청", icon: "request" },
          { id: "dealerMap", label: "전국 시공점 찾기", icon: "shop" },
          { id: "deals", label: "거래 관리", icon: "deals" },
          { id: "chat", label: "거래 채팅", icon: "chat" },
          { id: "dealerSettlement", label: "결제 및 정산", icon: "settlement" },
          { id: "dealerProfile", label: "마이페이지", icon: "profile" },
        ]
      : role === "shop"
        ? [
            { id: "shopRequests", label: "새 요청 처리" },
            { id: "chat", label: "거래 채팅", disabled: requestStatus === "draft" || requestStatus === "sent" },
          ]
        : [
            { id: "ops", label: "관리·결제·정산" },
          ];

  return (
    <div className={`app-shell ${role === "dealer" ? "dealer-app-shell" : ""}`}>
      <aside className={`side-nav ${role === "dealer" ? "dealer-side-nav" : ""}`}>
        <button className="brand-mark" onClick={() => goToScreen(role === "admin" ? "ops" : role === "shop" ? "shopRequests" : "dealerDashboard")}>
          <LogoImage />
          <small>{role === "dealer" ? "DEALER WORKSPACE" : "시연 계정 3개 · 입점 시공점 100+"}</small>
        </button>
        <nav>
          {navItems.map((item) => (
            <button
              key={item.id}
              className={screen === item.id || (item.id === "request" && screen === "requestSummary") ? "active" : ""}
              onClick={() => goToScreen(item.id)}
              disabled={item.disabled}
            >
              {role === "dealer" && item.icon && <DealerIcon name={item.icon} />}
              {item.label}
            </button>
          ))}
        </nav>
        <div className="account-panel">
          {role === "dealer" ? (
            <>
              <div className="dealer-avatar">한</div>
              <span><b>한재진 딜러</b><small>딜러 권한</small><small>소속: 한재진딜러</small></span>
              <button onClick={() => goToScreen("login")}><DealerIcon name="logout" />로그아웃</button>
            </>
          ) : (
            <><small>로그인 계정</small><b>{account.name}</b><span>{roleLabel[role]} 권한</span></>
          )}
        </div>
      </aside>

      <main className={`workspace ${role === "dealer" ? "dealer-workspace" : ""}`}>
        <header className={`topbar ${role === "dealer" ? "dealer-topbar" : ""}`}>
          <div>
            <b>{role === "dealer" ? "한재진 딜러" : account.name} · {roleLabel[role]} 워크스페이스</b>
            <span>
              {role === "dealer"
                ? `진행 중 ${activeDealerDealsCount}건 · 읽지 않은 메시지 ${unreadDealerMessages}건`
                : `아이디 ${account.email} · 실제 로그인 사용자는 딜러 1명, 시공점 1곳, 관리자 1명으로 분리되어 있습니다.`}
            </span>
          </div>
          {role === "dealer" ? (
            <div className="dealer-top-actions">
              <button aria-label="알림"><DealerIcon name="bell" /><i>{unreadDealerMessages}</i></button>
              <span><b>한재진 딜러</b><small>한재진딜러</small></span>
              <div className="dealer-avatar small">한</div>
            </div>
          ) : <button onClick={() => goToScreen("login")}>로그아웃</button>}
        </header>

        {screen === "dealerDashboard" && (
          <DealerDashboard
            deals={dealerDeals}
            onFilterDeals={openFilteredDeals}
            onOpenDeal={(dealId) => openDeal(dealId, "chat")}
            onNewRequest={() => goToScreen("request")}
            onFindShop={() => goToScreen("dealerMap")}
            onPriceGuide={() => goToScreen("priceGuide")}
            onOpenChat={() => goToScreen("chat")}
          />
        )}

        {screen === "priceGuide" && (
          <PriceGuideScreen
            packages={filteredPricePackages}
            selectedPackage={selectedPricePackage}
            selectedPackageId={selectedPricePackageId}
            setSelectedPackageId={setSelectedPricePackageId}
            brandFilter={priceBrandFilter}
            setBrandFilter={setPriceBrandFilter}
            search={priceSearch}
            setSearch={setPriceSearch}
            vehicleClass={priceVehicleClass}
            setVehicleClass={setPriceVehicleClass}
            onRequest={applyPricePackageToRequest}
          />
        )}

        {screen === "dealerMap" && (
          <DealerMapScreen
            query={query}
            setQuery={setQuery}
            searchArea={searchArea}
            location={location}
            visibleShops={visibleShops}
            selectedShop={selectedShop}
            selectedDistance={selectedDistance}
            selectedShopId={selectedShopId}
            setSelectedShopId={setSelectedShopId}
            favoriteShopIds={favoriteShopIds}
            toggleFavoriteShop={toggleFavoriteShop}
            onRequest={() => goToScreen("request")}
          />
        )}

        {screen === "request" && (
          <RequestScreen
            request={request}
            setRequest={setRequest}
            searchArea={searchArea}
            visibleShops={visibleShops}
            selectedShop={selectedShop}
            selectedDistance={selectedDistance}
            selectedShopId={selectedShopId}
            setSelectedShopId={setSelectedShopId}
            onSummary={() => goToScreen("requestSummary")}
            onPriceGuide={() => goToScreen("priceGuide")}
          />
        )}

        {screen === "requestSummary" && (
          <RequestSummary request={request} selectedShop={selectedShop} selectedDistance={selectedDistance} onBack={() => goToScreen("request")} onSend={sendRequest} />
        )}

        {screen === "deals" && (
          <DealsScreen
            deals={filteredDealerDeals}
            allDeals={dealerDeals}
            selectedDeal={selectedDeal}
            filter={dealFilter}
            setFilter={setDealFilter}
            onOpenDeal={(dealId) => openDeal(dealId, "deals")}
            onOpenChat={(dealId) => openDeal(dealId, "chat")}
            requestSuccess={requestSuccess}
            clearRequestSuccess={() => setRequestSuccess(null)}
          />
        )}

        {screen === "shopRequests" && (
          <ShopRequests request={request} selectedShop={selectedShop} status={requestStatus} onAccept={acceptRequest} onReject={() => setRequestStatus("draft")} onOpenChat={() => goToScreen("chat")} onComplete={completeShopWork} />
        )}

        {screen === "chat" && (
          role === "dealer" ? (
            <DealerChatScreen
              deals={dealerDeals}
              selectedDeal={selectedDeal}
              selectedDealId={selectedDealId}
              onSelectDeal={(dealId) => openDeal(dealId, "chat")}
              draft={dealerChatDraft}
              setDraft={setDealerChatDraft}
              sendMessage={sendDealerChatMessage}
              onAgree={agreeDealerSchedule}
              onStageChange={(stage) => updateSelectedDealStage(stage)}
              onOpenDetail={(dealId) => openDeal(dealId, "deals")}
            />
          ) : (
            <ChatScreen
              role={role}
              request={request}
              selectedShop={selectedShop}
              status={requestStatus}
              messages={messages}
              messageDraft={messageDraft}
              setMessageDraft={setMessageDraft}
              sendMessage={sendMessage}
              onAgree={agreeSchedule}
            />
          )
        )}

        {screen === "ops" && <OperationsScreen fee={fee} />}
        {screen === "dealerSettlement" && <DealerSettlementScreen deals={dealerDeals} />}
        {screen === "dealerProfile" && <DealerProfileScreen onLogout={() => goToScreen("login")} />}
      </main>
    </div>
  );
}

function LandingPage({ onLogin, onDealerStart }: { onLogin: () => void; onDealerStart: () => void }) {
  const features = [
    { title: "카카오톡 상담을 거래방으로 정리", description: "차량, 작업, 입고예정일이 자동 브리핑으로 남아 대화가 흩어지지 않습니다." },
    { title: "권장 시공가에서 바로 요청", description: "브랜드와 제품을 고른 뒤 견적 문의 또는 실제 시공 요청으로 이어집니다." },
    { title: "시공점 선택과 일정 조율", description: "지역 기반으로 시공점을 고르고, 수락 후 거래방에서 입고·출고 일정을 맞춥니다." },
  ];
  const steps = ["권장 시공가 확인", "견적 문의 또는 시공 요청", "차량정보 입력", "시공점 선택", "거래방에서 일정 조율"];
  const faqs = [
    { q: "실제 결제나 정산이 연결되어 있나요?", a: "아직 아닙니다. 현재 버전은 딜러 업무 흐름 검증을 위한 샘플 데이터 기반 프로토타입입니다." },
    { q: "시공점과 바로 채팅할 수 있나요?", a: "시공 요청 또는 견적 문의 후 시공점이 수락하면 거래방 채팅이 활성화됩니다." },
    { q: "권장 시공가는 확정 가격인가요?", a: "아닙니다. 실제 금액은 시공점, 차량 크기, 추가 작업에 따라 달라질 수 있습니다." },
  ];

  return (
    <div className="landing-page">
      <header className="landing-header">
        <button className="landing-brand" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          <LogoImage compact />
        </button>
        <nav>
          <a href="#service">서비스 소개</a>
          <a href="#price">권장 시공가</a>
          <a href="#faq">고객센터</a>
        </nav>
        <div className="landing-actions">
          <button className="secondary" onClick={onLogin}>로그인</button>
        </div>
      </header>

      <main>
        <section className="landing-hero">
          <div className="hero-copy">
            <p className="eyebrow">딜러를 위한 자동차 용품 시공 업무 플랫폼</p>
            <h1>자동차 용품 시공,<br />카카오톡 대신<br />카마스터 하나로.</h1>
            <p className="hero-desc">
              차량모델, 시공지역, 작업내용, 입고예정일만 입력하면 권장 시공가 확인부터
              시공점 선택, 거래방 생성, 일정 조율까지 한 화면 흐름으로 관리합니다.
            </p>
            <div className="hero-buttons">
              <button className="primary" onClick={onDealerStart}>시공 요청 시작하기</button>
              <a className="secondary hero-link" href="#service">서비스 미리보기</a>
            </div>
            <div className="trust-metrics" aria-label="서비스 신뢰 지표">
              <span><b>4개</b>핵심 입력</span>
              <span><b>100+</b>샘플 등록 시공점</span>
              <span><b>1곳</b>거래방 관리</span>
            </div>
          </div>
          <LandingServicePreview />
        </section>

        <section className="landing-section feature-cards" id="service">
          <div className="landing-section-head">
            <p className="eyebrow">SERVICE</p>
            <h2>딜러의 하루 업무를 한 흐름으로 정리합니다.</h2>
          </div>
          {features.map((feature, index) => (
            <article key={feature.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h2>{feature.title}</h2>
              <p>{feature.description}</p>
            </article>
          ))}
        </section>

        <section className="landing-flow" id="flow">
          <p className="eyebrow">HOW IT WORKS</p>
          <h2>시공 요청은 이렇게 진행됩니다.</h2>
          <div>
            {steps.map((item, index) => (
              <span key={item}><b>{index + 1}</b>{item}</span>
            ))}
          </div>
        </section>

        <section className="price-guide-strip" id="price">
          <div>
            <p className="eyebrow">PRICE GUIDE</p>
            <h2>권장 시공가를 먼저 확인하고 문의를 시작하세요.</h2>
            <p>버텍스, 솔라가드, 브이쿨 등 샘플 상품을 기준으로 권장 시공가 구조를 확인할 수 있습니다.</p>
          </div>
          <button className="primary" onClick={onDealerStart}>권장 시공가 보기</button>
        </section>

        <section className="landing-faq" id="faq">
          <div className="landing-section-head">
            <p className="eyebrow">FAQ</p>
            <h2>자주 묻는 질문</h2>
          </div>
          <div>
            {faqs.map((faq) => (
              <article key={faq.q}>
                <h3>{faq.q}</h3>
                <p>{faq.a}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <LogoImage compact />
        <span>자동차 용품 시공 업무를 카카오톡 밖으로 꺼내는 B2B 플랫폼</span>
        <button onClick={onLogin}>로그인</button>
      </footer>
    </div>
  );
}

function LandingServicePreview() {
  return (
    <div className="hero-preview-panel landing-mockup">
      <div className="preview-toolbar">
        <span>서비스 미리보기</span>
        <b>CM-260716-001</b>
      </div>
      <div className="preview-content">
        <article className="preview-request-card">
          <span className="status-chip">권장 시공가</span>
          <h2>버텍스 900</h2>
          <p>국산 승용 기준 · 가격 입력 예정</p>
          <div>
            <b>다음 행동</b>
            <span>견적 문의 / 실제 시공 요청</span>
          </div>
        </article>

        <article className="landing-shop-card static mockup-briefing">
          <span className="verified-badge">자동 작업 브리핑</span>
          <h2>제네시스 G80 · 신차패키지</h2>
          <p>서울 강남구 · 입고 예정 7월 22일</p>
          <dl>
            <div><dt>추가 작업</dt><dd>PPF, 블랙박스</dd></div>
            <div><dt>진행상태</dt><dd>접수 완료</dd></div>
          </dl>
        </article>

        <div className="preview-flow">
          {["가격 확인", "요청 전송", "시공점 선택", "거래방 생성", "일정 조율"].map((item, index) => (
            <span key={item}><b>{index + 1}</b>{item}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function LoginScreen({ accounts, onLogin }: { accounts: DemoAccount[]; onLogin: (account: DemoAccount) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = () => {
    const matchedAccount = accounts.find(
      (account) => account.email.toLowerCase() === email.trim().toLowerCase() && account.password === password,
    );

    if (!matchedAccount) {
      setError("아이디 또는 비밀번호가 올바르지 않습니다.");
      return;
    }

    onLogin(matchedAccount);
  };

  return (
    <div className="login-screen">
      <section className="login-hero">
        <div className="brand-mark large">
          <LogoImage />
          <small>리스·렌트 딜러용 전국 시공 네트워크</small>
        </div>
        <h1>고객 차량 인도 지역만 입력하면 가까운 등록 시공점을 바로 찾습니다.</h1>
        <p>시공 요청 전송, 시공점 수락, 거래 전용 채팅, 입고일과 출고일 조율까지 샘플 데이터로 시연할 수 있습니다.</p>
      </section>
      <section className="login-card">
        <p className="eyebrow">DEMO LOGIN</p>
        <h2>로그인</h2>
        <p className="login-note">발급받은 아이디와 비밀번호를 입력하세요.</p>
        <label>
          아이디
          <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="아이디를 입력하세요" />
        </label>
        <label>
          비밀번호
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => event.key === "Enter" && submit()} placeholder="비밀번호를 입력하세요" />
        </label>
        {error && <p className="login-error">{error}</p>}
        <button className="primary full" onClick={submit}>로그인</button>
      </section>
    </div>
  );
}

function PriceGuideScreen({
  packages,
  selectedPackage,
  selectedPackageId,
  setSelectedPackageId,
  brandFilter,
  setBrandFilter,
  search,
  setSearch,
  vehicleClass,
  setVehicleClass,
  onRequest,
}: {
  packages: PricePackage[];
  selectedPackage: PricePackage;
  selectedPackageId: string;
  setSelectedPackageId: (id: string) => void;
  brandFilter: "전체" | PriceBrand;
  setBrandFilter: (brand: "전체" | PriceBrand) => void;
  search: string;
  setSearch: (value: string) => void;
  vehicleClass: VehicleClass;
  setVehicleClass: (value: VehicleClass) => void;
  onRequest: (pricePackage: PricePackage, vehicleClass: VehicleClass, optionalServices?: string[], requestType?: RequestType) => void;
}) {
  return (
    <section className="dealer-screen price-guide-screen">
      <div className="page-title price-guide-title">
        <div>
          <p className="eyebrow">RECOMMENDED PRICE · v0.3 검증</p>
          <h1>권장 시공가</h1>
          <p>필름 브랜드와 제품을 먼저 고른 뒤, 견적 문의 또는 실제 시공 요청으로 이어가세요.</p>
          <small>현재 금액은 샘플 구조입니다. 실제 권장가는 추후 관리자가 입력합니다.</small>
        </div>
      </div>

      <div className="price-guide-toolbar">
        <div className="price-brand-tabs">
          {priceBrands.map((brand) => (
            <button key={brand} className={brandFilter === brand ? "active" : ""} onClick={() => setBrandFilter(brand)}>
              {brand}
            </button>
          ))}
        </div>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="제품명을 검색하세요. 예: 버텍스 900" />
      </div>

      <section className="vehicle-class-guide">
        <div>
          <h2>국산 승용 기준 권장 시공가</h2>
          <p>딜러가 상담 전 빠르게 확인하는 기준가입니다. 대형 차량, 수입차, 추가 작업은 실제 견적에서 달라질 수 있습니다.</p>
        </div>
        <div className="vehicle-class-tabs">
          {vehicleClassGuides.map((guide) => (
            <button key={guide.className} className={vehicleClass === guide.className ? "active" : ""} onClick={() => setVehicleClass(guide.className)}>
              <b>{guide.className}</b>
              <span>{guide.examples.slice(0, 3).join(", ")}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="price-guide-layout">
        <section className="price-package-grid">
          {packages.length === 0 ? (
            <div className="empty-state">검색 조건에 맞는 상품이 없습니다.</div>
          ) : packages.map((item) => (
            <PricePackageCard
              key={item.id}
              item={item}
              vehicleClass={vehicleClass}
              selected={item.id === selectedPackageId}
              onDetail={() => setSelectedPackageId(item.id)}
              onQuote={() => onRequest(item, vehicleClass, [], "견적 문의")}
              onRequest={() => onRequest(item, vehicleClass, [], "실제 시공 요청")}
            />
          ))}
        </section>
        <PricePackageDetail
          item={selectedPackage}
          vehicleClass={vehicleClass}
          onQuote={() => onRequest(selectedPackage, vehicleClass, [], "견적 문의")}
          onRequest={() => onRequest(selectedPackage, vehicleClass, [], "실제 시공 요청")}
        />
      </div>
    </section>
  );
}

function PricePackageCard({ item, vehicleClass, selected, onDetail, onQuote, onRequest }: { item: PricePackage; vehicleClass: VehicleClass; selected: boolean; onDetail: () => void; onQuote: () => void; onRequest: () => void }) {
  return (
    <article className={`price-package-card ${selected ? "selected" : ""}`}>
      <div className="price-package-head">
        <span>{item.brand}</span>
        {item.recommended && <em>추천 상품</em>}
      </div>
      <h2>{item.name}</h2>
      <p>{item.description}</p>
      <dl className="price-table-mini">
        {vehicleClassLabels.map((label) => (
          <div key={label} className={label === vehicleClass ? "active" : ""}>
            <dt>{label}</dt>
            <dd>{item.prices[label]}</dd>
          </div>
        ))}
      </dl>
      <div className="included-services">
        <b>기본 포함</b>
        {item.includedServices.slice(0, 4).map((service) => <span key={service}>{service}</span>)}
      </div>
      <div className="price-card-actions">
        <button className="secondary" onClick={onDetail}>상세보기</button>
        <button className="secondary" onClick={onQuote}>견적 문의</button>
        <button className="primary" onClick={onRequest}>실제 시공 요청</button>
      </div>
    </article>
  );
}

function PricePackageDetail({ item, vehicleClass, onQuote, onRequest }: { item: PricePackage; vehicleClass: VehicleClass; onQuote: () => void; onRequest: () => void }) {
  return (
    <aside className="price-package-detail">
      <span>{item.brand}</span>
      <h2>{item.name}</h2>
      <p>{item.description}</p>
      <div className="detail-price-box">
        <small>{vehicleClass} · 국산 승용 기준 권장 시공가</small>
        <b>{item.prices[vehicleClass]}</b>
      </div>
      <dl>
        <div><dt>추천 차량</dt><dd>{item.recommendedVehicles}</dd></div>
        <div><dt>기본 포함 작업</dt><dd>{item.includedServices.join(", ")}</dd></div>
        <div><dt>선택 가능 추가 작업</dt><dd>{item.optionalServices.join(", ")}</dd></div>
        <div><dt>안내사항</dt><dd>{item.notice}</dd></div>
      </dl>
      <div className="price-notice-box">
        <p>※ 시공점마다 실제 금액은 소폭 달라질 수 있습니다.</p>
        <p>※ 대형 차량 및 추가 작업은 추가 비용이 발생할 수 있습니다.</p>
      </div>
      <div className="price-detail-actions">
        <button className="secondary" onClick={onQuote}>견적 문의</button>
        <button className="primary" onClick={onRequest}>실제 시공 요청</button>
      </div>
    </aside>
  );
}

function DealerMapScreen(props: {
  query: string;
  setQuery: (value: string) => void;
  searchArea: (query?: string) => void;
  location: SearchLocation;
  visibleShops: { shop: InstallerShop; distance: number }[];
  selectedShop: InstallerShop;
  selectedDistance: string;
  selectedShopId: string;
  setSelectedShopId: (id: string) => void;
  favoriteShopIds: string[];
  toggleFavoriteShop: (shopId: string) => void;
  onRequest: () => void;
}) {
  const {
    query,
    setQuery,
    searchArea,
    location,
    visibleShops,
    selectedShop,
    selectedDistance,
    selectedShopId,
    setSelectedShopId,
    favoriteShopIds,
    toggleFavoriteShop,
    onRequest,
  } = props;

  return (
    <section className="dealer-screen">
      <div className="page-title">
        <div>
          <p className="eyebrow">DEALER FLOW</p>
          <h1>고객 차량 시공 지역을 검색하세요</h1>
          <p>검색 지역 주변의 카마스터 등록 시공점을 거리순 목록으로 확인하고 시공 요청을 보낼 수 있습니다.</p>
          <p>현재 시연 로그인 사용자는 한재진딜러 1명이며, 목록에는 아직 별도 로그인 계정이 없는 입점 시공점 100여 곳이 노출됩니다.</p>
        </div>
      </div>

      <div className="map-search">
        <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && searchArea()} aria-label="시공지역을 입력하세요" placeholder="시공지역을 입력하세요" />
        <button className="primary" onClick={() => searchArea()}>검색</button>
      </div>

      <div className="shop-finder-layout">
        <aside className="results-panel finder-results">
          <div className="results-head">
            <b>{location.label} 주변 등록 시공점</b>
            <span>{visibleShops.length}곳 · 거리순</span>
          </div>
          {visibleShops.length === 0 ? (
            <div className="empty-state">선택한 조건에 맞는 시공점이 없습니다. 검색 범위를 넓혀보세요.</div>
          ) : (
            visibleShops.map(({ shop, distance }) => (
              <button key={shop.id} className={`shop-row ${shop.id === selectedShopId ? "selected" : ""}`} onClick={() => setSelectedShopId(shop.id)}>
                <span className="shop-logo">{shop.name.slice(0, 2)}</span>
                <span>
                  <small>{formatDistance(distance)} · {shop.available ? "요청 가능" : "요청 마감"}</small>
                  <b>{shop.name}</b>
                  <em>가능 브랜드: {shop.brands.slice(0, 3).join(", ")}</em>
                  <i>가능 작업: {shop.works.slice(0, 3).join(", ")}</i>
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  className={`favorite-star ${favoriteShopIds.includes(shop.id) ? "active" : ""}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleFavoriteShop(shop.id);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      event.stopPropagation();
                      toggleFavoriteShop(shop.id);
                    }
                  }}
                  aria-label={`${shop.name} 즐겨찾기`}
                >
                  ★
                </span>
              </button>
            ))
          )}
        </aside>
        <div className="selected-shop-panel">
          <ShopMapCard
            shop={selectedShop}
            distance={selectedDistance}
            onRequest={onRequest}
          />
        </div>
      </div>
    </section>
  );
}

function ShopMapCard({
  shop,
  distance,
  onRequest,
}: {
  shop: InstallerShop;
  distance: string;
  onRequest: () => void;
}) {
  return (
    <article className="map-card">
      <div className="map-card-head">
        <div>
          <span className="verified-badge">카마스터 등록 시공점</span>
          <h2>{shop.name}</h2>
          <p>{shop.address}</p>
        </div>
        <b>{distance}</b>
      </div>
      <dl>
        <div><dt>거리</dt><dd>{distance}</dd></div>
        <div><dt>가능 브랜드</dt><dd>{shop.brands.slice(0, 4).join(", ")}</dd></div>
        <div><dt>가능 작업</dt><dd>{shop.works.slice(0, 4).join(", ")}</dd></div>
        <div><dt>영업시간</dt><dd>{shop.hours}</dd></div>
        <div><dt>평균 응답</dt><dd>{shop.responseTime}</dd></div>
        <div><dt>요청 가능</dt><dd>{shop.available ? "가능" : "마감"}</dd></div>
        <div><dt>사업자 정보</dt><dd>{shop.approved ? "등록" : "확인 필요"}</dd></div>
      </dl>
      <div className="card-actions">
        <button className="primary" onClick={onRequest}>시공 요청하기</button>
      </div>
    </article>
  );
}

function StatusBadge({ status }: { status: DealStatus }) {
  return <span className={`deal-status ${statusTone[status]}`}>{status}</span>;
}

function DealerDashboard({
  deals,
  onFilterDeals,
  onOpenDeal,
  onNewRequest,
  onFindShop,
  onPriceGuide,
  onOpenChat,
}: {
  deals: DealerDeal[];
  onFilterDeals: (filter: DealStatus | "전체") => void;
  onOpenDeal: (dealId: string) => void;
  onNewRequest: () => void;
  onFindShop: () => void;
  onPriceGuide: () => void;
  onOpenChat: () => void;
}) {
  const recentRequests = deals.filter((deal) => deal.status === "시공점 확인중").slice(0, 3);
  const recentChats = deals.filter((deal) => deal.messages.length > 0).slice(0, 3);
  const recentDone = deals.filter((deal) => deal.status === "작업완료").slice(0, 3);
  const todayInbound = deals.filter((deal) => deal.inboundAt?.includes("2026-07-14")).slice(0, 3);

  return (
    <section className="dealer-dashboard">
      <div className="dealer-welcome">
        <div>
          <h1>안녕하세요, 한재진 딜러님</h1>
          <p>오늘의 시공 요청과 진행 중인 거래를 확인하세요.</p>
        </div>
        <span>2026년 7월 14일 화요일</span>
      </div>

      <div className="dashboard-action-row">
        <button className="primary new-request-cta" onClick={onNewRequest}>
          <DealerIcon name="request" />
          새 시공 요청
        </button>
        <button className="secondary" onClick={onFindShop}>전국 시공점 찾기</button>
      </div>

      <div className="metric-grid today-task-grid">
        {dashboardMetrics.map((metric) => (
          <button key={metric.label} className="metric-card" onClick={() => onFilterDeals(metric.filter)}>
            <span><i></i>{metric.label}</span>
            <b>{metric.value}</b><DealerIcon name="arrow" />
          </button>
        ))}
      </div>

      <div className="today-card-grid">
        <TodayListCard title="최근 요청" deals={recentRequests} emptyText="확인중인 요청이 없습니다." onOpenDeal={onOpenDeal} />
        <TodayListCard title="최근 채팅" deals={recentChats} emptyText="최근 채팅이 없습니다." onOpenDeal={onOpenChat} />
        <TodayListCard title="최근 완료거래" deals={recentDone} emptyText="완료된 거래가 없습니다." onOpenDeal={onOpenDeal} />
      </div>

      <div className="dashboard-extra-grid">
        <section className="today-list-card inbound-card">
          <div className="section-head"><h2>오늘 입고 예정 차량</h2></div>
          <div>
            {todayInbound.length === 0 ? <p>오늘 입고 예정 차량이 없습니다.</p> : todayInbound.map((deal) => (
              <button key={deal.id} onClick={() => onOpenDeal(deal.id)}>
                <span><b>{deal.model}</b><small>{deal.inboundAt} · {deal.shopName}</small></span>
                <StatusBadge status={deal.status} />
              </button>
            ))}
          </div>
        </section>
        <section className="dealer-package-banner">
          <span>오늘 먼저 확인할 권장 시공가</span>
          <b>버텍스 900 · 솔라가드 프리미엄 · 브이쿨 K</b>
          <p>브랜드와 제품을 고르면 견적 문의 또는 실제 시공 요청으로 바로 이어집니다.</p>
          <div>
            <button className="primary" onClick={onPriceGuide}>권장 시공가 확인</button>
            <button className="secondary" onClick={onNewRequest}>바로 시공 요청</button>
          </div>
        </section>
      </div>
    </section>
  );
}

function TodayListCard({ title, deals, emptyText, onOpenDeal }: { title: string; deals: DealerDeal[]; emptyText: string; onOpenDeal: (dealId: string) => void }) {
  return (
    <section className="today-list-card">
      <div className="section-head"><h2>{title}</h2></div>
      <div>
        {deals.length === 0 ? <p>{emptyText}</p> : deals.map((deal) => (
          <button key={deal.id} onClick={() => onOpenDeal(deal.id)}>
            <span><b>{deal.model}</b><small>{deal.packageName} · {deal.region}</small></span>
            <StatusBadge status={deal.status} />
          </button>
        ))}
      </div>
    </section>
  );
}

function RequestScreen({
  request,
  setRequest,
  searchArea,
  visibleShops,
  selectedShop,
  selectedDistance,
  selectedShopId,
  setSelectedShopId,
  onSummary,
  onPriceGuide,
}: {
  request: ServiceRequest;
  setRequest: (request: ServiceRequest) => void;
  searchArea: (query?: string) => void;
  visibleShops: { shop: InstallerShop; distance: number }[];
  selectedShop: InstallerShop;
  selectedDistance: string;
  selectedShopId: string;
  setSelectedShopId: (id: string) => void;
  onSummary: () => void;
  onPriceGuide: () => void;
}) {
  const modelPresets = ["제네시스 GV80", "현대 그랜저", "기아 카니발", "테슬라 모델Y"];
  const datePresets = [
    { label: "이번 주", value: "이번 주 협의" },
    { label: "다음 주", value: "다음 주 협의" },
    { label: "일정 미정", value: "일정 미정" },
  ];
  const workText = request.works.join(", ");
  const detectedVehicleClass = classifyVehicleModel(request.model);
  const isReady = Boolean(request.model.trim() && request.deliveryArea.trim() && workText.trim() && request.inboundStart.trim() && selectedShop);

  const updateModel = (model: string) => {
    const nextClass = classifyVehicleModel(model);
    setRequest({ ...request, model, vehicleClass: nextClass || request.vehicleClass });
  };

  const updateWorkText = (value: string) => {
    setRequest({ ...request, works: value ? [value] : [], memo: value });
  };

  const updateVehicleClass = (vehicleClass: VehicleClass) => {
    const selectedPackage = request.selectedPackageId ? pricePackages.find((item) => item.id === request.selectedPackageId) : null;
    setRequest({ ...request, vehicleClass, expectedPrice: selectedPackage?.prices[vehicleClass] ?? request.expectedPrice });
  };

  const findShops = () => {
    searchArea(request.deliveryArea);
  };

  return (
    <section className="form-screen simple-request-screen practical-request-screen">
      <div className="page-title simple-request-title">
        <div>
          <p className="eyebrow">REQUEST FLOW · v0.2.4</p>
          <h1>내 시공 요청</h1>
          <p>차량모델, 시공지역, 작업내용, 입고예정일 4가지만 입력하고 등록 시공점을 선택하세요.</p>
        </div>
      </div>

      <div className="request-steps" aria-label="시공 요청 단계">
        <span className="active">1. 요청정보 입력</span>
        <span className={visibleShops.length ? "active" : ""}>2. 시공점 선택</span>
        <span className={isReady ? "active" : ""}>3. 요청 확인</span>
      </div>

      {request.selectedPackageName && (
        <section className="selected-package-summary">
          <div>
            <span>선택 상품 요약</span>
            <b>{request.requestType} · {request.selectedPackageBrand} · {request.selectedPackageName}</b>
            <p>{request.vehicleClass || detectedVehicleClass || "등급 선택 필요"} · 권장 시공가 {request.expectedPrice ?? "가격 입력 예정"}</p>
          </div>
          <button type="button" onClick={onPriceGuide}>상품 변경</button>
        </section>
      )}

      <div className="practical-request-layout">
        <form className="simple-request-card practical-request-card">
          <label className="wide-field">
            <span>차량모델</span>
            <input value={request.model} onChange={(event) => updateModel(event.target.value)} placeholder="예: 제네시스 GV80" />
            <small>차량 크기와 시공 가능 범위를 구분하는 기준 정보입니다.</small>
            <div className="quick-chip-row">
              {modelPresets.map((model) => <button type="button" key={model} onClick={() => updateModel(model)}>{model}</button>)}
            </div>
            <div className="vehicle-class-picker">
              <span>차량 등급</span>
              {vehicleClassLabels.map((label) => (
                <button type="button" key={label} className={(request.vehicleClass || detectedVehicleClass) === label ? "active" : ""} onClick={() => updateVehicleClass(label)}>{label}</button>
              ))}
            </div>
          </label>

          <label>
            <span>시공지역</span>
            <input value={request.deliveryArea} onChange={(event) => setRequest({ ...request, deliveryArea: event.target.value })} onBlur={findShops} placeholder="예: 경기 하남시 미사" />
            <small>실제 지도 API 없이 샘플 지역 검색으로 등록 시공점 목록이 바뀝니다.</small>
          </label>

          <label>
            <span>입고예정일</span>
            <input value={request.inboundStart} onChange={(event) => setRequest({ ...request, inboundStart: event.target.value, inboundEnd: event.target.value })} placeholder="예: 2026-07-24 또는 일정 미정" />
            <div className="quick-chip-row">
              {datePresets.map((preset) => (
                <button type="button" key={preset.value} onClick={() => setRequest({ ...request, inboundStart: preset.value, inboundEnd: preset.value })}>{preset.label}</button>
              ))}
            </div>
          </label>

          <label className="wide-field">
            <span>작업내용</span>
            <input value={workText} onChange={(event) => updateWorkText(event.target.value)} placeholder="예: 버텍스 900, 신차검수" />
          </label>

          <label className="wide-field">
            <span>추가 작업 문의</span>
            <input value={request.extraWorkNote} onChange={(event) => setRequest({ ...request, extraWorkNote: event.target.value })} placeholder="예: 블랙박스, PPF, 유리막, 번호판" />
            <small>체크박스 없이 자유롭게 입력합니다. 입력한 내용은 거래방 작업 브리핑에 자동 표시됩니다.</small>
          </label>

          <button type="button" className="primary request-submit-button" onClick={onSummary} disabled={!isReady}>{request.requestType} 보내기</button>
        </form>

        <aside className="request-shop-selection">
          <div className="request-shop-head">
            <span>2. 시공점 선택</span>
            <button type="button" onClick={findShops}>시공점 찾기</button>
          </div>
          <p>{request.deliveryArea || "시공지역"} 주변 등록 시공점 {visibleShops.length}곳</p>
          <div className="request-shop-list">
            {visibleShops.slice(0, 5).map(({ shop, distance }) => (
              <button type="button" key={shop.id} className={shop.id === selectedShopId ? "selected" : ""} onClick={() => setSelectedShopId(shop.id)}>
                <strong>★★★★★ {shop.name}</strong>
                <small>{shop.district} · {formatDistance(distance)} · 거래 {120 + Number(shop.id.replace(/\D/g, "").slice(-2) || 7)}건</small>
                <span>가능 브랜드: {shop.brands.slice(0, 3).join(", ")}</span>
                <span>가능 작업: {shop.works.slice(0, 3).join(", ")}</span>
                <em>정확한 주소는 거래방 생성 후 공개 · 평균 응답 {shop.responseTime}</em>
              </button>
            ))}
          </div>
          <div className="selected-request-shop">
            <span>선택된 등록 시공점</span>
            <b>{selectedShop.name}</b>
            <small>{selectedShop.district} · {selectedDistance} · ★★★★★</small>
            <p>거래방 생성 전에는 동 단위 지역만 표시됩니다. 요청 후 거래방에서 정확한 주소와 일정이 공개됩니다.</p>
          </div>
        </aside>
      </div>
    </section>
  );
}

function RequestSummary({ request, selectedShop, selectedDistance, onBack, onSend }: { request: ServiceRequest; selectedShop: InstallerShop; selectedDistance: string; onBack: () => void; onSend: () => void }) {
  return (
    <section className="summary-screen simple-summary-screen">
      <p className="eyebrow">CONFIRM</p>
      <h1>요청 내용을 확인해주세요</h1>
      <div className="summary-box">
        <article>
          <h3>차량모델</h3>
          <b>{request.model}</b>
        </article>
        <article>
          <h3>차량 등급</h3>
          <b>{request.vehicleClass || "시공점 확인"}</b>
        </article>
        <article>
          <h3>시공지역</h3>
          <b>{request.deliveryArea}</b>
        </article>
        <article>
          <h3>선택 브랜드</h3>
          <b>{request.selectedPackageBrand ?? request.preferredBrand}</b>
        </article>
        <article>
          <h3>선택 상품</h3>
          <b>{request.selectedPackageName ?? "직접 입력 요청"}</b>
        </article>
        <article>
          <h3>작업내용</h3>
          <b>{request.works.join(", ")}</b>
        </article>
        <article>
          <h3>추가 작업 문의</h3>
          <b>{request.extraWorkNote || "없음"}</b>
        </article>
        <article>
          <h3>요청 유형</h3>
          <b>{request.requestType}</b>
        </article>
        <article>
          <h3>입고예정일</h3>
          <b>{request.inboundStart}</b>
        </article>
        <article>
          <h3>연결 시공점</h3>
          <b>{selectedShop.name}</b>
          <p>{selectedShop.district} · {selectedDistance}</p>
        </article>
        <article>
          <h3>예상 금액</h3>
          <b>{request.expectedPrice ?? "가격 입력 예정"}</b>
          <p>표기 금액은 기본 패키지 기준이며 최종 금액은 시공점 확인 후 달라질 수 있습니다.</p>
        </article>
      </div>
      <div className="summary-actions">
        <button className="secondary" onClick={onBack}>수정하기</button>
        <button className="primary" onClick={onSend}>{request.requestType} 보내기</button>
      </div>
    </section>
  );
}

function DealsScreen({
  deals,
  allDeals,
  selectedDeal,
  filter,
  setFilter,
  onOpenDeal,
  onOpenChat,
  requestSuccess,
  clearRequestSuccess,
}: {
  deals: DealerDeal[];
  allDeals: DealerDeal[];
  selectedDeal: DealerDeal;
  filter: DealStatus | "전체";
  setFilter: (filter: DealStatus | "전체") => void;
  onOpenDeal: (dealId: string) => void;
  onOpenChat: (dealId: string) => void;
  requestSuccess: DealerDeal | null;
  clearRequestSuccess: () => void;
}) {
  return (
    <section className="deals-screen">
      <div className="page-title">
        <div>
          <p className="eyebrow">ACTIVE DEALS</p>
          <h1>거래 관리</h1>
          <p>여러 차량의 시공 요청, 일정, 입고 상태와 최근 메시지를 함께 관리합니다.</p>
        </div>
      </div>
      {requestSuccess && (
        <div className="success-banner">
          <span>요청 전송 완료</span>
          <b>{requestSuccess.id}</b>
          <p>상태가 시공점 확인중으로 설정되었고 진행중 거래 목록에 추가되었습니다. 시공점 확인 전까지 채팅은 비활성화됩니다.</p>
          <button onClick={clearRequestSuccess}>닫기</button>
        </div>
      )}
      <div className="deal-filters">
        {([
          { label: "현재 진행", value: "전체" as const, count: allDeals.filter((deal) => deal.status !== "작업완료").length },
          { label: "완료", value: "작업완료" as const, count: allDeals.filter((deal) => deal.status === "작업완료").length },
          { label: "취소", value: "취소" as const, count: allDeals.filter((deal) => deal.status === "취소").length },
        ]).map((tab) => (
          <button key={tab.label} className={filter === tab.value ? "active" : ""} onClick={() => setFilter(tab.value)}>
            {tab.label}
            <small>{tab.count}</small>
          </button>
        ))}
      </div>
      <div className="deals-layout">
        <section className="deal-list talk-style-list">
          {deals.map((deal) => (
            <button key={deal.id} className={`deal-row-card ${deal.id === selectedDeal.id ? "selected" : ""}`} onClick={() => onOpenDeal(deal.id)}>
              <span>
                <b>{deal.model}</b>
                <em>{deal.requestType ?? "실제 시공 요청"} · {deal.packageName}</em>
                <i>{deal.region} · {deal.expectedPrice ?? "가격 입력 예정"}</i>
              </span>
              <span>
                <StatusBadge status={deal.status} />
                <small>{deal.updatedAt}</small>
              </span>
            </button>
          ))}
          {deals.length === 0 && <div className="empty-state">선택한 상태의 거래가 없습니다.</div>}
        </section>
        <DealDetail deal={selectedDeal} actionLabel="거래 채팅으로 이동" onAction={() => onOpenChat(selectedDeal.id)} />
      </div>
    </section>
  );
}

function DealDetail({ deal, actionLabel, onAction }: { deal: DealerDeal; actionLabel: string; onAction: () => void }) {
  const activeStep = Math.max(0, dealStatuses.indexOf(deal.status));

  return (
    <aside className="deal-detail">
      <div className="deal-detail-head">
        <span>{deal.id}</span>
        <StatusBadge status={deal.status} />
      </div>
      <h2>{deal.maker} {deal.model}</h2>
      <p>{deal.shopName} · {deal.region}</p>
      <ProgressSteps activeStep={activeStep} steps={dealStatuses} />
      <WorkBriefingCard
        vehicle={deal.model}
        work={deal.packageName}
        extraWork={deal.extraWorkNote || "없음"}
        inboundAt={deal.inboundAt ?? "-"}
        stage={deal.stage ?? "접수"}
        requestType={deal.requestType ?? "실제 시공 요청"}
      />
      <dl>
        <div><dt>시공점</dt><dd>{deal.shopName}</dd></div>
        <div><dt>주소</dt><dd>{deal.shopAddress}</dd></div>
        <div><dt>상품</dt><dd>{deal.packageName}</dd></div>
        <div><dt>요청 유형</dt><dd>{deal.requestType ?? "실제 시공 요청"}</dd></div>
        <div><dt>차량 등급</dt><dd>{deal.vehicleClass || "시공점 확인"}</dd></div>
        <div><dt>예상 금액</dt><dd>{deal.expectedPrice ?? "가격 입력 예정"}</dd></div>
        <div><dt>요청 작업</dt><dd>{deal.works.join(", ")}</dd></div>
        <div><dt>추가 작업 문의</dt><dd>{deal.extraWorkNote || "없음"}</dd></div>
        <div><dt>입고 예정</dt><dd>{deal.inboundAt ?? "-"}</dd></div>
        <div><dt>출고 예정</dt><dd>{deal.outboundAt ?? deal.completedAt ?? "-"}</dd></div>
        <div><dt>최근 메시지</dt><dd>{deal.lastMessage}</dd></div>
      </dl>
      <button className="primary full" onClick={onAction}>{actionLabel}</button>
    </aside>
  );
}

function WorkBriefingCard({
  vehicle,
  work,
  extraWork,
  inboundAt,
  stage,
  requestType,
}: {
  vehicle: string;
  work: string;
  extraWork: string;
  inboundAt: string;
  stage: DealStage;
  requestType: RequestType;
}) {
  return (
    <section className="work-briefing-card">
      <div>
        <span>자동 작업 브리핑</span>
        <b>작업 브리핑</b>
      </div>
      <dl>
        <div><dt>유형</dt><dd>{requestType}</dd></div>
        <div><dt>차량</dt><dd>{vehicle}</dd></div>
        <div><dt>작업</dt><dd>{work}</dd></div>
        <div><dt>추가 작업</dt><dd>{extraWork || "없음"}</dd></div>
        <div><dt>입고 예정일</dt><dd>{inboundAt}</dd></div>
        <div><dt>진행상태</dt><dd>{stage}</dd></div>
      </dl>
    </section>
  );
}

function DealStageControls({ stage, onChange }: { stage: DealStage; onChange: (stage: DealStage) => void }) {
  return (
    <div className="deal-stage-controls" aria-label="거래 진행상태">
      {dealStages.map((item) => (
        <button key={item} className={stage === item ? "active" : ""} onClick={() => onChange(item)}>
          {item}
        </button>
      ))}
    </div>
  );
}

function ShopRequests({ request, selectedShop, status, onAccept, onReject, onOpenChat, onComplete }: { request: ServiceRequest; selectedShop: InstallerShop; status: RequestStatus; onAccept: () => void; onReject: () => void; onOpenChat: () => void; onComplete: () => void }) {
  const hasRequest = status !== "draft";

  return (
    <section className="shop-request-screen">
      <div className="page-title">
        <div>
          <p className="eyebrow">SHOP REQUESTS</p>
          <h1>새 문의 · 진행중 · 완료</h1>
          <p>미사 스타힐스 시공점 계정으로 들어온 딜러 문의와 시공 요청을 한 화면에서 처리합니다.</p>
        </div>
      </div>
      <div className="shop-status-tabs">
        <button className="active">새 문의 <b>{hasRequest && status === "sent" ? 1 : 0}</b></button>
        <button>진행중 <b>{hasRequest && status !== "sent" ? 1 : 0}</b></button>
        <button>완료 <b>4</b></button>
      </div>
      {!hasRequest ? (
        <div className="empty-state large">새 요청 목록이 비어 있습니다. 딜러 화면에서 먼저 시공 요청을 보내세요.</div>
      ) : (
        <article className="request-review">
          <div>
            <span className="status-chip">{status === "sent" ? "새 요청" : "수락 완료"}</span>
            <h2>{request.requestType} · {request.maker} {request.model}</h2>
            <p>{request.deliveryArea} · {request.preferredBrand} · {request.works.join(", ")}</p>
            <small>예상 입고 {request.inboundStart} ~ {request.inboundEnd}</small>
            <WorkBriefingCard
              vehicle={request.model}
              work={request.selectedPackageName ?? request.works[0] ?? request.preferredBrand}
              extraWork={request.extraWorkNote || "없음"}
              inboundAt={request.inboundStart}
              stage={status === "accepted" || status === "scheduleAgreed" ? "입고" : "접수"}
              requestType={request.requestType}
            />
            <dl className="shop-request-info">
              <div><dt>차량모델</dt><dd>{request.model}</dd></div>
              <div><dt>차량 등급</dt><dd>{request.vehicleClass || "시공점 확인"}</dd></div>
              <div><dt>시공지역</dt><dd>{request.deliveryArea}</dd></div>
              <div><dt>브랜드</dt><dd>{request.selectedPackageBrand ?? request.preferredBrand}</dd></div>
              <div><dt>상품명</dt><dd>{request.selectedPackageName ?? "직접 입력 요청"}</dd></div>
              <div><dt>작업내용</dt><dd>{request.works.join(", ")}</dd></div>
              <div><dt>추가 작업 문의</dt><dd>{request.extraWorkNote || "없음"}</dd></div>
              <div><dt>입고예정일</dt><dd>{request.inboundStart}</dd></div>
              <div><dt>예상 금액</dt><dd>{request.expectedPrice ?? "가격 입력 예정"}</dd></div>
            </dl>
          </div>
          <aside>
            <b>{selectedShop.name}</b>
            <span>{selectedShop.address}</span>
            {status === "sent" ? (
              <>
                <label>거절 사유<select><option>일정 불가</option><option>취급 브랜드 불가</option><option>작업 범위 확인 필요</option></select></label>
                <div className="card-actions">
                  <button className="secondary" onClick={onReject}>요청 거절</button>
                  <button className="primary" onClick={onAccept}>수락하고 일정 제안</button>
                </div>
              </>
            ) : (
              <div className="card-actions">
                <button className="secondary" onClick={onComplete}>작업완료 처리</button>
                <button className="primary" onClick={onOpenChat}>거래 채팅 열기</button>
              </div>
            )}
          </aside>
        </article>
      )}
    </section>
  );
}

function DealerChatScreen({
  deals,
  selectedDeal,
  selectedDealId,
  onSelectDeal,
  draft,
  setDraft,
  sendMessage,
  onAgree,
  onStageChange,
  onOpenDetail,
}: {
  deals: DealerDeal[];
  selectedDeal: DealerDeal;
  selectedDealId: string;
  onSelectDeal: (dealId: string) => void;
  draft: string;
  setDraft: (value: string) => void;
  sendMessage: () => void;
  onAgree: () => void;
  onStageChange: (stage: DealStage) => void;
  onOpenDetail: (dealId: string) => void;
}) {
  const chatEnabled = selectedDeal.status !== "시공점 확인중";

  return (
    <section className="chat-screen dealer-chat-screen">
      <div className="page-title">
        <div>
          <p className="eyebrow">TRANSACTION CHAT</p>
          <h1>거래 채팅</h1>
          <p>거래별 채팅방을 전환하며 시공점과 일정과 작업 상태를 조율합니다.</p>
        </div>
      </div>
      <div className="dealer-chat-layout">
        <aside className="chat-thread-list">
          {deals.map((deal) => (
            <button key={deal.id} className={deal.id === selectedDealId ? "selected" : ""} onClick={() => onSelectDeal(deal.id)}>
              <span>
                <b>{deal.maker} {deal.model}</b>
                <small>{deal.shopName}</small>
              </span>
              <StatusBadge status={deal.status} />
              <em>{deal.lastMessage}</em>
              <i>{deal.updatedAt}</i>
              {deal.unread > 0 && <strong>{deal.unread}</strong>}
            </button>
          ))}
        </aside>

        <section className="chat-panel">
          <div className="fixed-deal-summary">
            <div>
              <b>{selectedDeal.model}</b>
              <span>{selectedDeal.packageName}</span>
              <span>{selectedDeal.vehicleClass || "등급 확인"}</span>
              <span>{selectedDeal.expectedPrice ?? "가격 입력 예정"}</span>
              <span>{selectedDeal.region}</span>
              <span>입고예정일 {selectedDeal.inboundAt ?? "-"}</span>
            </div>
            <StatusBadge status={selectedDeal.status} />
          </div>
          <WorkBriefingCard
            vehicle={selectedDeal.model}
            work={selectedDeal.packageName}
            extraWork={selectedDeal.extraWorkNote || "없음"}
            inboundAt={selectedDeal.inboundAt ?? "-"}
            stage={selectedDeal.stage ?? "접수"}
            requestType={selectedDeal.requestType ?? "실제 시공 요청"}
          />
          <DealStageControls stage={selectedDeal.stage ?? "접수"} onChange={onStageChange} />
          <div className="message-list">
            {selectedDeal.messages.map((message) => (
              <div key={message.id} className={`message ${message.sender === "dealer" ? "mine" : message.sender}`}>
                <small>{message.sender === "dealer" ? "딜러" : message.sender === "shop" ? "시공점" : "시스템"} · {message.time}</small>
                <p>{message.text}</p>
              </div>
            ))}
            {chatEnabled && selectedDeal.status !== "작업완료" && (
              <div className="schedule-card">
                <span>시공점 일정 제안</span>
                <b>입고일: {selectedDeal.inboundAt ?? sampleScheduleProposal.inboundAt}</b>
                <b>출고일: {selectedDeal.outboundAt ?? sampleScheduleProposal.outboundAt}</b>
                <p>{selectedDeal.shopName}에서 현재 거래 일정 기준으로 제안한 샘플 일정입니다.</p>
                {selectedDeal.status !== "진행중" && <button className="primary" onClick={onAgree}>일정 동의</button>}
                {selectedDeal.status === "진행중" && <em>딜러 일정 동의 완료</em>}
              </div>
            )}
          </div>
          <div className="chat-input">
            <input disabled={!chatEnabled} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => event.key === "Enter" && sendMessage()} placeholder={chatEnabled ? "메시지를 입력하세요" : "시공점 확인 후 채팅이 가능합니다"} />
            <button disabled={!chatEnabled} onClick={sendMessage}>전송</button>
          </div>
        </section>

        <DealDetail deal={selectedDeal} actionLabel="거래 상세 보기" onAction={() => onOpenDetail(selectedDeal.id)} />
      </div>
    </section>
  );
}

function ChatScreen({
  role,
  request,
  selectedShop,
  status,
  messages,
  messageDraft,
  setMessageDraft,
  sendMessage,
  onAgree,
}: {
  role: Role;
  request: ServiceRequest;
  selectedShop: InstallerShop;
  status: RequestStatus;
  messages: ChatMessage[];
  messageDraft: string;
  setMessageDraft: (value: string) => void;
  sendMessage: () => void;
  onAgree: () => void;
}) {
  const activeStep = status === "accepted" || status === "scheduleAgreed" ? 1 : 0;
  const chatEnabled = status === "accepted" || status === "scheduleAgreed";

  return (
    <section className="chat-screen">
      <div className="page-title">
        <div>
          <p className="eyebrow">TRANSACTION CHAT</p>
          <h1>거래 전용 채팅</h1>
          <p>시공점 수락 이후에만 활성화되는 샘플 채팅 UI입니다.</p>
        </div>
      </div>
      <ProgressSteps activeStep={activeStep} />
      <div className="chat-layout">
        <section className="chat-panel">
          <div className="chat-header">
            <b>CM-260713-001</b>
            <span>{chatEnabled ? "채팅 활성화" : "수락 전 채팅 비활성화"}</span>
          </div>
          <WorkBriefingCard
            vehicle={request.model}
            work={request.selectedPackageName ?? request.works[0] ?? request.preferredBrand}
            extraWork={request.extraWorkNote || "없음"}
            inboundAt={request.inboundStart}
            stage={status === "scheduleAgreed" ? "시공중" : status === "accepted" ? "입고" : "접수"}
            requestType={request.requestType}
          />
          <div className="message-list">
            {messages.map((message) => (
              <div key={message.id} className={`message ${message.sender === "dealer" ? "mine" : message.sender}`}>
                <small>{message.sender === "dealer" ? "딜러" : message.sender === "shop" ? "시공점" : "시스템"} · {message.time}</small>
                <p>{message.text}</p>
              </div>
            ))}
            {chatEnabled && (
              <div className="schedule-card">
                <span>시공점 일정 제안</span>
                <b>입고일: {sampleScheduleProposal.inboundAt}</b>
                <b>출고일: {sampleScheduleProposal.outboundAt}</b>
                <p>{sampleScheduleProposal.memo}</p>
                {role === "dealer" && status !== "scheduleAgreed" && <button className="primary" onClick={onAgree}>일정 동의</button>}
                {status === "scheduleAgreed" && <em>딜러 일정 동의 완료</em>}
              </div>
            )}
          </div>
          <div className="chat-input">
            <input disabled={!chatEnabled} value={messageDraft} onChange={(event) => setMessageDraft(event.target.value)} onKeyDown={(event) => event.key === "Enter" && sendMessage()} placeholder={chatEnabled ? "메시지를 입력하세요" : "시공점 수락 후 채팅이 가능합니다"} />
            <button disabled={!chatEnabled} onClick={sendMessage}>전송</button>
          </div>
        </section>
        <aside className="deal-summary">
          <h3>거래 요약</h3>
          <dl>
            <div><dt>차량</dt><dd>{request.maker} {request.model}</dd></div>
            <div><dt>차량 등급</dt><dd>{request.vehicleClass || "시공점 확인"}</dd></div>
            <div><dt>지역</dt><dd>{request.deliveryArea}</dd></div>
            <div><dt>시공점</dt><dd>{selectedShop.name}</dd></div>
            <div><dt>상품</dt><dd>{request.selectedPackageName ?? request.preferredBrand}</dd></div>
            <div><dt>예상 금액</dt><dd>{request.expectedPrice ?? "가격 입력 예정"}</dd></div>
            <div><dt>요청 작업</dt><dd>{request.works.join(", ")}</dd></div>
            <div><dt>거래 상태</dt><dd>{transactionSteps[activeStep]}</dd></div>
          </dl>
        </aside>
      </div>
    </section>
  );
}

function ProgressSteps({ activeStep, steps = transactionSteps }: { activeStep: number; steps?: readonly string[] }) {
  return (
    <div className="progress-steps">
      {steps.map((step, index) => (
        <div key={step} className={index < activeStep ? "done" : index === activeStep ? "current" : ""}>
          <i>{index < activeStep ? "✓" : index + 1}</i>
          <span>{step}</span>
        </div>
      ))}
    </div>
  );
}

function DealerSettlementScreen({ deals }: { deals: DealerDeal[] }) {
  const payments = [
    { id: "CM-260713-001", vehicle: "제네시스 GV80", shop: "미사 스타힐스 시공점", amount: 850000, fee: 25500, status: "결제 완료", date: "2026.07.12" },
    { id: "CM-260713-003", vehicle: "기아 카니발", shop: "후퍼옵틱 강남점", amount: 1200000, fee: 36000, status: "결제 완료", date: "2026.07.10" },
    { id: "CM-260713-007", vehicle: "현대 아이오닉 9", shop: "버텍스 송도점", amount: 1200000, fee: 36000, status: "결제 대기", date: "-" },
    { id: "CM-260713-010", vehicle: "기아 쏘렌토", shop: "브이쿨 수원점", amount: 980000, fee: 29400, status: "결제 완료", date: "2026.07.08" },
    { id: "CM-260713-005", vehicle: "현대 싼타페", shop: "레이노 분당점", amount: 770000, fee: 23100, status: "결제 완료", date: "2026.07.05" },
  ];
  const summary = [
    { label: "이번 달 전체 거래 금액", value: "6,800,000원", note: `${deals.length}건의 거래`, tone: "blue" },
    { label: "결제 대기", value: "1,200,000원", note: "결제 예정 1건", tone: "amber" },
    { label: "결제 완료", value: "5,600,000원", note: "결제 완료 9건", tone: "green" },
    { label: "플랫폼 이용 수수료", value: "168,000원", note: "테스트 요율 3%", tone: "navy" },
  ];

  return (
    <section className="dealer-content-screen settlement-screen">
      <div className="page-title dealer-page-title"><div><p className="eyebrow">PAYMENT & SETTLEMENT</p><h1>결제 및 정산</h1><p>거래별 결제 상태와 이번 달 금액을 확인하세요. 현재 화면은 고정된 샘플 데이터입니다.</p></div></div>
      <div className="settlement-summary">
        {summary.map((item) => <article key={item.label} className={item.tone}><span>{item.label}</span><b>{item.value}</b><small>{item.note}</small></article>)}
      </div>
      <section className="dealer-panel payment-list-panel">
        <div className="section-head"><div><h2>최근 결제 내역</h2><p>거래 금액과 샘플 수수료를 함께 표시합니다.</p></div><select aria-label="결제 상태"><option>전체 상태</option><option>결제 대기</option><option>결제 완료</option></select></div>
        <div className="payment-table" role="table">
          <div className="payment-row payment-head" role="row"><span>거래번호</span><span>차량 / 시공점</span><span>거래 금액</span><span>이용 수수료</span><span>결제일</span><span>상태</span></div>
          {payments.map((payment) => (
            <div className="payment-row" role="row" key={payment.id}>
              <b>{payment.id}</b><span><strong>{payment.vehicle}</strong><small>{payment.shop}</small></span><b>{formatWon(payment.amount)}</b><span>{formatWon(payment.fee)}</span><span>{payment.date}</span><em className={payment.status === "결제 완료" ? "paid" : "pending"}>{payment.status}</em>
            </div>
          ))}
        </div>
      </section>
      <p className="sample-disclaimer">실제 PG 결제·송금 기능은 연결되지 않았으며 시연용 금액만 표시합니다.</p>
    </section>
  );
}

function DealerProfileScreen({ onLogout }: { onLogout: () => void }) {
  const [notifications, setNotifications] = useState({ request: true, chat: true, schedule: true, marketing: false });
  const [saved, setSaved] = useState(false);
  const toggle = (key: keyof typeof notifications) => setNotifications((current) => ({ ...current, [key]: !current[key] }));

  return (
    <section className="dealer-content-screen profile-screen">
      <div className="page-title dealer-page-title"><div><p className="eyebrow">MY PAGE</p><h1>마이페이지</h1><p>딜러 정보와 소속, 업무 알림 설정을 관리하세요.</p></div></div>
      {saved && <div className="profile-saved">변경한 프로필 정보를 샘플 상태로 저장했습니다.</div>}
      <div className="profile-layout">
        <div className="profile-main">
          <section className="dealer-panel profile-card">
            <div className="profile-card-title"><h2>기본 정보</h2><span>딜러 계정</span></div>
            <div className="profile-form">
              <label>이름<input defaultValue="한재진" /></label>
              <label>연락처<input defaultValue="010-1234-5678" /></label>
              <label>이메일<input type="email" defaultValue="dealer@car-master.kr" /></label>
              <label>소속 에이전시<input defaultValue="한재진딜러" /></label>
              <label className="wide">사업자 또는 소속 정보<input defaultValue="리스·렌트 차량관리 사업부 / 서울 강남구" /></label>
            </div>
            <div className="profile-save"><button className="primary" onClick={() => setSaved(true)}>변경사항 저장</button></div>
          </section>
          <section className="dealer-panel password-card">
            <div><h2>비밀번호 변경</h2><p>안전한 계정 관리를 위해 정기적으로 변경해주세요.</p></div>
            <button className="secondary" onClick={() => alert("비밀번호 변경 샘플 화면입니다.")}>비밀번호 변경</button>
          </section>
        </div>
        <aside className="profile-side">
          <section className="dealer-panel profile-summary-card">
            <div className="dealer-avatar large">한</div><h2>한재진 딜러</h2><p>한재진딜러</p><span>딜러 권한</span><dl><div><dt>최근 로그인</dt><dd>오늘 09:04</dd></div><div><dt>진행 중 거래</dt><dd>9건</dd></div></dl>
          </section>
          <section className="dealer-panel notification-card">
            <h2>알림 수신 설정</h2>
            {([
              ["request", "시공 요청 응답", "시공점 수락·거절 알림"],
              ["chat", "거래 채팅", "새 메시지 알림"],
              ["schedule", "일정 및 상태", "입고·출고 상태 알림"],
              ["marketing", "서비스 소식", "패키지 및 이벤트 안내"],
            ] as [keyof typeof notifications, string, string][]).map(([key, label, description]) => (
              <button key={key} onClick={() => toggle(key)}><span><b>{label}</b><small>{description}</small></span><i className={notifications[key] ? "on" : ""}><em></em></i></button>
            ))}
          </section>
          <button className="profile-logout" onClick={onLogout}><DealerIcon name="logout" />로그아웃</button>
        </aside>
      </div>
    </section>
  );
}

function OperationsScreen({ fee }: { fee: ReturnType<typeof calculateSettlement> }) {
  const adminStats = [
    { label: "전체 거래 수", value: "128건", note: "샘플 누적 거래" },
    { label: "회원 수", value: "42명", note: "딜러·시공점·관리자" },
    { label: "등록 시공점 수", value: "100곳", note: "카마스터 승인 샘플" },
    { label: "오늘 거래", value: "12건", note: "접수·진행 포함" },
  ];

  return (
    <section className="ops-screen">
      <div className="page-title">
        <div>
          <p className="eyebrow">ADMIN OVERVIEW</p>
          <h1>관리자 전체 현황</h1>
          <p>복잡한 운영 기능은 제외하고 오늘 서비스 상태를 한눈에 확인합니다.</p>
        </div>
      </div>
      <div className="ops-grid admin-overview-grid">
        {adminStats.map((item) => (
          <article key={item.label}><span>{item.label}</span><b>{item.value}</b><p>{item.note}</p></article>
        ))}
      </div>
      <p className="sample-disclaimer">실제 결제, 정산, 회원 인증, DB 저장은 이번 버전 제외 범위입니다. 참고 계산값: 샘플 거래 {formatWon(fee.gross)} / 순액 {formatWon(fee.net)}</p>
      <section className="admin-price-panel">
        <div className="section-head">
          <div>
            <h2>금액표 관리 샘플</h2>
            <p>실제 DB 저장 없이 샘플 데이터 기준으로 상품과 차량 등급별 금액을 확인합니다.</p>
          </div>
        </div>
        <div className="admin-price-table">
          <div className="admin-price-row head">
            <span>브랜드</span>
            <span>상품명</span>
            <span>중형</span>
            <span>대형</span>
            <span>특대형</span>
            <span>상태</span>
            <span>관리</span>
          </div>
          {pricePackages.map((item) => (
            <div className="admin-price-row" key={item.id}>
              <span>{item.brand}</span>
              <b>{item.name}</b>
              <span>{item.prices["중형"]}</span>
              <span>{item.prices["대형"]}</span>
              <span>{item.prices["특대형"]}</span>
              <span>{item.available ? "판매중" : "중지"}</span>
              <button>수정</button>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}
