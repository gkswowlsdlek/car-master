"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, Camera, CarFront, CheckCircle2, Clock3, MessageSquareText, PackageCheck, PlayCircle, WalletCards, Wrench } from "lucide-react";
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
  const metrics = [
    { label: "응답 대기", value: transactions.filter((item) => item.status.stage === "접수").length, description: "지금 확인할 신규 요청", tone: "urgent", icon: MessageSquareText },
    { label: "오늘 입고", value: transactions.filter((item) => inRange(scheduleDate(item), "오늘")).length, description: "오늘 예정된 차량", tone: "today", icon: CalendarDays },
    { label: "진행 중", value: transactions.filter((item) => ["입고", "시공중"].includes(item.status.stage)).length, description: "현재 작업 중인 차량", tone: "active", icon: Wrench },
    { label: "완료 예정", value: transactions.filter((item) => item.status.stage === "시공중").length, description: "완료 확인이 필요한 작업", tone: "complete", icon: PackageCheck },
    { label: "미정산", value: transactions.filter((item) => item.status.stage === "완료" && item.pricing.paymentStatus !== "정산완료").length, description: "결제·정산 확인 필요", tone: "waiting", icon: WalletCards },
  ];
  const quickActions = [{ label: "요청 확인", icon: MessageSquareText }, { label: "작업 시작", icon: PlayCircle }, { label: "사진 등록", icon: Camera }, { label: "완료 처리", icon: CheckCircle2 }];

  return <section className="shop-dashboard section role-home role-home-shop">
    <header className="workspace-heading installer-heading"><div><p className="eyebrow">오늘의 시공 업무</p><h1>지금 처리할 작업부터<br />빠르게 확인하세요.</h1><p>응답 대기, 입고 일정과 지연 작업을 우선순위로 정리했습니다.</p></div><button className="primary" onClick={onOpenTransactions}><MessageSquareText size={18} /> 거래 관리 열기</button></header>
    <div className="shop-metric-grid shop-operations-metrics">{metrics.map((metric) => <button key={metric.label} className={`shop-metric-card ${metric.tone}`} onClick={onOpenTransactions}><i><metric.icon size={21} /></i><span>{metric.label}</span><b>{metric.value}<small>건</small></b><em>{metric.description}</em></button>)}</div>
    <section className="shop-quick-work card"><div><div><p className="eyebrow">빠른 작업</p><h2>자주 하는 업무</h2></div><span>거래를 선택한 뒤 해당 작업을 처리할 수 있습니다.</span></div><nav>{quickActions.map((action, index) => <button className={index === 0 ? "primary" : "secondary"} key={action.label} onClick={onOpenTransactions}><action.icon size={17} />{action.label}</button>)}</nav></section>
    {transactions.length === 0 ? <section className="empty-state shop-empty"><span>✓</span><h2>현재 접수된 거래가 없습니다.</h2><p>새 시공 요청이 도착하면 업무 우선순위와 오늘 일정에 표시됩니다.</p></section> : <div className="installer-workspace-grid">
      <section className="card installer-today-work"><header><div><p className="eyebrow">작업 일정</p><h2><Clock3 size={21} /> 오늘 일정</h2></div><div className="schedule-range-tabs">{(["오늘", "내일", "이번 주"] as const).map((item) => <button className={range === item ? "active" : ""} key={item} onClick={() => setRange(item)}>{item}</button>)}</div></header>
        {workItems.length === 0 ? <div className="compact-empty"><b>{range} 예정 작업이 없습니다.</b><span>일정이 확정되면 작업 목록에 표시됩니다.</span></div> : <div className="installer-work-list">{workItems.map((item) => { const delayed = (dayDifference(scheduleDate(item)) ?? 0) < 0; return <button className={delayed ? "delayed" : ""} key={item.id} onClick={() => onOpenTransaction(item.id)}><time>{timeLabel(scheduleDate(item))}</time><i><CarFront size={20} /></i><span><b>{item.vehicle.maker} {item.vehicle.model}</b><small>{item.service.brand && `${item.service.brand} · `}{item.service.workDescription}</small><em>{item.pricing.paymentStatus} · 딜러 {item.dealerId}</em></span><strong>{delayed && <mark className="delay-chip">지연</mark>}<mark className={`status-chip status-${item.status.stage}`}>{item.status.stage}</mark><small>{nextAction(item.status.stage)} →</small></strong></button>; })}</div>}
      </section>
      <aside className="installer-side-stack"><section className="card installer-request-queue priority-queue"><header><div><p className="eyebrow">우선 처리</p><h2><AlertTriangle size={19} /> 긴급·지연 작업</h2></div><b>{priority.length}</b></header>{priority.slice(0, 5).map((item) => <button key={item.id} onClick={() => onOpenTransaction(item.id)}><span><b>{item.vehicle.maker} {item.vehicle.model}</b><small>{item.status.stage === "접수" ? "응답 대기 요청" : "예정일 경과"} · {item.service.workDescription}</small></span><em>{scheduleDate(item) ?? "일정 미정"}</em></button>)}{priority.length === 0 && <div className="compact-empty"><b>긴급하거나 지연된 작업이 없습니다.</b><span>현재 작업 일정이 정상입니다.</span></div>}</section>
        <section className="installer-notice"><CalendarDays size={20} /><div><b>작업 순서는 일정과 상태를 기준으로 정렬됩니다.</b><p>거래방에서 현재 단계와 다음 처리 작업을 확인하세요.</p></div></section></aside>
    </div>}
  </section>;
}
