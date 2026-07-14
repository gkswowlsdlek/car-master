"use client";

import { useEffect, useMemo, useState } from "react";
import { initialChatMessages, sampleScheduleProposal, type ChatMessage } from "../lib/chat-data";
import {
  brands,
  distanceKm,
  findSearchLocation,
  formatDistance,
  installerShops,
  regionLabels,
  searchLocations,
  workTypes,
  type Brand,
  type InstallerShop,
  type SearchLocation,
  type WorkType,
} from "../lib/dealer-flow-data";
import { calculateSettlement, formatWon } from "../lib/fees";

type Role = "dealer" | "shop" | "admin";
type Screen = "landing" | "login" | "dealerDashboard" | "dealerMap" | "request" | "requestSummary" | "deals" | "dealerSettlement" | "dealerProfile" | "shopRequests" | "chat" | "ops";
type RequestStatus = "draft" | "sent" | "accepted" | "scheduleAgreed";
type MobileMapTab = "map" | "list";
type DealStatus = "답변 대기" | "일정 협의" | "예약 확정" | "결제 대기" | "입고 예정" | "입고 완료" | "시공 중" | "시공 완료";
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
  works: WorkType[];
  inboundStart: string;
  inboundEnd: string;
  memo: string;
};

type DealerDeal = {
  id: string;
  maker: string;
  model: string;
  shopName: string;
  shopAddress: string;
  region: string;
  works: WorkType[];
  status: DealStatus;
  inboundAt?: string;
  outboundAt?: string;
  completedAt?: string;
  lastMessage: string;
  updatedAt: string;
  unread: number;
  messages: ChatMessage[];
};

type DealerIconName = "dashboard" | "shop" | "request" | "chat" | "deals" | "settlement" | "profile" | "logout" | "bell" | "arrow" | "card";

function DealerIcon({ name }: { name: DealerIconName }) {
  const paths: Record<DealerIconName, React.ReactNode> = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
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
  "시공 요청 전송",
  "시공점 확인",
  "일정 협의",
  "예약 확정",
  "결제 대기",
  "입고 예정",
  "입고 완료",
  "시공 중",
  "시공 완료",
];

const dealStatuses: DealStatus[] = ["답변 대기", "일정 협의", "예약 확정", "결제 대기", "입고 예정", "입고 완료", "시공 중", "시공 완료"];

const statusTone: Record<DealStatus, string> = {
  "답변 대기": "waiting",
  "일정 협의": "negotiating",
  "예약 확정": "confirmed",
  "결제 대기": "payment",
  "입고 예정": "inbound",
  "입고 완료": "arrived",
  "시공 중": "working",
  "시공 완료": "done",
};

