import { CalendarClock, CheckCircle2, CircleAlert, Clock3, Wrench } from "lucide-react";
import type { Transaction } from "../../types/transactions";

function isToday(value?: string) {
  if (!value) return false;
  const target = new Date(value);
  const today = new Date();
  return target.getFullYear() === today.getFullYear() && target.getMonth() === today.getMonth() && target.getDate() === today.getDate();
}

export function ShopDashboard({ transactions, onOpenTransactions, onOpenTransaction }: { transactions: Transaction[]; onOpenTransactions: () => void; onOpenTransaction: (id: string) => void }) {
  const sorted = [...transactions].sort((a, b) => b.status.updatedAt.localeCompare(a.status.updatedAt));
  const metrics = [
    { label: "신규 요청", value: transactions.filter((item) => item.status.stage === "접수").length, description: "확인과 응답이 필요합니다", tone: "urgent", icon: CircleAlert },
    { label: "오늘 입고", value: transactions.filter((item) => isToday(item.schedule.confirmedInboundAt ?? item.schedule.requestedInboundAt)).length, description: "오늘 예정된 차량입니다", tone: "today", icon: CalendarClock },
    { label: "진행 중", value: transactions.filter((item) => ["입고예정", "입고", "시공중"].includes(item.status.stage)).length, description: "현재 작업 중인 거래입니다", tone: "active", icon: Wrench },
    { label: "완료 거래", value: transactions.filter((item) => item.status.stage === "완료").length, description: "누적 완료된 거래입니다", tone: "complete", icon: CheckCircle2 },
  ];
  const nextAction = (item: Transaction) => item.status.stage === "접수" ? "요청 확인" : item.status.stage === "입고예정" ? "입고 확인" : item.status.stage === "입고" ? "시공 시작" : item.status.stage === "시공중" ? "완료 처리" : "거래 보기";

  return <section className="shop-dashboard section">
    <header className="workspace-heading"><div><p className="eyebrow">INSTALLER WORKSPACE</p><h1>오늘의 시공 업무</h1><p>새 요청과 입고 일정을 먼저 확인하세요.</p></div><button className="primary" onClick={onOpenTransactions}>전체 거래 보기</button></header>
    <div className="shop-metric-grid">{metrics.map((metric) => <button key={metric.label} className={`shop-metric-card ${metric.tone}`} onClick={onOpenTransactions}><i><metric.icon size={20} /></i><span>{metric.label}</span><b>{metric.value}<small>건</small></b><em>{metric.description}</em></button>)}</div>
    {transactions.length === 0 ? <section className="empty-state shop-empty"><span>✓</span><h2>현재 접수된 거래가 없습니다.</h2><p>새 시공 요청이 도착하면 이 화면에서 바로 확인할 수 있습니다.</p></section> : <div className="shop-workspace-grid">
      <section className="card shop-priority-list"><header><div><p className="eyebrow">PRIORITY QUEUE</p><h2>우선 처리할 거래</h2></div><button onClick={onOpenTransactions}>전체 보기</button></header><div>{sorted.filter((item) => item.status.stage !== "완료" && item.status.stage !== "취소").slice(0, 6).map((item) => <button key={item.id} onClick={() => onOpenTransaction(item.id)}><span className={`status-dot status-${item.status.stage}`} /><span><b>{item.vehicle.maker} {item.vehicle.model}</b><small>{item.service.workDescription}</small><em>{item.id} · 딜러 {item.dealerId}</em></span><span><i className={`status-chip status-${item.status.stage}`}>{item.status.stage}</i><strong>{nextAction(item)} →</strong></span></button>)}</div></section>
      <aside className="card shop-today-panel"><p className="eyebrow">TODAY</p><h2><Clock3 size={19} /> 오늘 입고 일정</h2>{transactions.filter((item) => isToday(item.schedule.confirmedInboundAt ?? item.schedule.requestedInboundAt)).length === 0 ? <div className="compact-empty"><b>예정된 입고가 없습니다.</b><span>일정이 확정되면 이곳에 표시됩니다.</span></div> : transactions.filter((item) => isToday(item.schedule.confirmedInboundAt ?? item.schedule.requestedInboundAt)).map((item) => <button key={item.id} onClick={() => onOpenTransaction(item.id)}><b>{item.vehicle.model}</b><span>{item.schedule.confirmedInboundAt ?? item.schedule.requestedInboundAt}</span><small>{item.service.workDescription}</small></button>)}</aside>
    </div>}
  </section>;
}
