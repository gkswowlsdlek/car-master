"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, CarFront, Clock3, MessageSquareText } from "lucide-react";
import type { Transaction } from "../../types/transactions";

type ScheduleRange = "오늘" | "내일" | "이번 주";
function scheduleDate(item: Transaction) { return item.schedule.confirmedInboundAt ?? item.schedule.requestedInboundAt; }
function dayDifference(value?: string) { if (!value) return null; const date = new Date(value); const today = new Date(); return Math.floor((new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86400000); }
function inRange(value: string | undefined, range: ScheduleRange) { const difference = dayDifference(value); return difference !== null && (range === "오늘" ? difference === 0 : range === "내일" ? difference === 1 : difference >= 0 && difference <= 7); }
function timeLabel(value?: string) { if (!value) return "미정"; const date = new Date(value); return value.includes("T") && !Number.isNaN(date.getTime()) ? date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) : "미정"; }
function nextAction(stage: Transaction["status"]["stage"]) { return stage === "접수" ? "요청 확인" : stage === "입고예정" ? "입고 확인" : stage === "입고" ? "작업 시작" : stage === "시공중" ? "완료 처리" : "거래 보기"; }

export function ShopDashboard({ transactions, onOpenTransactions, onOpenTransaction }: { transactions: Transaction[]; onOpenTransactions: () => void; onOpenTransaction: (id: string) => void }) {
  const [range, setRange] = useState<ScheduleRange>("오늘");
  const active = useMemo(() => transactions.filter((item) => !["완료", "취소"].includes(item.status.stage)).sort((a, b) => (scheduleDate(a) ?? a.status.createdAt).localeCompare(scheduleDate(b) ?? b.status.createdAt)), [transactions]);
  const priority = active.filter((item) => item.status.stage === "접수" || (dayDifference(scheduleDate(item)) ?? 0) < 0);
  const scheduled = active.filter((item) => inRange(scheduleDate(item), range));
  const workItems = scheduled.length ? scheduled : range === "오늘" ? active.slice(0, 5) : [];

  const todayCount = transactions.filter((item) => inRange(scheduleDate(item), "오늘")).length;
  const inProgressCount = transactions.filter((item) => ["입고", "시공중"].includes(item.status.stage)).length;
  const dueSoonCount = transactions.filter((item) => item.status.stage === "시공중").length;
  const unsettledCount = transactions.filter((item) => item.status.stage === "완료" && item.pricing.paymentStatus !== "정산완료").length;

  return <section className="queue role-home role-home-shop">
    <header className="queue-head">
      <div><p className="eyebrow">오늘의 업무 큐</p><h1>{priority.length > 0 ? `지금 처리할 작업 ${priority.length}건` : "오늘 할 일이 정리됐어요"}</h1></div>
      <button className="primary" onClick={onOpenTransactions}><MessageSquareText size={17} /> 거래 관리 열기</button>
    </header>

    <div className="queue-stat-row">
      <button onClick={onOpenTransactions}><b>{todayCount}</b><span>오늘 입고</span></button>
      <button onClick={onOpenTransactions}><b>{inProgressCount}</b><span>진행 중</span></button>
      <button onClick={onOpenTransactions}><b>{dueSoonCount}</b><span>완료 예정</span></button>
      <button onClick={onOpenTransactions}><b>{unsettledCount}</b><span>미정산</span></button>
    </div>

    {transactions.length === 0 ? <section className="queue-empty">
      <h2>현재 접수된 거래가 없어요</h2>
      <p>새 시공 요청이 도착하면 업무 큐에 바로 표시됩니다.</p>
    </section> : <>
      {priority.length > 0 && <section className="queue-priority">
        <h2><AlertTriangle size={16} /> 지금 확인해야 할 작업</h2>
        <div className="queue-tickets">{priority.slice(0, 4).map((item) => <button className="queue-ticket" key={item.id} onClick={() => onOpenTransaction(item.id)}>
          <span className="queue-ticket-flag">{item.status.stage === "접수" ? "응답 대기" : "예정일 경과"}</span>
          <span className="queue-ticket-main"><b>{item.vehicle.maker} {item.vehicle.model}</b><small>{item.service.workDescription}</small></span>
          <em>{nextAction(item.status.stage)} <ArrowRight size={13} /></em>
        </button>)}</div>
      </section>}

      <section className="queue-today">
        <header><h2><Clock3 size={17} /> 오늘 일정</h2><div className="queue-range-tabs">{(["오늘", "내일", "이번 주"] as const).map((item) => <button className={range === item ? "active" : ""} key={item} onClick={() => setRange(item)}>{item}</button>)}</div></header>
        {workItems.length === 0 ? <p className="queue-today-empty">{range} 예정 작업이 없어요.</p> : <div className="queue-today-list">{workItems.map((item) => { const delayed = (dayDifference(scheduleDate(item)) ?? 0) < 0; return <button className={delayed ? "delayed" : ""} key={item.id} onClick={() => onOpenTransaction(item.id)}>
          <time>{timeLabel(scheduleDate(item))}</time>
          <CarFront size={17} aria-hidden="true" />
          <span><b>{item.vehicle.maker} {item.vehicle.model}</b><small>{item.service.brand && `${item.service.brand} · `}{item.service.workDescription}</small></span>
          <em className={`status-chip status-${item.status.stage}`}>{item.status.stage}</em>
        </button>; })}</div>}
      </section>
    </>}
  </section>;
}
