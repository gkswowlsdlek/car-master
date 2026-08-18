"use client";

import { useMemo, useState } from "react";
import { Phone, PhoneOff, Search } from "lucide-react";
import type { Transaction, TransactionStage } from "../../types/transactions";
import { dealerStageIndex, dealerStageLabel, isTerminalOutcome } from "../../services/transaction-state-service";

const won = (value?: number) => (value == null ? undefined : `${value.toLocaleString("ko-KR")}원`);
const shortDate = (value?: string) =>
  value ? new Date(value).toLocaleDateString("ko-KR", { month: "short", day: "numeric" }) : undefined;
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

/* 세분 상태 드롭다운은 제거했다 — 탭(진행중/완료/종료)과 축이 겹쳤고(완료 탭
   = 출고 필터, 종료 탭 = 취소+시공불가), 딜러의 동시 진행 거래가 월 2~3건이라
   "진행중 안에서 작업 중만 보기" 세분이 쓰일 일이 없다. 거래량이 늘면 그때
   다시 넣는다. */

/* 상태 칩 색은 raw DB key가 아니라 딜러에게 보이는 4단계 기준으로 정한다.
   raw key 기준이면 같은 "입고 전"으로 접히는 견적(노랑)과 시공예약(파랑)이
   다른 색으로, 다른 단계인 시공예약(입고 전)과 입고(작업 중)가 같은 파랑으로
   나온다. 색 정의 자체(design-system.css)는 그대로 두고 단계별 대표 클래스만
   고른다: 입고 전=대기(warning), 작업 중=진행(primary), 작업 완료=success,
   출고=완결(ink). 취소/시공불가는 raw key가 곧 UI 상태라 그대로 쓴다. */
const STAGE_CHIP_CLASSES = ["status-견적", "status-입고", "status-작업완료", "status-출고"] as const;

function stageChipClass(stage: TransactionStage) {
  if (isTerminalOutcome(stage)) return `status-${stage}`;
  return STAGE_CHIP_CLASSES[dealerStageIndex(stage)];
}

/**
 * Dealer 거래관리 (Phase 6) — a browse-and-find surface only. Selecting a
 * transaction always hands off to the existing Room (거래방); this screen
 * intentionally has no inline detail pane and no stage/price/outcome
 * actions of its own — those already live in TransactionChatWorkspace.
 */
