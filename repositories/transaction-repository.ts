import type {
  ContactStatus,
  Transaction,
  TransactionStage,
  TransactionStageEvent,
  WarrantyInfo,
} from "../types/transactions";
import { readCollection, subscribeToStorage, writeCollection } from "./storage";

export const TRANSACTION_STORAGE_KEY = "car-master-transactions";

// v0.3.9 renamed the stage model (접수/입고예정/시공중/완료 -> 견적/시공예약/(fold)/작업완료).
// Transactions already sitting in a browser's localStorage from before this
// change still carry the old literals and have no stageLog at all — normalize
// both on read so old demo data keeps working instead of breaking silently.
const LEGACY_STAGE_MAP: Partial<Record<string, TransactionStage>> = {
  접수: "견적",
  입고예정: "시공예약",
  시공중: "입고",
  완료: "작업완료",
};
function normalizeTransaction(value: Transaction): Transaction {
  const mappedStage = LEGACY_STAGE_MAP[value.status.stage];
  return {
    ...value,
    status: mappedStage ? { ...value.status, stage: mappedStage } : value.status,
    stageLog: value.stageLog ?? [],
    // localStorage rows saved before the warranty-issuance feature shipped
    // have no `warranty` key at all — default it so UI code can always read
    // transaction.warranty.x without a null-check.
    warranty: value.warranty ?? {},
  };
}

// v0.3.10 messenger needs at least one transaction id both the demo dealer
// (hanjaejin-dealer) and demo installer (misa-starhills-shop) see by default,
// in ANY browser, with no dependency on one browser having created it — demo
// transactions otherwise live only in that one browser's localStorage. This
// fixed record is computed at read time (never itself written to storage);
// its chat lives in the shared Supabase-backed demo_chat_* tables (see
// repositories/demo-chat-repository.ts) so 1/1 <-> 2/2 messaging is testable
// across two separate browsers out of the box. Any real mutation (stage
// change, price, etc.) still lands in this browser's own localStorage via the
// normal update() path the moment it's touched, same as any other transaction.
// Deliberately far in the past (not "today") — any real message sent during
// actual use must sort after these seed rows. The original value was set to
// the day this feature shipped, which briefly put it in the FUTURE relative
// to real testing still happening that same day, so genuinely-new demo
// messages sorted before it and never showed up as the Inbox's "last
// message" preview (confirmed via Production smoke test).
const DEMO_SEED_CREATED_AT = "2026-01-01T00:00:00.000Z";

/** Day offset from today at a fixed local wall-clock hour, as an ISO string.
 * Seed schedules MUST be relative: a hardcoded calendar date silently rots
 * into "19일 전" a few weeks after it is written, which is exactly what the
 * original single seed row did. */
function seedDateAt(dayOffset: number, hour: number) {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}
function seedDayOnly(dayOffset: number) {
  return seedDateAt(dayOffset, 0).slice(0, 10);
}
/** Strictly-in-the-past instant, for created/updated stamps. */
function seedHoursAgo(hours: number) {
  return new Date(Date.now() - hours * 3600000).toISOString();
}

/** Demo-only showcase rows so the Dealer workspace reads as a service in
 * daily use rather than an empty shell — twelve deals spread across every
 * stage (견적/시공예약/입고/작업완료/출고/취소), so the 거래관리 탭 counts,
 * the dashboard's active-work table and the Messenger inbox all have real
 * content to show.
 *
 * Rules this seed keeps to:
 * - Every 시공점 is picked from the existing demo directory
 *   (data/installer-directory-demo.ts) — never invented, and never a real
 *   business name or phone number.
 * - No trust metrics (평점·리뷰·응답시간·누적 거래건수). A demo must not
 *   manufacture numbers a viewer would read as this company's track record.
 * - Customer/vehicle details are deliberately uneven: later-stage deals are
 *   filled in, early-stage ones are not — that's what real operation looks
 *   like, and it exercises the "미등록/미정" rendering paths.
 * - Computed at read time and never written to storage, exactly like the
 *   original single seed row.
 */

/** 010-0000-#### is not an allocated Korean subscriber range — a demo
 * customer number can never dial a real person. */
const seedCustomerPhone = (suffix: string) => `010-0000-${suffix}`;

