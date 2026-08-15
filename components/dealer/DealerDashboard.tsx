import { CircleDollarSign, MapPin, Phone, Plus, Search } from "lucide-react";
import { useState } from "react";
import type { Transaction, TransactionStage } from "../../types/transactions";
import { dealerStageLabel } from "../../services/transaction-state-service";

const ACTIVE_STAGES: TransactionStage[] = ["시공예약", "입고"];

function DealRow({ deal, onOpenTransaction }: { deal: Transaction; onOpenTransaction: (id: string) => void }) {
  const inbound = deal.schedule.confirmedInboundAt ?? deal.schedule.requestedInboundAt;
  return <button className="ws-row" onClick={() => onOpenTransaction(deal.id)}>
    <span className="ws-row-main"><b>{deal.vehicle.maker} {deal.vehicle.model}</b><small>{deal.installerName} · {deal.service.workDescription || deal.service.product || "작업 내용 미정"}</small></span>
    <span className="ws-row-schedule"><small>입고</small><b>{inbound ? new Date(inbound).toLocaleDateString("ko-KR", { month: "short", day: "numeric" }) : "미정"}</b></span>
    {deal.contactStatus === undefined && <span className="ws-badge ws-badge-red"><Phone size={11} /> 전화 확인 필요</span>}
    <em className={`status-chip status-${deal.status.stage}`}>{dealerStageLabel(deal.status.stage)}</em>
    <span className="ws-row-next">열어보기 →</span>
  </button>;
}

function EmptyRow({ children }: { children: string }) { return <p className="ws-empty-row">{children}</p>; }

export function DealerDashboard({ dealerName, deals, onFilterDeals, onOpenTransaction, onNewRequest, onFindShop, onSearchLocation, onPriceGuide, onShopSearchRequests }: {
  dealerName: string;
  deals: Transaction[];
  onFilterDeals: (filter: TransactionStage | "전체") => void;
  onOpenTransaction: (id: string) => void;
  onNewRequest: () => void;
  onFindShop: () => void;
  onSearchLocation: (area: string, workType: string) => void;
  onPriceGuide: () => void;
  onShopSearchRequests?: () => void;
}) {
  const [area, setArea] = useState("");
  const [workType, setWorkType] = useState("썬팅");
  const activeDeals = deals.filter((deal) => ACTIVE_STAGES.includes(deal.status.stage));
  const recentDeals = [...activeDeals].sort((a, b) => b.status.updatedAt.localeCompare(a.status.updatedAt)).slice(0, 5);
  const quickWorkTypes = ["썬팅", "블랙박스", "PPF", "유리막", "기타"];
  const submitSearch = () => (area.trim() ? onSearchLocation(area.trim(), workType) : onFindShop());

  return <section className="dealer-dashboard r3-dealer-dashboard">
    <header className="ws-dashboard-header r3-dashboard-header"><div><h1>{dealerName} 딜러님</h1><p>오늘 필요한 차량 작업을 빠르게 시작하세요.</p></div><button className="r3-profile-chip" type="button" aria-label="프로필 메뉴"><span>{dealerName.slice(0, 1)}</span><small>Dealer</small></button></header>
    <section className="ws-search-hero r3-search-hero">
      <div className="r3-hero-title"><MapPin size={22} /><h2>어디에서 차량용품 작업이 필요하세요?</h2></div>
      <div className="ws-search-form r3-search-form">
        <label><span>지역 또는 시공점을 검색해보세요</span><input value={area} onChange={(event) => setArea(event.target.value)} placeholder="예: 서울 강남구" onKeyDown={(event) => event.key === "Enter" && submitSearch()} /></label>
        <label><span>작업 종류</span><select value={workType} onChange={(event) => setWorkType(event.target.value)}>{quickWorkTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
        <button className="primary ws-search-cta" onClick={submitSearch}><Search size={17} /> 시공점 찾기</button>
      </div>
      <div className="r3-quick-work" aria-label="자주 찾는 작업"><span>자주 찾는 작업</span>{quickWorkTypes.map((type) => <button key={type} type="button" onClick={() => { setWorkType(type); onSearchLocation(area.trim(), type); }}>{type}</button>)}</div>
      <div className="ws-search-hero-shortcuts r3-secondary-actions"><button className="button button-ghost" onClick={onNewRequest}><Plus size={16} aria-hidden="true" /> 새 시공 요청</button><button className="button button-ghost" onClick={onPriceGuide}><CircleDollarSign size={16} aria-hidden="true" /> 권장 시공 패키지</button>{onShopSearchRequests && <button className="button button-ghost" onClick={onShopSearchRequests}><Search size={16} aria-hidden="true" /> 찾고 있는 시공점</button>}</div>
    </section>
    {deals.length > 0 ? <section className="ws-card ws-list-card r3-recent-work"><div className="ws-section-head"><div><h2>최근 진행 중인 거래</h2><p>차량 작업의 현재 상태와 다음 행동을 확인하세요.</p></div><button onClick={() => onFilterDeals("전체")}>전체 거래 보기 →</button></div><div className="ws-row-columns" aria-hidden="true"><span>차량 / 작업</span><span>입고</span><span>상태</span><span>다음 행동</span></div>{recentDeals.length > 0 ? recentDeals.map((deal) => <DealRow key={deal.id} deal={deal} onOpenTransaction={onOpenTransaction} />) : <EmptyRow>진행 중인 거래가 없습니다.</EmptyRow>}</section> : <section className="empty-state dashboard-empty"><span>+</span><h2>아직 거래가 없습니다.</h2><p>가까운 시공점을 찾아 첫 차량 작업을 시작해보세요.</p><button className="primary" onClick={onFindShop}>가까운 시공점 찾기</button></section>}
  </section>;
}