export function DealerTransactionManagementScreen({
  transactions,
  initialGroupFilter,
  onOpenTransaction,
  onNewRequest,
  onFindShop,
}: {
  transactions: Transaction[];
  /** One-shot initial group (Dashboard's "확인 대기" / "전체 보기" quick actions) — read once on mount only. */
  initialGroupFilter?: TransactionStage | "전체";
  onOpenTransaction: (id: string) => void;
  onNewRequest: () => void;
  onFindShop: () => void;
}) {
  const [group, setGroup] = useState<Group>(() => groupFromStage(initialGroupFilter ?? "전체"));
  const [query, setQuery] = useState("");

  const visible = useMemo(() => transactions.filter((item) => !item.visibility.hiddenByDealer), [transactions]);
  const counts = useMemo(
    () => ({
      전체: visible.length,
      진행중: visible.filter((item) => groupOf(item.status.stage) === "진행중").length,
      완료: visible.filter((item) => groupOf(item.status.stage) === "완료").length,
      종료: visible.filter((item) => groupOf(item.status.stage) === "종료").length,
    }),
    [visible],
  );

  const filtered = useMemo(
    () =>
      visible
        .filter((item) => group === "전체" || groupOf(item.status.stage) === group)
        .filter((item) => {
          const keyword = query.trim().toLowerCase();
          return (
            !keyword ||
            `${item.vehicle.maker} ${item.vehicle.model} ${item.installerName}`.toLowerCase().includes(keyword)
          );
        })
        // "최근 활동" = transactions.updated_at — touched server-side on every
        // stage change, final-price change, outcome change, and chat message
        // insert (set_transaction_room_updated_at trigger), the one timestamp
        // that reflects all of those rather than just one signal.
        .slice()
        .sort((a, b) => b.status.updatedAt.localeCompare(a.status.updatedAt)),
    [visible, group, query],
  );

  const empty = query.trim()
    ? { title: "검색 결과가 없습니다.", body: "차량, 시공점 이름으로 다시 검색해 보세요." }
    : visible.length === 0
      ? { title: "아직 진행 중인 거래가 없습니다.", body: "시공점을 찾아 첫 시공 요청을 시작해 보세요." }
      : group === "진행중"
        ? { title: "진행 중인 거래가 없습니다.", body: "" }
        : group === "완료"
          ? { title: "완료된 거래가 없습니다.", body: "" }
          : group === "종료"
            ? { title: "종료된 거래가 없습니다.", body: "" }
            : { title: "해당 조건의 거래가 없습니다.", body: "검색어나 필터를 확인해 주세요." };

  return (
    <section className="transaction-management-screen dealer-transaction-management">
      <div className="page-title transaction-page-title">
        <div>
          <p className="eyebrow">TRANSACTION WORKSPACE</p>
          <h1>거래 관리</h1>
          <p className="page-subtitle">진행 중인 차량과 거래를 빠르게 찾아 거래방으로 이동하세요.</p>
        </div>
        <button className="primary" onClick={onNewRequest}>
          + 새 시공 요청
        </button>
      </div>

      <div className="transaction-tabs dealer-deal-groups">
        {GROUPS.map((value) => (
          <button key={value} className={group === value ? "active" : ""} onClick={() => setGroup(value)}>
            {value} <em>{counts[value]}</em>
          </button>
        ))}
      </div>

      <div className="transaction-filters">
        <label className="search-field">
          <Search size={18} aria-hidden="true" />
          <input
            aria-label="거래 검색"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="차량, 시공점으로 검색"
          />
        </label>
      </div>

      {filtered.length === 0 ? (
        <section className="empty-state transaction-empty">
          <span>↗</span>
          <h2>{empty.title}</h2>
          {empty.body && <p>{empty.body}</p>}
          {visible.length === 0 && !query.trim() && (
            <button className="primary" onClick={onFindShop}>
              시공점 찾기
            </button>
          )}
        </section>
      ) : (
        <div className="dealer-transaction-list" role="list" aria-label="거래 작업 목록">
          <div className="dealer-transaction-table-head" aria-hidden="true">
            <span>차량 · 용품점</span>
            <span>상태</span>
            <span>일정</span>
            <span>최근 활동</span>
            <span>다음 행동</span>
          </div>
          {filtered.map((item) => {
            const terminal = isTerminalOutcome(item.status.stage);
            const inPhoneConfirmWindow = item.status.stage === "견적" || item.status.stage === "시공예약";
            const needsPhoneConfirm = inPhoneConfirmWindow && item.contactStatus == null;
            const contactUnreachable = item.contactStatus === "unreachable";
            const scheduled =
              !terminal && item.status.stage !== "출고"
                ? shortDate(item.schedule.confirmedInboundAt ?? item.schedule.requestedInboundAt)
                : undefined;
            const price = won(item.pricing.finalPrice);
            const nextAction = needsPhoneConfirm
              ? "전화 확인"
              : item.status.stage === "견적"
                ? "요청 확인"
                : item.status.stage === "출고"
                  ? "완료"
                  : terminal
                    ? "기록 보기"
                    : "거래방 열기";
            return (
              <button
                key={item.id}
                role="listitem"
                data-testid={`transaction-card-${item.id}`}
                data-stage={item.status.stage}
                aria-label={`${item.id} ${item.vehicle.maker} ${item.vehicle.model}`}
                className="dealer-transaction-row"
                onClick={() => onOpenTransaction(item.id)}
              >
                {/* 한 거래 = 한 행. 5열 grid — 차량·용품점(+마지막 메시지 둘째 줄) /
                    상태 / 일정 / 최근 활동 / 다음 행동. 마지막 메시지는 예전처럼
                    "다음 행동" 열에 얹지 않고(전부 같은 생성 메시지라 노이즈로
                    읽혔다) 메신저 인박스처럼 차량 아래 회색 한 줄로 둔다. */}
                <div className="dealer-transaction-row-main">
                  <b>
                    {item.vehicle.maker} {item.vehicle.model}
                  </b>
                  <span>
                    {item.installerName} · {item.service.product ?? item.service.workDescription}
                  </span>
                  {item.lastMessage && <em className="dealer-transaction-row-lastmessage">{item.lastMessage}</em>}
                </div>
                <div className="dealer-transaction-row-status">
                  <em className={`status-chip ${stageChipClass(item.status.stage)}`}>
                    {dealerStageLabel(item.status.stage)}
                  </em>
                  {needsPhoneConfirm && (
                    <small className="phone-confirm-flag">
                      <Phone size={11} aria-hidden="true" /> 전화 확인 필요
                    </small>
                  )}
                  {contactUnreachable && (
                    <small className="phone-confirm-flag phone-confirm-flag-unreachable">
                      <PhoneOff size={11} aria-hidden="true" /> 연락 안 됨
                    </small>
                  )}
                  {/* 확정 시공금액 — 읽기 전용 표기(편집은 거래방에서). */}
                  {price && <small className="dealer-transaction-row-price">{price}</small>}
                </div>
                <div className="dealer-transaction-row-schedule">
                  {scheduled ? (
                    <>
                      <small>입고</small>
                      <b>{scheduled}</b>
                    </>
                  ) : (
                    <b className="dealer-transaction-row-blank" aria-label="일정 없음">
                      —
                    </b>
                  )}
                </div>
                <div className="dealer-transaction-row-activity-cell">
                  <small>활동</small>
                  <b>{activityTime(item.status.updatedAt)}</b>
                </div>
                <strong className="dealer-transaction-row-next">
                  {nextAction} <span aria-hidden="true">→</span>
                </strong>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