type SeedStage = Exclude<TransactionStage, "시공불가">;
/** The forward path every seeded deal took to reach its current stage, so the
 * 거래 로그 and the stage rail agree with status.stage instead of being
 * hand-listed per row (which is where they drift apart). */
const STAGE_PATH: Record<SeedStage, { stage: TransactionStage; actor: "dealer" | "shop" }[]> = {
  견적: [{ stage: "견적", actor: "dealer" }],
  시공예약: [
    { stage: "견적", actor: "dealer" },
    { stage: "시공예약", actor: "shop" },
  ],
  입고: [
    { stage: "견적", actor: "dealer" },
    { stage: "시공예약", actor: "shop" },
    { stage: "입고", actor: "shop" },
  ],
  작업완료: [
    { stage: "견적", actor: "dealer" },
    { stage: "시공예약", actor: "shop" },
    { stage: "입고", actor: "shop" },
    { stage: "작업완료", actor: "shop" },
  ],
  출고: [
    { stage: "견적", actor: "dealer" },
    { stage: "시공예약", actor: "shop" },
    { stage: "입고", actor: "shop" },
    { stage: "작업완료", actor: "shop" },
    { stage: "출고", actor: "dealer" },
  ],
  취소: [
    { stage: "견적", actor: "dealer" },
    { stage: "취소", actor: "dealer" },
  ],
};

/** Spreads the path's events evenly between the deal's creation and its last
 * update so the 거래 로그 reads as a sequence rather than one timestamp
 * repeated N times. */
function seedStageLog(id: string, stage: SeedStage, createdAt: string, updatedAt: string): TransactionStageEvent[] {
  const path = STAGE_PATH[stage];
  const from = new Date(createdAt).getTime();
  const to = new Date(updatedAt).getTime();
  return path.map((step, index) => ({
    id: `EVT-${id.replace("CM-DEMO-", "")}-${index + 1}`,
    fromStage: index === 0 ? null : path[index - 1].stage,
    toStage: step.stage,
    actorRole: step.actor,
    direction: "forward" as const,
    createdAt:
      path.length === 1 ? createdAt : new Date(from + ((to - from) * index) / (path.length - 1)).toISOString(),
  }));
}

type SeedInput = {
  id: string;
  installerId: string;
  installerName: string;
  vehicle: Transaction["vehicle"];
  brand?: string;
  workDescription: string;
  stage: SeedStage;
  /** Days from today for the inbound date; omit for a deal with no date yet. */
  inboundDay?: number;
  /** true = the shop confirmed the slot, false = still the dealer's request. */
  inboundConfirmed?: boolean;
  releaseDay?: number;
  /** Hours before now. Deliberately NOT a day offset at a fixed wall-clock
   * hour: "today at 15:00" is in the FUTURE whenever the page is opened in
   * the morning, which makes the deal sort ahead of genuinely-new activity
   * and renders as "방금" all day (the same trap the DEMO_SEED_CREATED_AT
   * comment above records). Hours-before-now is always in the past. */
  createdHoursAgo: number;
  updatedHoursAgo: number;
  finalPrice?: number;
  warranty?: WarrantyInfo;
  contactStatus?: ContactStatus;
  outcomeNote?: string;
  lastMessage: string;
  /** Absent = this deal has no conversation yet (a normal, common state). */
  chatRoomId?: string;
};

