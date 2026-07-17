import type { DealerDeal, DealStatus } from "../../types/dealer";

export function DealerDashboard({ deals, onFilterDeals, onOpenDeal, onNewRequest, onFindShop, onPriceGuide }: {
  deals: DealerDeal[]; onFilterDeals: (filter: DealStatus | "전체") => void; onOpenDeal: (id: string) => void;
  onNewRequest: () => void; onFindShop: () => void; onPriceGuide: () => void; onOpenChat: () => void;
}) {
  const cards: { label: string; value: number; filter: DealStatus | "전체" }[] = [
    { label: "확인 대기", value: deals.filter((deal) => deal.status === "시공점 확인중").length, filter: "시공점 확인중" },
    { label: "진행 중", value: deals.filter((deal) => deal.status === "진행중").length, filter: "진행중" },
    { label: "오늘 완료", value: deals.filter((deal) => deal.status === "작업완료").length, filter: "작업완료" },
  ];
  return (
    <section className="dealer-dashboard simplified-dashboard">
      <div className="dealer-welcome"><div><h1>오늘의 시공 업무</h1><p>확인이 필요한 거래부터 빠르게 처리하세요.</p></div></div>
      <div className="metric-grid dashboard-core-metrics">{cards.map((card) => <button className="metric-card" key={card.label} onClick={() => onFilterDeals(card.filter)}><span><i />{card.label}</span><b>{card.value}건</b></button>)}</div>
      <section className="dashboard-quick-actions"><div className="section-head"><h2>빠른 실행</h2></div><div>
        <button className="primary" onClick={onPriceGuide}>시공 가격 확인</button>
        <button className="secondary" onClick={onNewRequest}>새 시공 요청</button>
        <button className="secondary" onClick={onFindShop}>전국 시공점 찾기</button>
      </div></section>
      <section className="today-list-card dashboard-recent-deals"><div className="section-head"><h2>최근 거래</h2><button onClick={() => onFilterDeals("전체")}>전체 보기</button></div><div>
        {deals.slice(0, 5).map((deal) => <button key={deal.id} onClick={() => onOpenDeal(deal.id)}><span><b>{deal.model}</b><small>{deal.packageName} · {deal.shopName}</small></span><em className={`status-badge ${deal.status === "진행중" ? "working" : deal.status === "작업완료" ? "done" : "waiting"}`}>{deal.status}</em></button>)}
      </div></section>
    </section>
  );
}
