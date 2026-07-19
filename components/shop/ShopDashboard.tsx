"use client";

import { useMemo, useState } from "react";
import { CalendarDays, CarFront, CheckCircle2, Clock3, MessageSquareText, PackageCheck, Wrench } from "lucide-react";
import type { Transaction } from "../../types/transactions";

type ScheduleRange = "오늘" | "내일" | "이번 주";

function scheduleDate(item: Transaction) { return item.schedule.confirmedInboundAt ?? item.schedule.requestedInboundAt; }
function startOfDay(value: Date) { return new Date(value.getFullYear(), value.getMonth(), value.getDate()); }
function inRange(value: string | undefined, range: ScheduleRange) {
  if (!value) return false;
  const target = startOfDay(new Date(value));
  const today = startOfDay(new Date());
  const difference = Math.round((target.getTime() - today.getTime()) / 86400000);
  return range === "오늘" ? difference === 0 : range === "내일" ? difference === 1 : difference >= 0 && difference <= 7;
}
function timeLabel(value?: string) {
  if (!value) return "시간 미정";
  const date = new Date(value);
  return value.includes("T") && !Number.isNaN(date.getTime()) ? date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) : "시간 미정";
}
function nextAction(stage: Transaction["status"]["stage"]) {
  return stage === "접수" ? "요청 확인" : stage === "입고예정" ? "입고 확인" : stage === "입고" ? "시공 시작" : stage === "시공중" ? "완료 처리" : "거래 보기";
}

export function ShopDashboard({ transactions, onOpenTransactions, onOpenTransaction }: { transactions: Transaction[]; onOpenTransactions: () => void; onOpenTransaction: (id: string) => void }) {
  const [range, setRange] = useState<ScheduleRange>("오늘");
  const active = useMemo(() => transactions.filter((item) => !["완료", "취소"].includes(item.status.stage)).sort((a, b) => (scheduleDate(a) ?? a.status.createdAt).localeCompare(scheduleDate(b) ?? b.status.createdAt)), [transactions]);
  const scheduled = active.filter((item) => inRange(scheduleDate(item), range));
  const workItems = scheduled.length > 0 ? scheduled : range === "오늘" ? active.slice(0, 5) : [];
  const metrics = [
    { label: "오늘 입고 예정", value: transactions.filter((item) => inRange(scheduleDate(item), "오늘")).length, description: "오늘 확인할 입고 일정", tone: "today", icon: CalendarDays },
    { label: "현재 시공 중", value: transactions.filter((item) => item.status.stage === "시공중").length, description: "작업이 진행 중인 차량", tone: "active", icon: Wrench },
    { label: "출고 대기", value: 0, description: "상태 모델 확장 후 자동 집계", tone: "waiting", icon: PackageCheck },
    { label: "오늘 완료", value: transactions.filter((item) => item.status.stage === "완료" && inRange(item.schedule.completedAt, "오늘")).length, description: "오늘 완료 처리한 작업", tone: "complete", icon: CheckCircle2 },
  ];

  return <section className="shop-dashboard section">
    <header className="workspace-heading installer-heading"><div><p className="eyebrow">INSTALLER WORKSPACE 2.0</p><h1>오늘 해야 할 작업을<br />한눈에 확인하세요.</h1><p>입고 일정부터 시공 상태와 거래 대화까지 하나의 워크스페이스에서 관리합니다.</p></div><button className="primary" onClick={onOpenTransactions}><MessageSquareText size={18} /> 거래방 열기</button></header>
    <div className="shop-metric-grid">{metrics.map((metric) => <button key={metric.label} className={`shop-metric-card ${metric.tone}`} onClick={onOpenTransactions}><i><metric.icon size={21} /></i><span>{metric.label}</span><b>{metric.value}<small>건</small></b><em>{metric.description}</em></button>)}</div>
    {transactions.length === 0 ? <section className="empty-state shop-empty"><span>✓</span><h2>현재 접수된 거래가 없습니다.</h2><p>새 시공 요청이 도착하면 오늘의 작업과 신규 요청 목록에 바로 표시됩니다.</p></section> : <div className="installer-workspace-grid">
      <section className="card installer-today-work"><header><div><p className="eyebrow">TODAY&apos;S WORK</p><h2><Clock3 size={21} /> 오늘의 작업</h2></div><div className="schedule-range-tabs">{(["오늘", "내일", "이번 주"] as const).map((item) => <button className={range === item ? "active" : ""} key={item} onClick={() => setRange(item)}>{item}</button>)}</div></header>
        {workItems.length === 0 ? <div className="compact-empty"><b>{range} 예정 작업이 없습니다.</b><span>일정이 확정되면 날짜별 작업 목록에 표시됩니다.</span></div> : <div className="installer-work-list">{workItems.map((item) => <button key={item.id} onClick={() => onOpenTransaction(item.id)}><time>{timeLabel(scheduleDate(item))}</time><i><CarFront size={20} /></i><span><b>{item.vehicle.maker} {item.vehicle.model}</b><small>{item.service.brand && `${item.service.brand} · `}{item.service.workDescription}</small><em>차량번호 미등록 · 딜러 {item.dealerId}</em></span><strong><mark className={`status-chip status-${item.status.stage}`}>{item.status.stage}</mark><small>{nextAction(item.status.stage)} →</small></strong></button>)}</div>}
      </section>
      <aside className="installer-side-stack"><section className="card installer-request-queue"><header><div><p className="eyebrow">NEW REQUESTS</p><h2>신규 시공 요청</h2></div><b>{transactions.filter((item) => item.status.stage === "접수").length}</b></header>{transactions.filter((item) => item.status.stage === "접수").slice(0, 4).map((item) => <button key={item.id} onClick={() => onOpenTransaction(item.id)}><span><b>{item.vehicle.maker} {item.vehicle.model}</b><small>{item.service.workDescription}</small></span><em>{scheduleDate(item) ?? "희망일 미정"}</em></button>)}{transactions.every((item) => item.status.stage !== "접수") && <div className="compact-empty"><b>확인할 신규 요청이 없습니다.</b><span>새 요청이 도착하면 여기에 표시됩니다.</span></div>}</section>
        <section className="installer-notice"><CalendarDays size={20} /><div><b>작업 일정은 거래 데이터와 연결됩니다.</b><p>수락·거절과 출고 대기 상태는 실제 API 연결 단계에서 확장할 예정입니다.</p></div></section></aside>
    </div>}
  </section>;
}