function buildSeed(input: SeedInput): Transaction {
  // CM-DEMO-0001 keeps both of its original fixed timestamps — see the
  // DEMO_SEED_CREATED_AT comment above: its room is the shared 1/1 <-> 2/2
  // one, and a real message sent during actual use has to sort after the
  // seed, which only a far-past timestamp guarantees.
  const shared = input.id === "CM-DEMO-0001";
  const createdAt = shared ? DEMO_SEED_CREATED_AT : seedHoursAgo(input.createdHoursAgo);
  const updatedAt = shared ? DEMO_SEED_CREATED_AT : seedHoursAgo(input.updatedHoursAgo);
  const warranty = input.warranty ?? {};
  return {
    id: input.id,
    dealerId: "hanjaejin-dealer",
    dealerName: "한재진",
    dealerCompanyName: "카마스터",
    installerId: input.installerId,
    installerName: input.installerName,
    vehicle: input.vehicle,
    service: { brand: input.brand, workDescription: input.workDescription, extraRequest: "" },
    pricing: { finalPrice: input.finalPrice, paymentStatus: "미결제" },
    schedule: {
      requestedInboundAt: input.inboundDay == null ? undefined : seedDayOnly(input.inboundDay),
      confirmedInboundAt:
        input.inboundDay != null && input.inboundConfirmed ? seedDateAt(input.inboundDay, 10) : undefined,
      desiredReleaseAt: input.releaseDay == null ? undefined : seedDayOnly(input.releaseDay),
      completedAt: input.stage === "출고" ? updatedAt : undefined,
    },
    status: { stage: input.stage, createdAt, updatedAt },
    outcomeNote: input.outcomeNote,
    contactStatus: input.contactStatus,
    // Mirrors set_transaction_warranty_info: infoSubmittedAt is stamped only
    // once all three required fields are present.
    warranty:
      warranty.customerName && warranty.customerPhone && warranty.vehicleNumber
        ? { ...warranty, infoSubmittedAt: seedHoursAgo(input.updatedHoursAgo + 6) }
        : warranty,
    visibility: { hiddenByDealer: false, hiddenByInstaller: false },
    chatRoomId: input.chatRoomId ?? `CHAT-${input.id.replace("CM-DEMO-", "DEMO-")}`,
    lastMessage: input.lastMessage,
    stageLog: seedStageLog(input.id, input.stage, createdAt, updatedAt),
  };
}

