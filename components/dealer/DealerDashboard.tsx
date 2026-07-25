import { ArrowRight, MapPin, Sparkles } from "lucide-react";
import type { Transaction, TransactionStage } from "../../types/transactions";

function isToday(value?: string) {
  if (!value) return false;
  const date = new Date(value);
  const today = new Date();
  return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
}

export function DealerDashboard({ dealerName, deals, onFilterDeals, onOpenDeal, onNewRequest, onFindShop, onPriceGuide }: {
  dealerName: string;
  deals: Transaction[]; onFilterDeals: (filter: TransactionStage | "전체") => void; onOpenDeal: (id: string) => void;
  onNewRequest: () => void; onFindShop: () => void; onPriceGuide: () => void; onOpenChat: () => void;
}) {
  const sorted = [...deals].sort((a, b) => b.status.updatedAt.localeCompare(a.status.updatedAt));
  const waiting = deals.filter((deal) => deal.status.stage === "접수");
  const inboundToday = deals.filter((deal) => isToday(deal.schedule.confirmedInboundAt ?? deal.schedule.requestedInboundAt)).length;
  const inProgress = deals.filter((deal) => ["입고예정", "입고", "시공중"].includes(deal.status.stage)).length;
  const completed = deals.filter((deal) => deal.status.stage === "완료").length;

  return <section className="home role-home role-home-dealer">
    <header className="home-head">
      <div><p className="eyebrow">DEALER WORKSPACE</p><h1>{dealerName}님, 안녕하세요.</h1></div>
    </header>

    <section className="home-focus">
      {waiting.length > 0 ? <button className="home-focus-card urgent" onClick={() => onFilterDeals("접수")}>
        <span className="home-focus-label"><Sparkles size={13} /> 지금 확인이 필요해요</span>
        <b>{waiting.length}<small>건</small></b>
        <p>응답 대기 중인 요청이 있어요. 지금 확인해 보세요.</p>
        <em>요청 확인하기 <ArrowRight size={15} /></em>
      </button> : <div className="home-focus-card calm">
        <span className="home-focus-label">확인할 요청이 없어요</span>
        <b>0<small>건</small></b>
        <p>가격을 확인하고 새 시공 요청을 만들어 보세요.</p>
        <button className="secondary" onClick={onPriceGuide}>권장 패키지 확인 <ArrowRight size={15} /></button>
      </div>}
      <div className="home-stat-row">
        <button onClick={() => onFilterDeals("입고예정")}><b>{inboundToday}</b><span>오늘 입고 예정</span></button>
        <button onClick={() => onFilterDeals("전체")}><b>{inProgress}</b><span>진행 중</span></button>
        <button onClick={() => onFilterDeals("완료")}><b>{completed}</b><span>완료</span></button>
      </div>
    </section>

    {deals.length === 0 ? <section className="home-empty">
      <h2>아직 거래가 없어요</h2>
      <p>가격을 확인하고 첫 시공 요청을 만들어 보세요.</p>
      <button className="primary" onClick={onNewRequest}>첫 시공 요청 만들기</button>
    </section> : <div className="home-columns">
      <section className="home-list">
        <div className="home-list-head"><h2>최근 거래</h2><button onClick={() => onFilterDeals("전체")}>전체보기 <ArrowRight size={13} /></button></div>
        {sorted.slice(0, 6).map((deal) => <button className="home-row" key={deal.id} onClick={() => onOpenDeal(deal.id)}>
          <span className={`home-row-dot status-${deal.status.stage}`} aria-hidden="true" />
          <span className="home-row-main"><b>{deal.vehicle.maker} {deal.vehicle.model}</b><small>{deal.service.product ?? deal.service.workDescription} · {deal.installerName}</small></span>
          <em>{deal.status.stage}</em>
        </button>)}
      </section>
      <aside className="home-side">
        <section className="home-quick">
          <h2>빠른 실행</h2>
          <button className="secondary" onClick={onPriceGuide}>권장 패키지 확인</button>
          <button className="secondary" onClick={onFindShop}><MapPin size={15} /> 전국 시공점 찾기</button>
        </section>
        <section className="home-recent-chat">
          <h2>최근 대화</h2>
          {sorted.slice(0, 3).map((deal) => <button key={deal.id} onClick={() => onOpenDeal(deal.id)}>
            <b>{deal.installerName}</b>
            <small>{deal.lastMessage || "새 거래방이 생성되었습니다."}</small>
          </button>)}
          {sorted.length === 0 && <p className="home-side-empty">아직 대화가 없어요.</p>}
        </section>
      </aside>
    </div>}
  </section>;
}
