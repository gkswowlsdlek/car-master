"use client";

import { useMemo, useState } from "react";
import { Phone, PhoneOff, Search } from "lucide-react";
import type { Transaction, TransactionStage } from "../../types/transactions";
import { dealerStageLabel, isTerminalOutcome } from "../../services/transaction-state-service";

const won = (value?: number) => (value == null ? undefined : `${value.toLocaleString("ko-KR")}원`);
const shortDate = (value?: string) => value ? new Date(value).toLocaleDateString("ko-KR", { month: "short", day: "numeric" }) : undefined;
const activityTime = (value: string) => {
  const date = new Date(value);
  const sameDay = date.toDateString() === new Date().toDateString();
  return sameDay
    ? date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
};

type Group = "전체" | "진행중" | "완료" | "종료";
const GROUPS: Group[] = ["전체", "진행중", "완료", "종료"];

function groupOf(stage: TransactionStage): Exclude<Group, "전체"> {
  if (isTerminalOutcome(stage)) return "종료";
  if (stage === "출고") return "완료";
  return "진행중";
}

/** Dashboard quick-actions deep-link with a raw internal stage key (e.g.
 * "견적" for the "확인 대기" banner) — collapse it to the matching group so
 * this screen never needs to expose that granularity to the dealer. */
function groupFromStage(stage: TransactionStage | "전체"): Group {
  return stage === "전체" ? "전체" : groupOf(stage);
}

const STATUS_FILTER_OPTIONS = ["전체", "입고 전", "작업 중", "작업 완료", "출고", "취소", "시공 불가"] as const;
type StatusFilter = (typeof STATUS_FILTER_OPTIONS)[number];

function matchesStatusFilter(stage: TransactionStage, filter: StatusFilter) {
  if (filter === "전체") return true;
  if (filter === "시공 불가") return stage === "시공불가";
  return dealerStageLabel(stage) === filter;
}

/**
 * Dealer 거래관리 (Phase 6) — a browse-and-find surface only. Selecting a
 * transaction always hands off to the existing Room (거래방); this screen
 * intentionally has no inline detail pane and no stage/price/outcome
 * actions of its own — those already live in TransactionChatWorkspace.
 */