const DEMO_SEEDS: SeedInput[] = [
  // 1/1 <-> 2/2 cross-browser room. Its id, shop and room id are fixed —
  // demo-chat-repository.ts and SHARED_DEMO_ROOM_IDS below both depend on them.
  {
    id: "CM-DEMO-0001",
    installerId: "SHOP-MISA-001",
    installerName: "미사 스타힐스 시공점",
    vehicle: { maker: "BMW", model: "X5", class: "수입 대형/SUV" },
    brand: "버텍스",
    workDescription: "전면 유리 & 사이드 썬팅",
    stage: "시공예약",
    inboundDay: 3,
    inboundConfirmed: true,
    releaseDay: 5,
    createdHoursAgo: 144,
    updatedHoursAgo: 144,
    lastMessage: "시공예약이 확정되었습니다.",
    chatRoomId: "CHAT-DEMO-0001",
  },
  {
    id: "CM-DEMO-0002",
    installerId: "INS-CN-001",
    installerName: "카마스터 천안점",
    vehicle: { maker: "제네시스", model: "G80", class: "국산 대형/SUV" },
    brand: "레이노",
    workDescription: "전면 + 측후면 썬팅",
    stage: "입고",
    inboundDay: -1,
    inboundConfirmed: true,
    releaseDay: 1,
    createdHoursAgo: 192,
    updatedHoursAgo: 3,
    // 차량번호만 먼저 들어온 상태 — 고객 정보는 아직.
    warranty: { vehicleNumber: "12가 3456" },
    contactStatus: "contacted",
    lastMessage: "작업 진행 중 사진 보내드립니다.",
  },
  {
    id: "CM-DEMO-0003",
    installerId: "SHOP-BS-001",
    installerName: "루마버텍스 해운대점",
    vehicle: { maker: "테슬라", model: "모델 3", class: "수입 승용" },
    brand: "루마",
    workDescription: "측후면 썬팅",
    stage: "시공예약",
    // 시공예약 with NO confirmedInboundAt = the shop proposed a slot the dealer
    // has not confirmed yet.
    inboundDay: 5,
    createdHoursAgo: 96,
    updatedHoursAgo: 1,
    lastMessage: "제안드린 날짜로 확정해 주시면 바로 잡아두겠습니다.",
  },
  {
    id: "CM-DEMO-0004",
    installerId: "INS-GG-002",
    installerName: "카마스터 성남점",
    vehicle: { maker: "현대", model: "아반떼", class: "국산 승용" },
    brand: "솔라가드",
    workDescription: "전면 썬팅",
    stage: "견적",
    inboundDay: 7,
    createdHoursAgo: 2,
    updatedHoursAgo: 2,
    lastMessage: "새 시공 요청이 접수되었습니다.",
  },
  {
    id: "CM-DEMO-0005",
    installerId: "INS-JJ-001",
    installerName: "카마스터 제주시점",
    vehicle: { maker: "기아", model: "카니발", class: "국산 대형/SUV" },
    brand: "브이쿨",
    workDescription: "신차 썬팅 패키지",
    stage: "출고",
    inboundDay: -12,
    inboundConfirmed: true,
    releaseDay: -9,
    createdHoursAgo: 432,
    updatedHoursAgo: 216,
    finalPrice: 620000,
    warranty: { customerName: "김도현", customerPhone: seedCustomerPhone("2841"), vehicleNumber: "31주 5820" },
    contactStatus: "contacted",
    lastMessage: "출고 완료되었습니다. 보증서 전달드렸습니다.",
  },
  {
    id: "CM-DEMO-0006",
    installerId: "INS-GN-001",
    installerName: "카마스터 창원점",
    vehicle: { maker: "볼보", model: "XC60", class: "수입 대형/SUV" },
    brand: "후퍼옵틱",
    workDescription: "전면 유리 & 사이드 썬팅",
    stage: "작업완료",
    inboundDay: -3,
    inboundConfirmed: true,
    releaseDay: 0,
    createdHoursAgo: 80,
    updatedHoursAgo: 5,
    finalPrice: 780000,
    warranty: { customerName: "이수진", customerPhone: seedCustomerPhone("7413"), vehicleNumber: "27허 1094" },
    contactStatus: "contacted",
    lastMessage: "작업 완료했습니다. 출고 일정 알려주세요.",
  },
  {
    id: "CM-DEMO-0007",
    installerId: "SHOP-SEOUL-REAL-001",
    installerName: "후퍼옵틱 강남점",
    vehicle: { maker: "벤츠", model: "E250", class: "수입 승용" },
    brand: "후퍼옵틱",
    workDescription: "전면 썬팅",
    stage: "취소",
    createdHoursAgo: 360,
    updatedHoursAgo: 264,
    contactStatus: "unreachable",
    outcomeNote: "고객이 출고 일정을 앞당겨 다른 지역 시공점으로 진행했습니다.",
    lastMessage: "이 거래는 취소되었습니다.",
  },
  {
    id: "CM-DEMO-0008",
    installerId: "INS-GB-001",
    installerName: "카마스터 포항점",
    vehicle: { maker: "현대", model: "팰리세이드", class: "국산 대형/SUV" },
    brand: "버텍스",
    workDescription: "신차 썬팅 패키지",
    stage: "입고",
    inboundDay: 0,
    inboundConfirmed: true,
    releaseDay: 2,
    createdHoursAgo: 160,
    updatedHoursAgo: 6,
    // 고객 정보는 받았지만 차량번호가 아직 안 나온 신차 — 보증서는 아직 불가.
    warranty: { customerName: "박성호", customerPhone: seedCustomerPhone("5106"), vin: "KMHL1234ABC567890" },
    contactStatus: "contacted",
    lastMessage: "오늘 오전 입고 확인했습니다.",
  },
  {
    id: "CM-DEMO-0009",
    installerId: "INS-GW-001",
    installerName: "카마스터 춘천점",
    vehicle: { maker: "기아", model: "쏘렌토", class: "국산 대형/SUV" },
    brand: "레인보우",
    workDescription: "측후면 썬팅",
    stage: "시공예약",
    inboundDay: 2,
    inboundConfirmed: true,
    releaseDay: 4,
    createdHoursAgo: 60,
    updatedHoursAgo: 20,
    contactStatus: "contacted",
    lastMessage: "화요일 오전 10시로 잡아두겠습니다.",
  },
  {
    id: "CM-DEMO-0010",
    installerId: "SHOP-MISA-001",
    installerName: "미사 스타힐스 시공점",
    vehicle: { maker: "아우디", model: "Q5", class: "수입 대형/SUV" },
    brand: "브이쿨",
    workDescription: "전면 유리 & 사이드 썬팅",
    stage: "작업완료",
    inboundDay: -2,
    inboundConfirmed: true,
    releaseDay: 1,
    createdHoursAgo: 200,
    updatedHoursAgo: 26,
    finalPrice: 890000,
    warranty: { customerName: "정민아", customerPhone: seedCustomerPhone("3372"), vehicleNumber: "48로 7712" },
    contactStatus: "contacted",
    lastMessage: "작업 완료했습니다. 확인 부탁드립니다.",
  },
  {
    id: "CM-DEMO-0011",
    installerId: "INS-JB-001",
    installerName: "카마스터 전주점",
    vehicle: { maker: "현대", model: "아이오닉 5", class: "국산 대형/SUV" },
    brand: "글라스틴트",
    workDescription: "전면 썬팅",
    stage: "견적",
    inboundDay: 9,
    createdHoursAgo: 26,
    updatedHoursAgo: 26,
    lastMessage: "새 시공 요청이 접수되었습니다.",
  },
  {
    id: "CM-DEMO-0012",
    installerId: "SHOP-MISA-001",
    installerName: "미사 스타힐스 시공점",
    vehicle: { maker: "기아", model: "K8", class: "국산 대형/SUV" },
    brand: "솔라가드",
    workDescription: "신차 썬팅 패키지",
    stage: "출고",
    inboundDay: -17,
    inboundConfirmed: true,
    releaseDay: -14,
    createdHoursAgo: 520,
    updatedHoursAgo: 340,
    finalPrice: 540000,
    warranty: { customerName: "최윤서", customerPhone: seedCustomerPhone("9028"), vehicleNumber: "05버 4417" },
    contactStatus: "contacted",
    lastMessage: "출고 완료되었습니다.",
  },
];