const dashboardMetrics: { label: string; value: string; filter: DealStatus | "전체" }[] = [
  { label: "신규 요청", value: "3건", filter: "답변 대기" },
  { label: "답변 대기", value: "2건", filter: "답변 대기" },
  { label: "예약 확정", value: "4건", filter: "예약 확정" },
  { label: "입고 예정", value: "3건", filter: "입고 예정" },
  { label: "시공 중", value: "2건", filter: "시공 중" },
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
    status: "예약 확정",
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
    status: "답변 대기",
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
    status: "시공 중",
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
    status: "입고 예정",
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
    status: "시공 완료",
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
    status: "일정 협의",
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
    status: "결제 대기",
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
    status: "입고 완료",
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
    status: "답변 대기",
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
    status: "예약 확정",
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
  const [brandFilter, setBrandFilter] = useState<Brand | "전체">("전체");
  const [workFilter, setWorkFilter] = useState<WorkType | "전체">("전체");
  const [onlyAvailable, setOnlyAvailable] = useState(true);
  const [onlyApproved, setOnlyApproved] = useState(true);
  const [request, setRequest] = useState<ServiceRequest>(defaultRequest);
  const [requestStatus, setRequestStatus] = useState<RequestStatus>("draft");
  const [messages, setMessages] = useState<ChatMessage[]>(initialChatMessages);
  const [messageDraft, setMessageDraft] = useState("");
  const [dealerDeals, setDealerDeals] = useState<DealerDeal[]>(initialDealerDeals);
  const [selectedDealId, setSelectedDealId] = useState(initialDealerDeals[0].id);
  const [dealFilter, setDealFilter] = useState<DealStatus | "전체">("전체");
  const [dealerChatDraft, setDealerChatDraft] = useState("");
  const [favoriteShopIds, setFavoriteShopIds] = useState<string[]>(["SHOP-MISA-001", "SHOP-BS-001"]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState<DealerDeal | null>(null);
  const [conversationLoaded, setConversationLoaded] = useState(false);
  const [hasStoredConversation, setHasStoredConversation] = useState(false);

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
  const filteredDealerDeals = dealFilter === "전체" ? dealerDeals : dealerDeals.filter((deal) => deal.status === dealFilter);
  const selectedDeal = dealerDeals.find((deal) => deal.id === selectedDealId) ?? requestSuccess ?? dealerDeals[0];
  const activeDealerDealsCount = dealerDeals.filter((deal) => deal.status !== "시공 완료").length;
  const unreadDealerMessages = dealerDeals.reduce((sum, deal) => sum + deal.unread, 0);
  const fee = calculateSettlement(600000, 3, 2.9);

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
    setConversationLoaded(true);

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
    setHasStoredConversation(true);
  }, [conversationLoaded, hasStoredConversation, messages, request, requestStatus, selectedShopId]);

  useEffect(() => {
    if (!visibleShops.some(({ shop }) => shop.id === selectedShopId) && visibleShops[0]) {
      setSelectedShopId(visibleShops[0].shop.id);
    }
  }, [selectedShopId, visibleShops]);

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
      status: "답변 대기",
      inboundAt: request.inboundStart,
      outboundAt: request.inboundEnd,
      lastMessage: "시공 요청을 전송했습니다.",
      updatedAt: "지금",
      unread: 0,
      messages: [
        { id: `${dealNumber}-m1`, sender: "system", text: "시공 요청을 전송했습니다.", time: "지금" },
        { id: `${dealNumber}-m2`, sender: "dealer", text: request.memo || "시공 가능 여부 확인 부탁드립니다.", time: "지금" },
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
        text: "딜러가 시공 요청을 보냈습니다. 시공점이 수락하면 거래 전용 채팅이 활성화됩니다.",
        time: "지금",
      },
    ]);
    goToScreen("deals");
  };

  const acceptRequest = () => {
    setHasStoredConversation(true);
    setRequestStatus("accepted");
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
        text: "딜러가 일정에 동의했습니다. 거래 상태가 예약 확정 단계로 이동했습니다.",
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
              status: "예약 확정",
              lastMessage: "제안 일정에 동의했습니다.",
              updatedAt: "지금",
              messages: [
                ...deal.messages,
                { id: `${deal.id}-agree`, sender: "dealer", text: "제안 일정에 동의했습니다.", time: "지금" },
                { id: `${deal.id}-system-agree`, sender: "system", text: "거래 상태가 예약 확정으로 변경되었습니다.", time: "지금" },
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
      loginWithAccount(routeAccount, { replace: true });
      return;
    }

    if (pathname === "/login") {
      setScreen("login");
      return;
    }

    setScreen("landing");
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
          { id: "dealerMap", label: "전국 시공점 찾기", icon: "shop" },
          { id: "request", label: "시공 요청", icon: "request" },
          { id: "chat", label: "거래 채팅", icon: "chat" },
          { id: "deals", label: "진행 중 거래", icon: "deals" },
          { id: "dealerSettlement", label: "정산", icon: "settlement" },
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
          <span>CM</span>
          <strong>Car-Master</strong>
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
            onOpenChat={() => goToScreen("chat")}
            onSettlement={() => goToScreen("dealerSettlement")}
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
            brandFilter={brandFilter}
            setBrandFilter={setBrandFilter}
            workFilter={workFilter}
            setWorkFilter={setWorkFilter}
            onlyAvailable={onlyAvailable}
            setOnlyAvailable={setOnlyAvailable}
            onlyApproved={onlyApproved}
            setOnlyApproved={setOnlyApproved}
            favoriteShopIds={favoriteShopIds}
            showFavoritesOnly={showFavoritesOnly}
            setShowFavoritesOnly={setShowFavoritesOnly}
            toggleFavoriteShop={toggleFavoriteShop}
            onRequest={() => goToScreen("request")}
          />
        )}

        {screen === "request" && (
          <RequestScreen
            request={request}
            setRequest={setRequest}
            selectedShop={selectedShop}
            selectedDistance={selectedDistance}
            onSummary={() => goToScreen("requestSummary")}
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
          <ShopRequests request={request} selectedShop={selectedShop} status={requestStatus} onAccept={acceptRequest} onReject={() => setRequestStatus("draft")} onOpenChat={() => goToScreen("chat")} />
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
  return (
    <div className="landing-page">
      <header className="landing-header">
        <button className="landing-brand" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          <span>CM</span>
          <b>Car-Master</b>
        </button>
        <nav>
          <a href="#service">서비스 소개</a>
          <a href="#flow">이용 방법</a>
          <a href="#partners">파트너 시공점 안내</a>
        </nav>
        <div className="landing-actions">
          <button className="secondary" onClick={onLogin}>로그인</button>
          <button className="primary" onClick={onDealerStart}>딜러로 시작하기</button>
        </div>
      </header>

      <main>
        <section className="landing-hero">
          <div className="hero-copy">
            <p className="eyebrow">리스·렌트 딜러를 위한 전국 자동차 시공 네트워크</p>
            <h1>전국 어디서든,<br />고객과 가까운 시공점을<br />한 번에 찾으세요.</h1>
            <p className="hero-desc">
              고객 차량 인도 지역을 검색하면 가까운 승인 시공점과 취급 브랜드를 한눈에 확인하고,
              시공 요청부터 일정 조율까지 하나의 거래 흐름으로 관리할 수 있습니다.
            </p>
            <div className="hero-buttons">
              <button className="primary" onClick={onDealerStart}>고객 지역으로 시공점 찾기</button>
              <button className="secondary" onClick={onDealerStart}>파트너 시공점 등록</button>
            </div>
            <div className="trust-metrics" aria-label="서비스 신뢰 지표">
              <span><b>100+</b>승인 시공점</span>
              <span><b>7+</b>주요 썬팅 브랜드</span>
              <span><b>48h</b>요청 응답 기준</span>
            </div>
          </div>
          <LandingServicePreview />
        </section>

        <section className="feature-cards" id="service">
          <article>
            <span>01</span>
            <h2>지역 기반 시공점 검색</h2>
            <p>고객 차량 인도 지역을 기준으로 가까운 승인 시공점을 지도와 목록에서 빠르게 확인합니다.</p>
          </article>
          <article>
            <span>02</span>
            <h2>브랜드와 작업 가능 항목 확인</h2>
            <p>버텍스, 솔라가드, 후퍼옵틱, 브이쿨 등 취급 브랜드와 시공 가능 항목을 한눈에 비교합니다.</p>
          </article>
          <article>
            <span>03</span>
            <h2>요청부터 일정 조율까지</h2>
            <p>시공 요청을 보내고, 시공점 수락 후 거래 전용 채팅에서 입고·출고 일정을 조율합니다.</p>
          </article>
        </section>

        <section className="landing-flow" id="flow">
          <p className="eyebrow">HOW IT WORKS</p>
          <h2>딜러 업무 흐름에 맞춘 시공 요청 프로세스</h2>
          <div>
            {["지역 검색", "시공점 비교", "시공 요청", "수락 확인", "거래 채팅", "일정 확정"].map((item, index) => (
              <span key={item}><b>{index + 1}</b>{item}</span>
            ))}
          </div>
        </section>

        <section className="partner-strip" id="partners">
          <div>
            <p className="eyebrow">PARTNER NETWORK</p>
            <h2>카마스터 승인 시공점만 노출합니다.</h2>
            <p>딜러는 가까운 시공점을 빠르게 찾고, 시공점은 명확한 요청 정보로 응답합니다.</p>
          </div>
          <button className="primary" onClick={onDealerStart}>딜러로 시작하기</button>
        </section>
      </main>
    </div>
  );
}

function LandingServicePreview() {
  const heroShop = installerShops.find((shop) => shop.name === "루마버텍스 해운대점") ?? installerShops[0];

  return (
    <div className="hero-preview-panel">
      <div className="preview-toolbar">
        <span>딜러 요청 미리보기</span>
        <b>승인 시공점 연결</b>
      </div>
      <div className="preview-content">
        <article className="preview-request-card">
          <span className="status-chip">고객 차량 시공 지역</span>
          <h2>부산 해운대구 인도 예정</h2>
          <p>제네시스 GV80 · 신차패키지 · 신차검수 요청</p>
          <div>
            <b>희망 브랜드</b>
            <span>버텍스, 솔라가드, 브이쿨</span>
          </div>
        </article>

        <article className="landing-shop-card static">
          <span className="verified-badge">카마스터 승인 시공점</span>
          <h2>{heroShop.name}</h2>
          <p>부산 해운대구 · 고객 위치에서 1.2km</p>
          <dl>
            <div><dt>취급 브랜드</dt><dd>버텍스, 솔라가드, 브이쿨</dd></div>
            <div><dt>가능 작업</dt><dd>신차패키지, 신차검수, 생활보호 PPF</dd></div>
          </dl>
          <button className="secondary">상세보기</button>
        </article>

        <div className="preview-flow">
          {["지역 검색", "시공점 비교", "시공 요청", "수락 후 채팅", "입고·출고 일정 조율"].map((item, index) => (
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
          <span>CM</span>
          <strong>Car-Master</strong>
          <small>리스·렌트 딜러용 전국 시공 네트워크</small>
        </div>
        <h1>고객 차량 인도 지역만 입력하면 가까운 승인 시공점을 바로 찾습니다.</h1>
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
  brandFilter: Brand | "전체";
  setBrandFilter: (brand: Brand | "전체") => void;
  workFilter: WorkType | "전체";
  setWorkFilter: (work: WorkType | "전체") => void;
  onlyAvailable: boolean;
  setOnlyAvailable: (value: boolean) => void;
  onlyApproved: boolean;
  setOnlyApproved: (value: boolean) => void;
  favoriteShopIds: string[];
  showFavoritesOnly: boolean;
  setShowFavoritesOnly: (value: boolean) => void;
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
    brandFilter,
    setBrandFilter,
    workFilter,
    setWorkFilter,
    onlyAvailable,
    setOnlyAvailable,
    onlyApproved,
    setOnlyApproved,
    favoriteShopIds,
    showFavoritesOnly,
    setShowFavoritesOnly,
    toggleFavoriteShop,
    onRequest,
  } = props;

  return (
    <section className="dealer-screen">
      <div className="page-title">
        <div>
          <p className="eyebrow">DEALER FLOW</p>
          <h1>고객 차량 시공 지역을 검색하세요</h1>
          <p>검색 지역 주변의 카마스터 승인 시공점을 거리순 목록으로 확인하고 시공 요청을 보낼 수 있습니다.</p>
          <p>현재 시연 로그인 사용자는 한재진딜러 1명이며, 목록에는 아직 별도 로그인 계정이 없는 입점 시공점 100여 곳이 노출됩니다.</p>
        </div>
      </div>

      <div className="map-search">
        <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && searchArea()} aria-label="고객 차량 시공 지역 검색" />
        <button className="primary" onClick={() => searchArea()}>지역 검색</button>
        <div className="quick-searches">
          {["경기 하남시 미사", "서울 강남구", "부산 해운대구", "대구 수성구"].map((item) => (
            <button key={item} onClick={() => searchArea(item)}>{item}</button>
          ))}
        </div>
      </div>

      <div className="filters">
        <label>
          썬팅 브랜드
          <select value={brandFilter} onChange={(event) => setBrandFilter(event.target.value as Brand | "전체")}>
            <option>전체</option>
            {brands.map((brand) => <option key={brand}>{brand}</option>)}
          </select>
        </label>
        <label>
          가능 작업
          <select value={workFilter} onChange={(event) => setWorkFilter(event.target.value as WorkType | "전체")}>
            <option>전체</option>
            {workTypes.map((work) => <option key={work}>{work}</option>)}
          </select>
        </label>
        <label className="check-filter">
          <input type="checkbox" checked={onlyAvailable} onChange={(event) => setOnlyAvailable(event.target.checked)} />
          현재 요청 가능
        </label>
        <label className="check-filter">
          <input type="checkbox" checked={onlyApproved} onChange={(event) => setOnlyApproved(event.target.checked)} />
          승인 시공점
        </label>
        <label className="check-filter">
          <input type="checkbox" checked={showFavoritesOnly} onChange={(event) => setShowFavoritesOnly(event.target.checked)} />
          즐겨찾기만
        </label>
      </div>

      <div className="shop-finder-layout">
        <aside className="results-panel finder-results">
          <div className="results-head">
            <b>{location.label} 주변 승인 시공점</b>
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
                  <em>{shop.address}</em>
                  <i>{shop.brands.slice(0, 3).join(", ")}</i>
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
            isFavorite={favoriteShopIds.includes(selectedShop.id)}
            onToggleFavorite={() => toggleFavoriteShop(selectedShop.id)}
          />
        </div>
      </div>
    </section>
  );
}

function MapSurface({
  location,
  shops,
  selectedShopId,
  setSelectedShopId,
  mapMode,
  setMapMode,
}: {
  location: SearchLocation;
  shops: { shop: InstallerShop; distance: number }[];
  selectedShopId: string;
  setSelectedShopId: (id: string) => void;
  mapMode: "sample" | "naver";
  setMapMode: (value: "sample" | "naver") => void;
}) {
  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;
    if (!clientId) {
      setMapMode("sample");
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>("script[data-carmaster-naver]");
    if (existing) return;

    const script = document.createElement("script");
    script.dataset.carmasterNaver = "true";
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${clientId}`;
    script.onload = () => setMapMode("naver");
    script.onerror = () => setMapMode("sample");
    document.head.appendChild(script);
  }, [setMapMode]);

  const grouped = useMemo(() => {
    return Object.entries(
      installerShops.reduce<Record<string, number>>((acc, shop) => {
        acc[shop.region] = (acc[shop.region] ?? 0) + 1;
        return acc;
      }, {}),
    );
  }, []);

  return (
    <div className="sample-map" data-provider={mapMode}>
      <div className="korea-outline">
        <span>대한민국 전체 지도</span>
        <small>{mapMode === "naver" ? "API 로딩 완료 시 실제 지도 어댑터로 교체 가능한 구조입니다." : "환경변수가 없어 샘플 지도 UI로 표시 중입니다."}</small>
      </div>
      {grouped.map(([region, count], index) => (
        <div key={region} className={`cluster cluster-${region}`}>
          <b>{count}</b>
          <span>{regionLabels[region as keyof typeof regionLabels]}</span>
        </div>
      ))}
      <button className="customer-marker" style={projectToMap(location.lat, location.lng)} title="고객 위치">
        고객 위치
      </button>
      {shops.slice(0, 24).map(({ shop }) => (
        <button
          key={shop.id}
          className={`map-pin ${shop.id === selectedShopId ? "selected" : ""}`}
          style={projectToMap(shop.lat, shop.lng)}
          onClick={() => setSelectedShopId(shop.id)}
          title={shop.name}
        >
          {shop.name.slice(0, 1)}
        </button>
      ))}
    </div>
  );
}

function projectToMap(lat: number, lng: number) {
  const x = ((lng - 124.5) / (131.2 - 124.5)) * 100;
  const y = (1 - (lat - 33.0) / (38.7 - 33.0)) * 100;
  return {
    left: `${Math.min(92, Math.max(8, x))}%`,
    top: `${Math.min(88, Math.max(8, y))}%`,
  };
}

function ShopMapCard({
  shop,
  distance,
  onRequest,
  isFavorite,
  onToggleFavorite,
}: {
  shop: InstallerShop;
  distance: string;
  onRequest: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}) {
  return (
    <article className="map-card">
      <div className="map-card-head">
        <div>
          <span className="verified-badge">카마스터 승인 시공점</span>
          <h2>{shop.name}</h2>
          <p>{shop.address}</p>
        </div>
        <b>{distance}</b>
      </div>
      <dl>
        <div><dt>지역</dt><dd>{shop.district}</dd></div>
        <div><dt>취급 브랜드</dt><dd>{shop.brands.join(", ")}</dd></div>
        <div><dt>가능 작업</dt><dd>{shop.works.join(", ")}</dd></div>
        <div><dt>영업시간</dt><dd>{shop.hours}</dd></div>
        <div><dt>평균 응답</dt><dd>{shop.responseTime}</dd></div>
        <div><dt>요청 접수</dt><dd>{shop.available ? "가능" : "오늘 접수 마감"}</dd></div>
      </dl>
      <div className="card-actions">
        {onToggleFavorite && (
          <button className={`secondary star-action ${isFavorite ? "active" : ""}`} onClick={onToggleFavorite}>
            {isFavorite ? "★ 즐겨찾기" : "☆ 즐겨찾기"}
          </button>
        )}
        <button className="secondary">상세보기</button>
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
  onOpenChat,
  onSettlement,
}: {
  deals: DealerDeal[];
  onFilterDeals: (filter: DealStatus | "전체") => void;
  onOpenDeal: (dealId: string) => void;
  onNewRequest: () => void;
  onFindShop: () => void;
  onOpenChat: () => void;
  onSettlement: () => void;
}) {
  const quickActions: { label: string; description: string; icon: DealerIconName; action: () => void }[] = [
    { label: "새 시공 요청", description: "차량과 작업 입력", icon: "request", action: onNewRequest },
    { label: "전국 시공점 찾기", description: "승인 시공점 검색", icon: "shop", action: onFindShop },
    { label: "최근 채팅", description: "읽지 않은 대화 확인", icon: "chat", action: onOpenChat },
    { label: "진행 중 거래", description: "상태별 거래 관리", icon: "deals", action: () => onFilterDeals("전체") },
    { label: "정산 내역", description: "결제 현황 확인", icon: "settlement", action: onSettlement },
  ];

  return (
    <section className="dealer-dashboard">
      <div className="dealer-welcome">
        <div>
          <h1>안녕하세요, 한재진 딜러님.</h1>
          <p>오늘의 시공 요청과 진행 중인 거래를 확인하세요.</p>
        </div>
        <span>2026년 7월 14일 화요일</span>
      </div>

      <div className="metric-grid">
        {dashboardMetrics.map((metric) => (
          <button key={metric.label} className="metric-card" onClick={() => onFilterDeals(metric.filter)}>
            <span><i></i>{metric.label}</span>
            <b>{metric.value}</b><DealerIcon name="arrow" />
          </button>
        ))}
      </div>

      <section className="quick-action-section">
        <div className="dealer-section-title">
          <h2>빠른 실행</h2><span>자주 사용하는 업무를 바로 시작하세요.</span>
        </div>
        <div className="quick-action-grid">
          {quickActions.map((item) => (
            <button key={item.label} onClick={item.action}>
              <i><DealerIcon name={item.icon} /></i>
              <span><b>{item.label}</b><small>{item.description}</small></span>
              <DealerIcon name="arrow" />
            </button>
          ))}
        </div>
      </section>

      <div className="dealer-dashboard-columns">
        <div className="dealer-dashboard-main">
          <section className="package-banner">
            <div className="package-banner-copy">
              <span className="banner-kicker">CAR-MASTER STANDARD PACKAGE</span>
              <h2>전국 어디서든 동일한 흐름으로<br />신차패키지를 요청하세요.</h2>
              <p>검증된 승인 시공점과 표준화된 패키지로 고객 인도 준비를 더 간편하게.</p>
              <div className="brand-tags"><span>버텍스</span><span>솔라가드</span><span>후퍼옵틱</span><span>브이쿨</span></div>
              <div className="banner-actions">
                <button className="banner-secondary" onClick={onFindShop}>패키지 보기</button>
                <button className="banner-primary" onClick={onNewRequest}>시공 요청하기 <DealerIcon name="arrow" /></button>
              </div>
            </div>
            <div className="car-visual" aria-hidden="true">
              <span className="car-glow"></span>
              <svg viewBox="0 0 520 230" fill="none">
                <path d="M84 150c9-29 22-47 55-58l72-24c48-16 89-12 130 7l68 32c18 8 30 22 35 43" stroke="currentColor" strokeWidth="8" />
                <path d="M120 145h306c18 0 32 14 32 32v9H64v-9c0-18 14-32 32-32h24z" fill="currentColor" opacity=".18" stroke="currentColor" strokeWidth="5" />
                <path d="M184 85h146l60 56H130l54-56z" fill="currentColor" opacity=".12" stroke="currentColor" strokeWidth="5" />
                <circle cx="145" cy="181" r="31" fill="#0c2346" stroke="white" strokeWidth="7" /><circle cx="145" cy="181" r="11" fill="white" opacity=".8" />
                <circle cx="382" cy="181" r="31" fill="#0c2346" stroke="white" strokeWidth="7" /><circle cx="382" cy="181" r="11" fill="white" opacity=".8" />
              </svg>
              <div className="banner-stat"><b>100+</b><span>전국 승인 시공점</span></div>
            </div>
            <div className="banner-dots"><i className="active"></i><i></i><i></i></div>
          </section>

          <section className="recent-deals dealer-panel">
            <div className="section-head">
              <div><h2>최근 거래</h2><p>최근 업데이트된 차량과 메시지를 확인하세요.</p></div>
              <button className="text-link" onClick={() => onFilterDeals("전체")}>전체 보기 <DealerIcon name="arrow" /></button>
            </div>
            <div className="dealer-recent-list">
              {deals.slice(0, 4).map((deal) => (
                <button key={deal.id} onClick={() => onOpenDeal(deal.id)}>
                  <span className="vehicle-icon">{deal.maker.slice(0, 1)}</span>
                  <span className="recent-vehicle"><b>{deal.maker} {deal.model}</b><small>{deal.shopName}</small></span>
                  <StatusBadge status={deal.status} />
                  <span className="recent-message"><b>{deal.lastMessage}</b><small>{deal.updatedAt}</small></span>
                  <DealerIcon name="arrow" />
                </button>
              ))}
            </div>
          </section>
        </div>

        <aside className="dealer-info-rail">
          <section className="dealer-panel notice-card">
            <div className="section-head"><div><h2>공지사항</h2></div><button className="text-link">더보기</button></div>
            <button><span>안내</span><b>신규 시공점 등록 안내</b><small>07.14</small></button>
            <button><span>정책</span><b>표준 패키지 정책 업데이트</b><small>07.11</small></button>
            <button><span>점검</span><b>서비스 점검 안내</b><small>07.09</small></button>
          </section>

          <section className="dealer-panel info-mini-card message-info">
            <i><DealerIcon name="chat" /></i><span><small>읽지 않은 메시지</small><b>2건</b><button onClick={onOpenChat}>최근 메시지 바로가기</button></span>
          </section>
          <section className="dealer-panel info-mini-card">
            <i><DealerIcon name="deals" /></i><span><small>오늘의 일정</small><b>입고 예정 2건</b><em>출고 예정 1건</em></span>
          </section>
          <section className="dealer-panel response-card">
            <div><span>요청 응답 현황</span><small>오늘 기준</small></div>
            <b>평균 응답 시간 <strong>18분</strong></b>
            <span className="response-bar"><i></i></span>
            <small>답변 대기 2건 · 평균 기준 48시간 이내</small>
          </section>
        </aside>
      </div>
    </section>
  );
}

function RequestScreen({
  request,
  setRequest,
  selectedShop,
  selectedDistance,
  onSummary,
}: {
  request: ServiceRequest;
  setRequest: (request: ServiceRequest) => void;
  selectedShop: InstallerShop;
  selectedDistance: string;
  onSummary: () => void;
}) {
  const toggleWork = (work: WorkType) => {
    const works = request.works.includes(work) ? request.works.filter((item) => item !== work) : [...request.works, work];
    setRequest({ ...request, works });
  };

  return (
    <section className="form-screen">
      <div className="page-title">
        <div>
          <p className="eyebrow">SERVICE REQUEST</p>
          <h1>시공 요청</h1>
          <p>예약 확정 전에 시공점이 처리 가능 여부를 먼저 확인합니다.</p>
        </div>
      </div>
      <div className="request-grid">
        <form className="form-card">
          <div className="form-step">
            <h3>1단계 · 차량 정보</h3>
            <label>차량 제조사<input value={request.maker} onChange={(event) => setRequest({ ...request, maker: event.target.value })} /></label>
            <label>차량 모델<input value={request.model} onChange={(event) => setRequest({ ...request, model: event.target.value })} /></label>
            <label>신차 또는 재시공<select value={request.vehicleType} onChange={(event) => setRequest({ ...request, vehicleType: event.target.value as ServiceRequest["vehicleType"] })}><option>신차</option><option>재시공</option></select></label>
          </div>
          <div className="form-step">
            <h3>2단계 · 고객 및 지역 정보</h3>
            <label>고객 인도 지역<input value={request.deliveryArea} onChange={(event) => setRequest({ ...request, deliveryArea: event.target.value })} /></label>
            <label>예상 입고 시작일<input type="date" value={request.inboundStart} onChange={(event) => setRequest({ ...request, inboundStart: event.target.value })} /></label>
            <label>예상 입고 종료일<input type="date" value={request.inboundEnd} onChange={(event) => setRequest({ ...request, inboundEnd: event.target.value })} /></label>
          </div>
          <div className="form-step">
            <h3>3단계 · 작업 정보</h3>
            <label>희망 필름 브랜드<select value={request.preferredBrand} onChange={(event) => setRequest({ ...request, preferredBrand: event.target.value as Brand })}>{brands.map((brand) => <option key={brand}>{brand}</option>)}</select></label>
            <fieldset>
              <legend>요청 작업</legend>
              <div className="work-checks">
                {workTypes.map((work) => (
                  <label key={work}>
                    <input type="checkbox" checked={request.works.includes(work)} onChange={() => toggleWork(work)} />
                    {work}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="wide">특이사항<textarea value={request.memo} onChange={(event) => setRequest({ ...request, memo: event.target.value })} /></label>
          </div>
        </form>
        <aside className="sticky-summary">
          <small>4단계 · 시공점 선택</small>
          <span className="verified-badge">선택 시공점</span>
          <h2>{selectedShop.name}</h2>
          <p>{selectedShop.address}</p>
          <b>{selectedDistance}</b>
          <dl>
            <div><dt>지역</dt><dd>{selectedShop.district}</dd></div>
            <div><dt>취급 브랜드</dt><dd>{selectedShop.brands.join(", ")}</dd></div>
            <div><dt>가능 작업</dt><dd>{selectedShop.works.join(", ")}</dd></div>
            <div><dt>요청 가능</dt><dd>{selectedShop.available ? "가능" : "마감"}</dd></div>
          </dl>
          <hr />
          <small>5단계 · 최종 확인으로 이동합니다. 요청 전에는 채팅이 비활성화됩니다.</small>
          <button className="primary full" onClick={onSummary}>최종 확인</button>
        </aside>
      </div>
    </section>
  );
}

function RequestSummary({ request, selectedShop, selectedDistance, onBack, onSend }: { request: ServiceRequest; selectedShop: InstallerShop; selectedDistance: string; onBack: () => void; onSend: () => void }) {
  return (
    <section className="summary-screen">
      <p className="eyebrow">CONFIRM REQUEST</p>
      <h1>시공 요청 전 최종 확인</h1>
      <div className="summary-box">
        <article>
          <h3>선택 시공점</h3>
          <b>{selectedShop.name}</b>
          <p>{selectedShop.address} · {selectedDistance}</p>
          <span>{selectedShop.brands.join(", ")}</span>
        </article>
        <article>
          <h3>차량 및 요청 정보</h3>
          <b>{request.maker} {request.model}</b>
          <p>{request.vehicleType} · {request.deliveryArea}</p>
          <span>{request.preferredBrand} · {request.works.join(", ")}</span>
        </article>
        <article>
          <h3>예상 입고 범위</h3>
          <b>{request.inboundStart} ~ {request.inboundEnd}</b>
          <p>{request.memo}</p>
        </article>
      </div>
      <div className="summary-actions">
        <button className="secondary" onClick={onBack}>수정하기</button>
        <button className="primary" onClick={onSend}>시공 요청 보내기</button>
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
          <h1>진행 중 거래</h1>
          <p>여러 차량의 시공 요청, 일정, 입고 상태와 최근 메시지를 함께 관리합니다.</p>
        </div>
      </div>
      {requestSuccess && (
        <div className="success-banner">
          <span>요청 전송 완료</span>
          <b>{requestSuccess.id}</b>
          <p>상태가 답변 대기로 설정되었고 진행 중 거래 목록에 추가되었습니다. 시공점 수락 전까지 채팅은 비활성화됩니다.</p>
          <button onClick={clearRequestSuccess}>닫기</button>
        </div>
      )}
      <div className="deal-filters">
        {(["전체", ...dealStatuses] as (DealStatus | "전체")[]).map((status) => (
          <button key={status} className={filter === status ? "active" : ""} onClick={() => setFilter(status)}>
            {status}
            <small>{status === "전체" ? allDeals.length : allDeals.filter((deal) => deal.status === status).length}</small>
          </button>
        ))}
      </div>
      <div className="deals-layout">
        <section className="deal-list">
          {deals.map((deal) => (
            <button key={deal.id} className={`deal-row-card ${deal.id === selectedDeal.id ? "selected" : ""}`} onClick={() => onOpenDeal(deal.id)}>
              <span>
                <small>{deal.id}</small>
                <b>{deal.maker} {deal.model}</b>
                <em>{deal.shopName} · {deal.region}</em>
                <i>{deal.works.join(", ")}</i>
              </span>
              <span>
                <StatusBadge status={deal.status} />
                <i>{deal.lastMessage}</i>
                <small>마지막 업데이트 {deal.updatedAt}</small>
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
      <dl>
        <div><dt>시공점</dt><dd>{deal.shopName}</dd></div>
        <div><dt>주소</dt><dd>{deal.shopAddress}</dd></div>
        <div><dt>요청 작업</dt><dd>{deal.works.join(", ")}</dd></div>
        <div><dt>입고 예정</dt><dd>{deal.inboundAt ?? "-"}</dd></div>
        <div><dt>출고 예정</dt><dd>{deal.outboundAt ?? deal.completedAt ?? "-"}</dd></div>
        <div><dt>최근 메시지</dt><dd>{deal.lastMessage}</dd></div>
      </dl>
      <button className="primary full" onClick={onAction}>{actionLabel}</button>
    </aside>
  );
}

function ShopRequests({ request, selectedShop, status, onAccept, onReject, onOpenChat }: { request: ServiceRequest; selectedShop: InstallerShop; status: RequestStatus; onAccept: () => void; onReject: () => void; onOpenChat: () => void }) {
  const hasRequest = status !== "draft";

  return (
    <section className="shop-request-screen">
      <div className="page-title">
        <div>
          <p className="eyebrow">SHOP REQUESTS</p>
          <h1>시공점 요청 처리</h1>
          <p>미사 스타힐스 시공점 계정으로 들어온 딜러 요청을 확인한 뒤 수락하고 일정을 제안하거나 거절 사유를 남깁니다.</p>
        </div>
      </div>
      {!hasRequest ? (
        <div className="empty-state large">새 요청 목록이 비어 있습니다. 딜러 화면에서 먼저 시공 요청을 보내세요.</div>
      ) : (
        <article className="request-review">
          <div>
            <span className="status-chip">{status === "sent" ? "새 요청" : "수락 완료"}</span>
            <h2>{request.maker} {request.model} · {request.vehicleType}</h2>
            <p>{request.deliveryArea} · {request.preferredBrand} · {request.works.join(", ")}</p>
            <small>예상 입고 {request.inboundStart} ~ {request.inboundEnd}</small>
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
              <button className="primary full" onClick={onOpenChat}>거래 채팅 열기</button>
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
  onOpenDetail: (dealId: string) => void;
}) {
  const chatEnabled = selectedDeal.status !== "답변 대기";

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
          <div className="chat-header">
            <b>{selectedDeal.id} · {selectedDeal.maker} {selectedDeal.model}</b>
            <span>{chatEnabled ? "채팅 활성화" : "답변 대기 · 채팅 비활성화"}</span>
          </div>
          <div className="message-list">
            {selectedDeal.messages.map((message) => (
              <div key={message.id} className={`message ${message.sender === "dealer" ? "mine" : message.sender}`}>
                <small>{message.sender === "dealer" ? "딜러" : message.sender === "shop" ? "시공점" : "시스템"} · {message.time}</small>
                <p>{message.text}</p>
              </div>
            ))}
            {chatEnabled && selectedDeal.status !== "시공 완료" && (
              <div className="schedule-card">
                <span>시공점 일정 제안</span>
                <b>입고일: {selectedDeal.inboundAt ?? sampleScheduleProposal.inboundAt}</b>
                <b>출고일: {selectedDeal.outboundAt ?? sampleScheduleProposal.outboundAt}</b>
                <p>{selectedDeal.shopName}에서 현재 거래 일정 기준으로 제안한 샘플 일정입니다.</p>
                {selectedDeal.status !== "예약 확정" && <button className="primary" onClick={onAgree}>일정 동의</button>}
                {selectedDeal.status === "예약 확정" && <em>딜러 일정 동의 완료</em>}
              </div>
            )}
          </div>
          <div className="chat-input">
            <input disabled={!chatEnabled} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => event.key === "Enter" && sendMessage()} placeholder={chatEnabled ? "메시지를 입력하세요" : "시공점 수락 후 채팅이 가능합니다"} />
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
  const activeStep = status === "scheduleAgreed" ? 3 : status === "accepted" ? 2 : status === "sent" ? 1 : 0;
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
            <div><dt>지역</dt><dd>{request.deliveryArea}</dd></div>
            <div><dt>시공점</dt><dd>{selectedShop.name}</dd></div>
            <div><dt>희망 브랜드</dt><dd>{request.preferredBrand}</dd></div>
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
  return (
    <section className="ops-screen">
      <div className="page-title">
        <div>
          <p className="eyebrow">LOWER PRIORITY</p>
          <h1>관리·결제·정산 화면</h1>
          <p>기존 기능은 삭제하지 않고 딜러 화면보다 낮은 우선순위의 운영 영역으로 유지합니다.</p>
        </div>
      </div>
      <div className="ops-grid">
        <article><span>관리자</span><b>승인 시공점 94곳</b><p>사업자 인증은 이번 버전에서 샘플 상태로만 표시합니다.</p></article>
        <article><span>결제</span><b>{formatWon(fee.gross)}</b><p>실제 PG 결제는 제외 범위이며 테스트 금액만 표시합니다.</p></article>
        <article><span>정산</span><b>{formatWon(fee.net)}</b><p>플랫폼 3%, PG 2.9% 차감 샘플 계산입니다.</p></article>
      </div>
    </section>
  );
}
