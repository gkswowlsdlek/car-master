"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, CarFront, CheckCircle2, Clock3, MessageCircle, Wrench } from "lucide-react";
import type { ChatRoom, Transaction, TransactionStage } from "../../types/transactions";
import { nextForwardStage, STAGE_ACTION_LABEL } from "../../services/transaction-state-service";
import { defaultDealerCompanyName } from "../profile/ProfileEditor";

// The Demo dealer's company name is safe to show eagerly — it's a fixed,
// non-sensitive fixture value already used elsewhere (sidebar company name),
// not a lookup against real profile data. There is no equivalent safe path
// for Real dealers yet: the only RPC that resolves a counterpart's name
// (get_transaction_contact) is deliberately gated behind an explicit "연락처
// 확인" action, not meant to be called eagerly for every visible card, so
// Real transactions keep the generic "담당 딜러" label — see v0.3.13 TODO.
function dealerLabel(dealerId: string) {
  return dealerId === "hanjaejin-dealer" ? defaultDealerCompanyName : "담당 딜러";
}

function scheduleDate(item: Transaction) {
  return item.schedule.confirmedInboundAt ?? item.schedule.requestedInboundAt;
}
function isToday(value?: string) {
  if (!value) return false;
  const date = new Date(value);
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}
function timeLabel(value?: string) {
  if (!value) return "시간 미정";
  const date = new Date(value);
  return value.includes("T") && !Number.isNaN(date.getTime())
    ? date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
    : "시간 미정";
}
function serviceLabel(item: Transaction) {
  return item.service.brand
    ? `${item.service.brand} · ${item.service.workDescription}`
    : item.service.workDescription || "시공 품목 미정";
}
const won = (value?: number) => (value == null ? "미확정" : `${value.toLocaleString("ko-KR")}원`);

