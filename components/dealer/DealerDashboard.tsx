import type { Transaction, TransactionStage } from "../../types/transactions";

function isToday(value?: string) {
  if (!value) return false;
  const date = new Date(value);
  const today = new Date();
  return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
}

export function DealerDashboard({ deals, onFilterDeals, onOpenDeal, onNewRequest, onFindShop, onPriceGuide }: {
  deals: Transaction[]; onFilterDeals: (filter: TransactionStage | "전체") => void; onOpenDeal: (id: string) => void;
  onNewRequest: () => void; onFindShop: () => void; onPriceGuide: () => void; onOpenChat: () => void;
}) {
  const sorted = [...deals].sort((a, b) => b.status.updatedAt.localeCompare(a.status.updatedAt));
  const cards: { label: string; description: string; value: number; filter: TransactionStage | "전체" }[] = [
    { label: "오늘 입고 예정", description: "오늘 확인할 입고 일정", value: deals.filter((deal) => isToday(deal.schedule.confirmedInboundAt ?? deal.schedule.requestedInboundAt)).length, filter: "입고예정" },
    { label: "확인 대기 거래", description: "응답이 필요한 신규 요청", value: deals.filter((deal) => deal.status.stage === "접수").length, filter: "접수" },
    { label: "진행 중 거래", description: "현재 시공 흐름에 있는 거래", value: deals.filter((deal) => ["입고예정", "입고", "시공중"].includes(deal.status.stage)).length, filter: "전체" },
    { label: "최근 완료 거래", description: "완료 처리된 전체 거래", value: deals.filter((deal) => deal.status.stage === "완료").length, filter: "완료" },
  ];
  return <section className="dealer-dashboard simplified-dashboard">
    <header className="dealer-welcome"><div><p className="eyebrow">TODAY&apos;S WORKSPACE</p><h1>오늘의 시공 업무</h1><p>확인이 필요한 거래부터 빠르게 처리하세요.</p></div><button className="primary" onClick={onNewRequest}>새 시공 요청</button></header>
    <div className="metric-grid dashboard-core-metrics">{cards.map((card) => <button className="metric-card" key={card.label} onClick={() => onFilterDeals(card.filter)}><span>{card.label}</span><b>{card.value}건</b><small>{card.description}</small></button>)}</div>
    <section className="dashboard-quick-actions"><div className="section-head"><div><p className="eyebrow">QUICK ACTIONS</p><h2>빠른 실행</h2></div></div><div><button className="primary" onClick={onPriceGuide}>시공 가격 확인</button><button className="secondary" onClick={onNewRequest}>새 시공 요청</button><button className="secondary" onClick={onFindShop}>전국 시공점 찾기</button></div></section>
    {deals.length === 0 ? <section className="empty-state dashboard-empty"><span>+</span><h2>아직 거래가 없습니다.</h2><p>가격을 확인하고 첫 시공 요청을 만들어 보세요.</p><button className="primary" onClick={onNewRequest}>첫 시공 요청 만들기</button></section> : <div className="dashboard-activity-grid">
      <section className="today-list-card dashboard-recent-deals"><div className="section-head"><div><p className="eyebrow">RECENT TRANSACTIONS</p><h2>최근 거래</h2></div><button onClick={() => onFilterDeals("전체")}>전체 보기</button></div><div>{sorted.slice(0, 5).map((deal) => <button key={deal.id} onClick={() => onOpenDeal(deal.id)}><span><b>{deal.vehicle.maker} {deal.vehicle.model}</b><small>{deal.service.product ?? deal.service.workDescription} · {deal.installerName}</small></span><em className={`status-chip status-${deal.status.stage}`}>{deal.status.stage}</em></button>)}</div></section>
      <section className="today-list-card dashboard-recent-chat"><div className="section-head"><div><p className="eyebrow">LATEST MESSAGES</p><h2>최근 채팅</h2></div></div><div>{sorted.slice(0, 4).map((deal) => <button key={deal.id} onClick={() => onOpenDeal(deal.id)}><span><b>{deal.installerName}</b><small>{deal.lastMessage || "새 거래방이 생성되었습니다."}</small></span><time>{new Date(deal.status.updatedAt).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" })}</time></button>)}</div></section>
      <section className="today-list-card dashboard-recent-requests"><div className="section-head"><div><p className="eyebrow">RECENT REQUESTS</p><h2>최근 시공 요청</h2></div></div><div>{[...deals].sort((a, b) => b.status.createdAt.localeCompare(a.status.createdAt)).slice(0, 4).map((deal) => <button key={deal.id} onClick={() => onOpenDeal(deal.id)}><span><b>{deal.service.workDescription}</b><small>{deal.vehicle.model} · {deal.installerName}</small></span><em>{new Date(deal.status.createdAt).toLocaleDateString("ko-KR")}</em></button>)}</div></section>
    </div>}
  </section>;
}
