import type { Transaction, TransactionStage } from "../types/transactions";
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

/** Demo-only showcase rows so the Dealer workspace reads as a service in use
 * rather than an empty shell. Eight rows spanning every stage the dashboard's
 * "다음 행동" mapping distinguishes (전화 확인 필요/입고 확정/작업 중 대기/출고
 * 처리) so the redesigned list and its next-action badges read as a business
 * with real volume, not a 3-row demo. Every shop is picked from the existing
 * demo directory (data/installer-directory-demo.ts) — never invented, and
 * never a real business name or phone number. Computed at read time and
 * never written to storage, exactly like the original seed row. */
function demoSeedTransactions(): Transaction[] {
  return [
    {
      id: "CM-DEMO-0001",
      dealerId: "hanjaejin-dealer",
      dealerName: "한재진",
      dealerCompanyName: "카마스터",
      installerId: "SHOP-MISA-001",
      installerName: "미사 스타힐스 시공점",
      vehicle: { maker: "BMW", model: "X5", class: "수입 대형/SUV" },
      service: { brand: "버텍스", product: "카본 스텔스", workDescription: "전면 유리 & 사이드 썬팅", extraRequest: "" },
      pricing: { baseGuidePrice: 450000, surcharge: 0, paymentStatus: "미결제" },
      schedule: { requestedInboundAt: seedDayOnly(3), confirmedInboundAt: seedDateAt(3, 10) },
      status: { stage: "시공예약", createdAt: DEMO_SEED_CREATED_AT, updatedAt: DEMO_SEED_CREATED_AT },
      warranty: {},
      visibility: { hiddenByDealer: false, hiddenByInstaller: false },
      chatRoomId: "CHAT-DEMO-0001",
      lastMessage: "시공예약이 확정되었습니다.",
      stageLog: [
        {
          id: "EVT-DEMO-0001",
          fromStage: null,
          toStage: "견적",
          actorRole: "dealer",
          direction: "forward",
          createdAt: DEMO_SEED_CREATED_AT,
        },
        {
          id: "EVT-DEMO-0002",
          fromStage: "견적",
          toStage: "시공예약",
          actorRole: "shop",
          direction: "forward",
          createdAt: DEMO_SEED_CREATED_AT,
        },
      ],
    },
    {
      id: "CM-DEMO-0002",
      dealerId: "hanjaejin-dealer",
      dealerName: "한재진",
      dealerCompanyName: "카마스터",
      installerId: "INS-CN-001",
      installerName: "카마스터 천안점",
      vehicle: { maker: "제네시스", model: "G80", class: "국산 대형/SUV" },
      service: { brand: "레이노", product: "포토크로믹", workDescription: "PPF 프론트 패키지", extraRequest: "" },
      pricing: { baseGuidePrice: 1250000, surcharge: 0, paymentStatus: "미결제" },
      schedule: { requestedInboundAt: seedDayOnly(-1), confirmedInboundAt: seedDateAt(-1, 14) },
      status: { stage: "입고", createdAt: DEMO_SEED_CREATED_AT, updatedAt: seedDateAt(-1, 14) },
      warranty: {},
      visibility: { hiddenByDealer: false, hiddenByInstaller: false },
      chatRoomId: "CHAT-DEMO-0002",
      lastMessage: "프론트 작업 중 사진 보내드립니다.",
      stageLog: [
        {
          id: "EVT-DEMO-0003",
          fromStage: null,
          toStage: "견적",
          actorRole: "dealer",
          direction: "forward",
          createdAt: DEMO_SEED_CREATED_AT,
        },
        {
          id: "EVT-DEMO-0004",
          fromStage: "견적",
          toStage: "시공예약",
          actorRole: "shop",
          direction: "forward",
          createdAt: DEMO_SEED_CREATED_AT,
        },
        {
          id: "EVT-DEMO-0005",
          fromStage: "시공예약",
          toStage: "입고",
          actorRole: "shop",
          direction: "forward",
          createdAt: seedDateAt(-1, 14),
        },
      ],
    },
    {
      id: "CM-DEMO-0003",
      dealerId: "hanjaejin-dealer",
      dealerName: "한재진",
      dealerCompanyName: "카마스터",
      installerId: "SHOP-BS-001",
      installerName: "루마버텍스 해운대점",
      vehicle: { maker: "테슬라", model: "모델 3", class: "수입 승용" },
      service: { brand: "루마", product: "버텍스", workDescription: "유리막 코팅", extraRequest: "" },
      pricing: { baseGuidePrice: 680000, surcharge: 0, paymentStatus: "미결제" },
      // 시공예약 with NO confirmedInboundAt = the shop proposed a slot the
      // dealer has not confirmed yet. Reads as "예약 대기" on the redesigned
      // dashboard and still counts as an active deal on the current one.
      schedule: { requestedInboundAt: seedDayOnly(5) },
      status: { stage: "시공예약", createdAt: DEMO_SEED_CREATED_AT, updatedAt: seedDateAt(0, 9) },
      warranty: {},
      visibility: { hiddenByDealer: false, hiddenByInstaller: false },
      chatRoomId: "CHAT-DEMO-0003",
      lastMessage: "22일 오전 11시 가능합니다. 확정해 주세요.",
      stageLog: [
        {
          id: "EVT-DEMO-0006",
          fromStage: null,
          toStage: "견적",
          actorRole: "dealer",
          direction: "forward",
          createdAt: DEMO_SEED_CREATED_AT,
        },
        {
          id: "EVT-DEMO-0007",
          fromStage: "견적",
          toStage: "시공예약",
          actorRole: "shop",
          direction: "forward",
          createdAt: seedDateAt(0, 9),
        },
      ],
    },
    {
      id: "CM-DEMO-0004",
      dealerId: "hanjaejin-dealer",
      dealerName: "한재진",
      dealerCompanyName: "카마스터",
      installerId: "INS-SEOUL-004",
      installerName: "카마스터 성동점",
      vehicle: { maker: "현대", model: "아반떼", class: "국산 승용" },
      service: { brand: "솔라가드", product: "세라믹", workDescription: "전면 유리 썬팅", extraRequest: "" },
      pricing: { baseGuidePrice: 320000, surcharge: 0, paymentStatus: "미결제" },
      schedule: { requestedInboundAt: seedDayOnly(2), confirmedInboundAt: seedDateAt(2, 11) },
      status: { stage: "시공예약", createdAt: DEMO_SEED_CREATED_AT, updatedAt: seedDateAt(0, 8) },
      contactStatus: "contacted",
      warranty: {},
      visibility: { hiddenByDealer: false, hiddenByInstaller: false },
      chatRoomId: "CHAT-DEMO-0004",
      lastMessage: "26일 오전에 입고 가능합니다.",
      stageLog: [
        {
          id: "EVT-DEMO-0008",
          fromStage: null,
          toStage: "견적",
          actorRole: "dealer",
          direction: "forward",
          createdAt: DEMO_SEED_CREATED_AT,
        },
        {
          id: "EVT-DEMO-0009",
          fromStage: "견적",
          toStage: "시공예약",
          actorRole: "shop",
          direction: "forward",
          createdAt: seedDateAt(0, 8),
        },
      ],
    },
    {
      id: "CM-DEMO-0005",
      dealerId: "hanjaejin-dealer",
      dealerName: "한재진",
      dealerCompanyName: "카마스터",
      installerId: "INS-SEOUL-014",
      installerName: "카마스터 마포점",
      vehicle: { maker: "기아", model: "스포티지", class: "국산 대형/SUV" },
      service: { brand: "레이노", product: "PPF", workDescription: "PPF 도어 패키지", extraRequest: "" },
      pricing: { baseGuidePrice: 890000, surcharge: 0, paymentStatus: "미결제" },
      schedule: { requestedInboundAt: seedDayOnly(-2), confirmedInboundAt: seedDateAt(-2, 13) },
      status: { stage: "입고", createdAt: DEMO_SEED_CREATED_AT, updatedAt: seedDateAt(-2, 13) },
      contactStatus: "contacted",
      warranty: {},
      visibility: { hiddenByDealer: false, hiddenByInstaller: false },
      chatRoomId: "CHAT-DEMO-0005",
      lastMessage: "도어 PPF 작업 시작했습니다.",
      stageLog: [
        {
          id: "EVT-DEMO-0010",
          fromStage: null,
          toStage: "견적",
          actorRole: "dealer",
          direction: "forward",
          createdAt: DEMO_SEED_CREATED_AT,
        },
        {
          id: "EVT-DEMO-0011",
          fromStage: "견적",
          toStage: "시공예약",
          actorRole: "shop",
          direction: "forward",
          createdAt: DEMO_SEED_CREATED_AT,
        },
        {
          id: "EVT-DEMO-0012",
          fromStage: "시공예약",
          toStage: "입고",
          actorRole: "shop",
          direction: "forward",
          createdAt: seedDateAt(-2, 13),
        },
      ],
    },
    {
      id: "CM-DEMO-0006",
      dealerId: "hanjaejin-dealer",
      dealerName: "한재진",
      dealerCompanyName: "카마스터",
      installerId: "INS-SEOUL-016",
      installerName: "카마스터 강서점",
      vehicle: { maker: "아우디", model: "Q5", class: "수입 대형/SUV" },
      service: { brand: "카포스", product: "블랙박스", workDescription: "블랙박스 장착", extraRequest: "" },
      pricing: { baseGuidePrice: 410000, surcharge: 0, paymentStatus: "미결제" },
      schedule: { requestedInboundAt: seedDayOnly(-3), confirmedInboundAt: seedDateAt(-3, 15) },
      status: { stage: "입고", createdAt: DEMO_SEED_CREATED_AT, updatedAt: seedDateAt(-3, 15) },
      contactStatus: "contacted",
      warranty: {},
      visibility: { hiddenByDealer: false, hiddenByInstaller: false },
      chatRoomId: "CHAT-DEMO-0006",
      lastMessage: "블랙박스 장착 완료, 최종 점검 중입니다.",
      stageLog: [
        {
          id: "EVT-DEMO-0013",
          fromStage: null,
          toStage: "견적",
          actorRole: "dealer",
          direction: "forward",
          createdAt: DEMO_SEED_CREATED_AT,
        },
        {
          id: "EVT-DEMO-0014",
          fromStage: "견적",
          toStage: "시공예약",
          actorRole: "shop",
          direction: "forward",
          createdAt: DEMO_SEED_CREATED_AT,
        },
        {
          id: "EVT-DEMO-0015",
          fromStage: "시공예약",
          toStage: "입고",
          actorRole: "shop",
          direction: "forward",
          createdAt: seedDateAt(-3, 15),
        },
      ],
    },
    {
      id: "CM-DEMO-0007",
      dealerId: "hanjaejin-dealer",
      dealerName: "한재진",
      dealerCompanyName: "카마스터",
      installerId: "INS-SEOUL-011",
      installerName: "카마스터 노원점",
      vehicle: { maker: "볼보", model: "XC60", class: "수입 대형/SUV" },
      service: { brand: "루마", product: "버텍스", workDescription: "유리막 코팅", extraRequest: "" },
      pricing: { baseGuidePrice: 550000, surcharge: 0, paymentStatus: "미결제" },
      schedule: { requestedInboundAt: seedDayOnly(-5), confirmedInboundAt: seedDateAt(-5, 10) },
      // 작업완료는 recentDeals(최근 5건) 정렬 기준(updatedAt)에서 오늘 이른
      // 시각으로 잡아 "출고 처리하기" 다음 행동이 대시보드 상단 목록에도
      // 실제로 보이게 한다 — 전체보기로 넘어가야만 보이면 데모 취지가 죽는다.
      status: { stage: "작업완료", createdAt: DEMO_SEED_CREATED_AT, updatedAt: seedDateAt(0, 7) },
      contactStatus: "contacted",
      warranty: {},
      visibility: { hiddenByDealer: false, hiddenByInstaller: false },
      chatRoomId: "CHAT-DEMO-0007",
      lastMessage: "코팅 작업 완료했습니다. 출고 일정 확인해 주세요.",
      stageLog: [
        {
          id: "EVT-DEMO-0016",
          fromStage: null,
          toStage: "견적",
          actorRole: "dealer",
          direction: "forward",
          createdAt: DEMO_SEED_CREATED_AT,
        },
        {
          id: "EVT-DEMO-0017",
          fromStage: "견적",
          toStage: "시공예약",
          actorRole: "shop",
          direction: "forward",
          createdAt: DEMO_SEED_CREATED_AT,
        },
        {
          id: "EVT-DEMO-0018",
          fromStage: "시공예약",
          toStage: "입고",
          actorRole: "shop",
          direction: "forward",
          createdAt: seedDateAt(-5, 10),
        },
        {
          id: "EVT-DEMO-0019",
          fromStage: "입고",
          toStage: "작업완료",
          actorRole: "shop",
          direction: "forward",
          createdAt: seedDateAt(0, 7),
        },
      ],
    },
    {
      id: "CM-DEMO-0008",
      dealerId: "hanjaejin-dealer",
      dealerName: "한재진",
      dealerCompanyName: "카마스터",
      installerId: "INS-SEOUL-013",
      installerName: "카마스터 서대문점",
      vehicle: { maker: "벤츠", model: "GLC", class: "수입 대형/SUV" },
      service: { brand: "레이노", product: "세라믹", workDescription: "실내 코팅", extraRequest: "" },
      pricing: { baseGuidePrice: 380000, surcharge: 0, paymentStatus: "미결제" },
      schedule: { requestedInboundAt: seedDayOnly(-6), confirmedInboundAt: seedDateAt(-6, 9) },
      status: { stage: "작업완료", createdAt: DEMO_SEED_CREATED_AT, updatedAt: seedDateAt(0, 6) },
      contactStatus: "contacted",
      warranty: {},
      visibility: { hiddenByDealer: false, hiddenByInstaller: false },
      chatRoomId: "CHAT-DEMO-0008",
      lastMessage: "실내 코팅 마무리했습니다.",
      stageLog: [
        {
          id: "EVT-DEMO-0020",
          fromStage: null,
          toStage: "견적",
          actorRole: "dealer",
          direction: "forward",
          createdAt: DEMO_SEED_CREATED_AT,
        },
        {
          id: "EVT-DEMO-0021",
          fromStage: "견적",
          toStage: "시공예약",
          actorRole: "shop",
          direction: "forward",
          createdAt: DEMO_SEED_CREATED_AT,
        },
        {
          id: "EVT-DEMO-0022",
          fromStage: "시공예약",
          toStage: "입고",
          actorRole: "shop",
          direction: "forward",
          createdAt: seedDateAt(-6, 9),
        },
        {
          id: "EVT-DEMO-0023",
          fromStage: "입고",
          toStage: "작업완료",
          actorRole: "shop",
          direction: "forward",
          createdAt: seedDateAt(0, 6),
        },
      ],
    },
  ];
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