function demoSeedTransactions(): Transaction[] {
  return DEMO_SEEDS.map(buildSeed);
}

/** Chat room ids whose messages live in the shared, anon-open demo_chat_* backend
 * (see demo-chat-repository.ts) instead of this browser's own localStorage. Only
 * the original 1/1 <-> 2/2 room is shared; the two showcase rooms added alongside
 * it are local-seeded (see chat-repository.ts) as they have no Installer counterpart. */
export const SHARED_DEMO_ROOM_IDS = new Set(["CHAT-DEMO-0001"]);

export interface TransactionRepository {
  getAll(): Transaction[];
  getById(id: string): Transaction | null;
  create(value: Transaction): void;
  update(value: Transaction): void;
  upsert(value: Transaction): void;
  hideForDealer(id: string): void;
  hideForInstaller(id: string): void;
  unhideForDealer(id: string): void;
  unhideForInstaller(id: string): void;
  subscribe(listener: () => void): () => void;
}
export class LocalTransactionRepository implements TransactionRepository {
  getAll = () => {
    const stored = readCollection<Transaction>(TRANSACTION_STORAGE_KEY).map(normalizeTransaction);
    const storedIds = new Set(stored.map((item) => item.id));
    return [...demoSeedTransactions().filter((item) => !storedIds.has(item.id)), ...stored];
  };
  getById = (id: string) => this.getAll().find((item) => item.id === id) ?? null;
  create(value: Transaction) {
    if (this.getById(value.id)) throw new Error(`Transaction ${value.id} already exists.`);
    writeCollection(TRANSACTION_STORAGE_KEY, [value, ...this.getAll()]);
  }
  update(value: Transaction) {
    if (!this.getById(value.id)) throw new Error(`Transaction ${value.id} was not found.`);
    writeCollection(
      TRANSACTION_STORAGE_KEY,
      this.getAll().map((item) => (item.id === value.id ? value : item)),
    );
  }
  upsert(value: Transaction) {
    if (this.getById(value.id)) this.update(value);
    else this.create(value);
  }
  hideForDealer(id: string) {
    const item = this.getById(id);
    if (item) this.update({ ...item, visibility: { ...item.visibility, hiddenByDealer: true } });
  }
  hideForInstaller(id: string) {
    const item = this.getById(id);
    if (item) this.update({ ...item, visibility: { ...item.visibility, hiddenByInstaller: true } });
  }
  unhideForDealer(id: string) {
    const item = this.getById(id);
    if (item) this.update({ ...item, visibility: { ...item.visibility, hiddenByDealer: false } });
  }
  unhideForInstaller(id: string) {
    const item = this.getById(id);
    if (item) this.update({ ...item, visibility: { ...item.visibility, hiddenByInstaller: false } });
  }
  subscribe(listener: () => void) {
    return subscribeToStorage(TRANSACTION_STORAGE_KEY, listener);
  }
}
export const transactionRepository = new LocalTransactionRepository();
