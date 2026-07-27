import { ArrowRight, CalendarClock, CheckCircle2, CircleDollarSign, Clock3, MapPin, MessageCircle, Plus, Wrench } from "lucide-react";
import type { Transaction, TransactionStage } from "../../types/transactions";

function isToday(value?: string) {
  if (!value) return false;
  const date = new Date(value);
  const today = new Date();
  return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
}

function isWithinLastDays(value: string, days: number) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return date.getTime() >= cutoff;
}

export function DealerDashboard({ dealerName, deals, unreadMessageCount, onFilterDeals, onOpenDeal, onNewRequest, onFindShop, onPriceGuide, onOpenChat }: {
  dealerName: string;
  unreadMessageCount: number;
  deals: Transaction[]; onFilterDeals: (filter: TransactionStage | "전체") => void; onOpenDeal: (id: string) => void;
  onNewRequest: () => void; onFindShop: () => void; onPriceGuide: () => void; onOpenChat: () => void;
}) {
  const waitingCount = deals.filter((deal) => deal.status.stage === "견적").length;
  const cards = [
    { label: "오늘 입고 예정", description: "오늘 확인할 입고 일정", value: deals.filter((deal) => isToday(deal.schedule.confirmedInboundAt ?? deal.schedule.requestedInboundAt)).length, filter: "시공예약" as const, icon: CalendarClock, tone: "blue" },
    { label: "확인 대기 거래", description: "확인이 필요한 요청", value: waitingCount, filter: "견적" as const, icon: Clock3, tone: "orange" },
    { label: "진행 중 거래", description: "현재 작업 중인 차량", value: deals.filter((deal) => ["시공예약", "입고"].includes(deal.status.stage)).length, filter: "전체" as const, icon: Wrench, tone: "violet" },
    { label: "최근 완료 거래", description: "최근 30일 내 완료된 거래", value: deals.filter((deal) => deal.status.stage === "작업완료" && isWithinLastDays(deal.schedule.completedAt ?? deal.status.updatedAt, 30)).length, filter: "작업완료" as const, icon: CheckCircle2, tone: "green" },
  ];
  return <section className="dealer-dashboard simplified-dashboard role-home role-home-dealer">
    <header className="dealer-welcome"><div><p className="eyebrow">DEALER WORKSPACE</p><h1>{dealerName} 딜러님, <br /><span>오늘 업무를 시작하세요.</span></h1><p>확인 대기 거래와 오늘 입고 일정을 먼저 정리했습니다.</p></div><button className="primary" onClick={onNewRequest}><Plus size={18} /> 새 시공 요청</button></header>
    {waitingCount > 0 && <button className="dealer-focus-banner" onClick={() => onFilterDeals("견적")}>
      <div><p className="eyebrow">NEEDS YOUR ATTENTION</p><h2>지금 확인이 필요해요 — {waitingCount}건</h2><p className="dealer-focus-desc">응답 대기 중인 시공 요청이 있어요. 지금 확인해 보세요.</p></div>
      <span className="dealer-focus-cta">확인하기 <ArrowRight size={16} /></span>
    </button>}
    <div className="dealer-today-actions" aria-label="지금 확인할 일">
      <div><p className="eyebrow">TODAY&apos;S PRIORITIES</p><h2>지금 확인할 일</h2></div>
      <button onClick={() => onFilterDeals("견적")}><Clock3 size={18} /><span>확인 필요한 거래</span><b>{waitingCount}</b><ArrowRight size={16} /></button>
      <button onClick={() => onFilterDeals("시공예약")}><CalendarClock size={18} /><span>시공예약</span><b>{deals.filter((deal) => deal.status.stage === "시공예약").length}</b><ArrowRight size={16} /></button>
      <button onClick={onOpenChat}><MessageCircle size={18} /><span>읽지 않은 메시지</span><b>{unreadMessageCount}</b><ArrowRight size={16} /></button>
    </div>
    <div className="metric-grid dashboard-core-metrics">{cards.map((card) => <button className={`metric-card tone-${card.tone}`} key={card.label} onClick={() => onFilterDeals(card.filter)}><i><card.icon size={20} /></i><span>{card.label}</span><b>{card.value}<small>건</small></b><em>{card.description}</em></button>)}</div>
    <section className="dashboard-quick-actions"><div className="section-head"><div><p className="eyebrow">START A REQUEST</p><h2>새 요청 시작하기</h2></div><p>먼저 가격을 확인하거나 바로 시공점을 찾아보세요.</p></div><div><button className="primary" onClick={onPriceGuide}><CircleDollarSign size={17} /> 권장 패키지 확인</button><button className="secondary" onClick={onFindShop}><MapPin size={17} /> 전국 시공점 찾기</button></div></section>
    {deals.length === 0 && <section className="empty-state dashboard-empty"><span>+</span><h2>아직 거래가 없습니다.</h2><p>가격을 확인하고 첫 시공 요청을 만들어 보세요.</p><button className="primary" onClick={onNewRequest}>첫 시공 요청 만들기</button></section>}
  </section>;
}