export function DealerTransactionManagementScreen({ transactions, initialGroupFilter, onOpenTransaction, onNewRequest, onFindShop }: {
  transactions: Transaction[];
  /** One-shot initial group (Dashboard's "확인 대기" / "전체 보기" quick actions) — read once on mount only. */
  initialGroupFilter?: TransactionStage | "전체";
  onOpenTransaction: (id: string) => void;
  onNewRequest: () => void;
  onFindShop: () => void;
}) {
  const [group, setGroup] = useState<Group>(() => groupFromStage(initialGroupFilter ?? "전체"));
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("전체");
  const [query, setQuery] = useState("");

  const visible = useMemo(() => transactions.filter((item) => !item.visibility.hiddenByDealer), [transactions]);
  const counts = useMemo(() => ({
    전체: visible.length,
    진행중: visible.filter((item) => groupOf(item.status.stage) === "진행중").length,
    완료: visible.filter((item) => groupOf(item.status.stage) === "완료").length,
    종료: visible.filter((item) => groupOf(item.status.stage) === "종료").length,
  }), [visible]);

  const filtered = useMemo(() => visible
    .filter((item) => group === "전체" || groupOf(item.status.stage) === group)
    .filter((item) => matchesStatusFilter(item.status.stage, statusFilter))
    .filter((item) => {
      const keyword = query.trim().toLowerCase();
      return !keyword || `${item.vehicle.maker} ${item.vehicle.model} ${item.installerName}`.toLowerCase().includes(keyword);
    })
    // "최근 활동" = transactions.updated_at — touched server-side on every
    // stage change, final-price change, outcome change, and chat message
    // insert (set_transaction_room_updated_at trigger), the one timestamp
    // that reflects all of those rather than just one signal.
    .slice()
    .sort((a, b) => b.status.updatedAt.localeCompare(a.status.updatedAt)),
    [visible, group, statusFilter, query]);

  const empty = query.trim()
    ? { title: "검색 결과가 없습니다.", body: "차량, 시공점 이름으로 다시 검색해 보세요." }
    : visible.length === 0
      ? { title: "아직 진행 중인 거래가 없습니다.", body: "시공점을 찾아 첫 시공 요청을 시작해 보세요." }
      : group === "진행중" ? { title: "진행 중인 거래가 없습니다.", body: "" }
      : group === "완료" ? { title: "완료된 거래가 없습니다.", body: "" }
      : group === "종료" ? { title: "종료된 거래가 없습니다.", body: "" }
      : { title: "해당 조건의 거래가 없습니다.", body: "검색어나 필터를 확인해 주세요." };

  return <section className="transaction-management-screen dealer-transaction-management">
    <div className="page-title transaction-page-title">
      <div><p className="eyebrow">TRANSACTION WORKSPACE</p><h1>거래 관리</h1><p className="page-subtitle">진행 중인 차량과 거래를 빠르게 찾아 거래방으로 이동하세요.</p></div>
      <button className="primary" onClick={onNewRequest}>+ 새 시공 요청</button>
    </div>

    <div className="transaction-tabs dealer-deal-groups">
      {GROUPS.map((value) => <button key={value} className={group === value ? "active" : ""} onClick={() => setGroup(value)}>{value} <em>{counts[value]}</em></button>)}
    </div>

    <div className="transaction-filters">
      <label className="search-field">
        <Search size={18} aria-hidden="true" />
        <input aria-label="거래 검색" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="차량, 시공점으로 검색" />
      </label>
      <select aria-label="작업 상태 필터" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
        {STATUS_FILTER_OPTIONS.map((option) => <option key={option} value={option}>{option === "전체" ? "전체 상태" : option}</option>)}
      </select>
    </div>

    {filtered.length === 0
      ? <section className="empty-state transaction-empty">
          <span>↗</span>
          <h2>{empty.title}</h2>
          {empty.body && <p>{empty.body}</p>}
          {visible.length === 0 && !query.trim() && <button className="primary" onClick={onFindShop}>시공점 찾기</button>}
        </section>
      : <div className="dealer-transaction-list">
          {filtered.map((item) => {
            const terminal = isTerminalOutcome(item.status.stage);
            const inPhoneConfirmWindow = item.status.stage === "견적" || item.status.stage === "시공예약";
            const needsPhoneConfirm = inPhoneConfirmWindow && item.contactStatus == null;
            const contactUnreachable = item.contactStatus === "unreachable";
            const scheduled = !terminal && item.status.stage !== "출고" ? shortDate(item.schedule.confirmedInboundAt ?? item.schedule.requestedInboundAt) : undefined;
            const price = won(item.pricing.finalPrice);
            return <button key={item.id} data-testid={`transaction-card-${item.id}`} aria-label={`${item.id} ${item.vehicle.maker} ${item.vehicle.model}`} className="dealer-transaction-row" onClick={() => onOpenTransaction(item.id)}>
              <div className="dealer-transaction-row-main">
                <b>{item.vehicle.maker} {item.vehicle.model}</b>
                <span>{item.installerName} · {item.service.product ?? item.service.workDescription}</span>
              </div>
              <div className="dealer-transaction-row-meta">
                <em className={`status-chip status-${item.status.stage}`}>{dealerStageLabel(item.status.stage)}</em>
                {needsPhoneConfirm && <small className="phone-confirm-flag"><Phone size={11} aria-hidden="true" /> 전화 확인 필요</small>}
                {contactUnreachable && <small className="phone-confirm-flag phone-confirm-flag-unreachable"><PhoneOff size={11} aria-hidden="true" /> 연락 안 됨</small>}
                {scheduled && <small>입고 예정 {scheduled}</small>}
                {price && <small>{price}</small>}
                <small className="dealer-transaction-row-activity">{activityTime(item.status.updatedAt)}</small>
              </div>
              {item.lastMessage && <em className="dealer-transaction-row-lastmessage">{item.lastMessage}</em>}
            </button>;
          })}
        </div>}
  </section>;
}
