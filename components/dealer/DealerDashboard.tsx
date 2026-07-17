import type { Transaction, TransactionStage } from "../../types/transactions";

export function DealerDashboard({ deals, onFilterDeals, onOpenDeal, onNewRequest, onFindShop, onPriceGuide }: {
  deals: Transaction[]; onFilterDeals: (filter: TransactionStage | "전체") => void; onOpenDeal: (id: string) => void;
  onNewRequest: () => void; onFindShop: () => void; onPriceGuide: () => void; onOpenChat: () => void;
}) {
  const cards: { label: string; value: number; filter: TransactionStage | "전체" }[] = [
    { label: "확인 대기", value: deals.filter((deal) => deal.status.stage === "접수").length, filter: "접수" },
    { label: "진행 중", value: deals.filter((deal) => !["접수", "완료", "취소"].includes(deal.status.stage)).length, filter: "입고예정" },
    { label: "오늘 완료", value: deals.filter((deal) => deal.status.stage === "완료").length, filter: "완료" },
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
        {deals.slice(0, 5).map((deal) => <button key={deal.id} onClick={() => onOpenDeal(deal.id)}><span><b>{deal.vehicle.model}</b><small>{deal.service.product ?? deal.service.workDescription} · {deal.installerName}</small></span><em className={`status-chip status-${deal.status.stage}`}>{deal.status.stage}</em></button>)}
      </div></section>
    </section>
  );
}