export function ShopDashboard({
  transactions,
  rooms,
  onOpenTransaction,
  onOpenMessage,
  onStageChange,
}: {
  transactions: Transaction[];
  rooms: ChatRoom[];
  onOpenTransaction: (id: string) => void;
  /** Jumps straight to this transaction's Messenger room — the Dashboard's only Messenger entry point, not a chat surface of its own. */
  onOpenMessage: (id: string) => void;
  onStageChange: (transaction: Transaction, stage: TransactionStage) => Promise<void>;
}) {
  const [advancingId, setAdvancingId] = useState("");

  const visible = useMemo(() => transactions.filter((item) => !item.visibility.hiddenByInstaller), [transactions]);
  const inboundToday = useMemo(
    () =>
      visible
        .filter((item) => item.status.stage === "시공예약" && isToday(scheduleDate(item)))
        .sort((a, b) => (scheduleDate(a) ?? "").localeCompare(scheduleDate(b) ?? "")),
    [visible],
  );
  const inProgress = useMemo(
    () =>
      visible
        .filter((item) => item.status.stage === "입고")
        .sort((a, b) => (scheduleDate(a) ?? "").localeCompare(scheduleDate(b) ?? "")),
    [visible],
  );
  const pendingReview = useMemo(() => visible.filter((item) => item.status.stage === "견적"), [visible]);
  // Transaction data has no explicit "acknowledged" flag, so 새 요청 vs 응답
  // 대기 is inferred from whether this shop has sent any message in the
  // room yet — a request the shop has already replied to but not yet
  // advanced to 시공예약 reads as 응답 대기, not 새 요청.
  const newRequests = useMemo(
    () =>
      pendingReview.filter(
        (item) =>
          !rooms.find((room) => room.id === item.chatRoomId)?.messages.some((message) => message.senderRole === "shop"),
      ),
    [pendingReview, rooms],
  );
  const awaitingResponse = useMemo(
    () => pendingReview.filter((item) => !newRequests.some((request) => request.id === item.id)),
    [pendingReview, newRequests],
  );
  const completedToday = useMemo(
    () =>
      visible
        .filter((item) => item.status.stage === "작업완료" && isToday(item.schedule.completedAt))
        .sort((a, b) => (b.schedule.completedAt ?? "").localeCompare(a.schedule.completedAt ?? "")),
    [visible],
  );

  const summary = [
    { label: "오늘 입고", value: inboundToday.length, icon: CalendarDays, tone: "today" },
    { label: "작업 중", value: inProgress.length, icon: Wrench, tone: "active" },
    { label: "새 요청", value: newRequests.length, icon: AlertTriangle, tone: "urgent" },
    { label: "확인 필요", value: awaitingResponse.length, icon: Clock3, tone: "waiting" },
    { label: "오늘 완료", value: completedToday.length, icon: CheckCircle2, tone: "complete" },
  ];
  const nothingToDo = summary.every((item) => item.value === 0);

  const advance = async (transaction: Transaction) => {
    const next = nextForwardStage(transaction.status.stage);
    if (!next || advancingId) return;
    setAdvancingId(transaction.id);
    try {
      await onStageChange(transaction, next);
    } finally {
      setAdvancingId("");
    }
  };

  return (
    <section className="installer-dashboard section role-home role-home-shop">
      <header className="page-title">
        <div>
          <p className="eyebrow">SHOP WORKSPACE</p>
          <h1>홈</h1>
          <p className="page-subtitle">입고 예정, 작업 중인 차량, 새 요청을 우선순위로 정리했습니다.</p>
        </div>
      </header>

      <div className="installer-priority-strip">
        {summary.map((item) => (
          <div key={item.label} className={`installer-priority-item tone-${item.tone}`}>
            <i>
              <item.icon size={18} />
            </i>
            <span>{item.label}</span>
            <b>{item.value}</b>
          </div>
        ))}
      </div>

      {nothingToDo && (
        <section className="empty-state shop-empty">
          <span>✓</span>
          <h2>현재 처리할 작업이 없습니다.</h2>
          <p>새 시공 요청이 들어오면 여기에 표시됩니다.</p>
        </section>
      )}

      {inboundToday.length > 0 && (
        <section className="today-list-card installer-inbound-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">오늘 입고</p>
              <h2>
                <CalendarDays size={20} /> 오늘 입고 {inboundToday.length}대
              </h2>
            </div>
          </div>
          <div className="installer-card-list">
            {inboundToday.map((item) => (
              <article key={item.id} className="installer-vehicle-card">
                <button className="installer-vehicle-main" onClick={() => onOpenTransaction(item.id)}>
                  <time>{timeLabel(scheduleDate(item))}</time>
                  <b>
                    <CarFront size={16} /> {item.vehicle.maker} {item.vehicle.model}
                  </b>
                  <small>
                    딜러: {dealerLabel(item.dealerId)} · {serviceLabel(item)}
                  </small>
                  <em className={`status-chip status-${item.status.stage}`}>{item.status.stage}</em>
                </button>
                <div className="installer-vehicle-actions">
                  <button className="secondary" onClick={() => onOpenMessage(item.id)} aria-label="메시지 열기">
                    <MessageCircle size={16} />
                  </button>
                  <button
                    className="primary"
                    disabled={advancingId === item.id}
                    aria-busy={advancingId === item.id}
                    onClick={() => void advance(item)}
                  >
                    {STAGE_ACTION_LABEL["입고"]}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {inProgress.length > 0 && (
        <section className="today-list-card installer-progress-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">작업 중</p>
              <h2>
                <Wrench size={20} /> 작업 중 {inProgress.length}대
              </h2>
            </div>
          </div>
          <div className="installer-card-list">
            {inProgress.map((item) => (
              <article key={item.id} className="installer-vehicle-card">
                <button className="installer-vehicle-main" onClick={() => onOpenTransaction(item.id)}>
                  <time>{timeLabel(scheduleDate(item))} 입고</time>
                  <b>
                    <CarFront size={16} /> {item.vehicle.maker} {item.vehicle.model}
                  </b>
                  <small>
                    딜러: {dealerLabel(item.dealerId)} · {serviceLabel(item)}
                  </small>
                  <em className={`status-chip status-${item.status.stage}`}>{item.status.stage}</em>
                </button>
                <div className="installer-vehicle-actions">
                  <button className="secondary" onClick={() => onOpenMessage(item.id)} aria-label="메시지 열기">
                    <MessageCircle size={16} />
                  </button>
                  <button
                    className="primary"
                    disabled={advancingId === item.id}
                    aria-busy={advancingId === item.id}
                    onClick={() => void advance(item)}
                  >
                    {STAGE_ACTION_LABEL["작업완료"]}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {newRequests.length > 0 && (
        <section className="today-list-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">새 요청</p>
              <h2>
                <AlertTriangle size={20} /> 새 요청 {newRequests.length}건
              </h2>
            </div>
          </div>
          <div>
            {newRequests.map((item) => (
              <button key={item.id} onClick={() => onOpenMessage(item.id)}>
                <span>
                  <b>
                    {item.vehicle.maker} {item.vehicle.model}
                  </b>
                  <small>{serviceLabel(item)}</small>
                </span>
                <em>확인하기 →</em>
              </button>
            ))}
          </div>
        </section>
      )}

      {awaitingResponse.length > 0 && (
        <section className="today-list-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">확인 필요</p>
              <h2>
                <Clock3 size={20} /> 확인 필요 {awaitingResponse.length}건
              </h2>
            </div>
          </div>
          <div>
            {awaitingResponse.map((item) => (
              <button key={item.id} onClick={() => onOpenTransaction(item.id)}>
                <span>
                  <b>
                    {item.vehicle.maker} {item.vehicle.model}
                  </b>
                  <small>{serviceLabel(item)} · 시공예약 확정이 필요해요</small>
                </span>
                <em>{STAGE_ACTION_LABEL["시공예약"]} →</em>
              </button>
            ))}
          </div>
        </section>
      )}

      {completedToday.length > 0 && (
        <section className="today-list-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">오늘 완료</p>
              <h2>
                <CheckCircle2 size={20} /> 오늘 완료 {completedToday.length}대
              </h2>
            </div>
          </div>
          <div>
            {completedToday.map((item) => (
              <button key={item.id} onClick={() => onOpenTransaction(item.id)}>
                <span>
                  <b>
                    {item.vehicle.maker} {item.vehicle.model}
                  </b>
                  <small>{serviceLabel(item)}</small>
                </span>
                <em>{item.pricing.finalPrice ? won(item.pricing.finalPrice) : "최종 시공금액 입력 필요"}</em>
              </button>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}
