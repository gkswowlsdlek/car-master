import { useState } from "react";
import { ArrowRight, CircleDollarSign, Clock3, MapPin, Plus, Search } from "lucide-react";
import type { Transaction, TransactionStage } from "../../types/transactions";
import { dealerStageLabel } from "../../services/transaction-state-service";

// 진행 중 = 시공예약(확정된 일정 대기)/입고(작업 중) — 완료/취소/견적(확인 대기,
// 별도 배너로 이미 다룸)은 여기 포함하지 않는다. Dashboard와 클릭 결과가
// 항상 같은 정의를 쓰도록 이 상수 하나로 고정.
const ACTIVE_STAGES: TransactionStage[] = ["시공예약", "입고"];

export function DealerDashboard({ dealerName, deals, onFilterDeals, onOpenTransaction, onNewRequest, onFindShop, onSearchLocation, onPriceGuide, onShopSearchRequests }: {
  dealerName: string;
  deals: Transaction[];
  onFilterDeals: (filter: TransactionStage | "전체") => void;
  onOpenTransaction: (id: string) => void;
  onNewRequest: () => void;
  onFindShop: () => void;
  onSearchLocation: (area: string, workType: string) => void;
  onPriceGuide: () => void;
  /** Only passed in Real (Supabase) mode. */
  onShopSearchRequests?: () => void;
}) {
  const [area, setArea] = useState("");
  const [workType, setWorkType] = useState("썬팅");
  const waitingCount = deals.filter((deal) => deal.status.stage === "견적").length;
  const activeDeals = deals
    .filter((deal) => ACTIVE_STAGES.includes(deal.status.stage))
    .sort((a, b) => b.status.updatedAt.localeCompare(a.status.updatedAt));
  const visibleActiveDeals = activeDeals.slice(0, 4);

  return <section className="dealer-dashboard role-home role-home-dealer dealer-home-prototype">
    <header className="dealer-welcome"><div><p className="eyebrow">DEALER WORKSPACE</p><h1>{dealerName} 딜러님,<span className="dealer-welcome-subtitle">오늘 출고할 차량이 있나요?</span></h1></div></header>

    <section className="dealer-location-first"><div className="dealer-location-first-copy"><MapPin size={22} /><div><p className="eyebrow">FIND AN INSTALLER</p><h2>어디로 출고하시나요?</h2><p>지역을 선택하면 해당 지역의 시공점 탐색으로 바로 이어집니다.</p></div></div><div className="dealer-location-form"><label><span>지역 또는 주소</span><input value={area} onChange={(event) => setArea(event.target.value)} placeholder="예: 서울 강남구" onKeyDown={(event) => { if (event.key === "Enter" && area.trim()) onSearchLocation(area.trim(), workType); }} /></label><label><span>작업 유형</span><select value={workType} onChange={(event) => setWorkType(event.target.value)}><option>썬팅</option><option>PPF</option><option>블랙박스</option><option>유리막</option><option>기타</option></select></label><button className="primary" onClick={() => area.trim() ? onSearchLocation(area.trim(), workType) : onFindShop()}><Search size={17} /> 시공점 찾기</button></div></section>

    {waitingCount > 0 && <button className="dealer-focus-banner" onClick={() => onFilterDeals("견적")}>
      <Clock3 size={16} aria-hidden="true" /> 확인이 필요한 요청이 {waitingCount}건 있어요 <ArrowRight size={14} aria-hidden="true" />
    </button>}

    {visibleActiveDeals.length > 0 && <section className="dealer-active-deals">
      <div className="section-head"><p className="eyebrow">진행 중인 거래</p>{activeDeals.length > visibleActiveDeals.length && <button className="dealer-active-deals-more" onClick={() => onFilterDeals("전체")}>전체 보기</button>}</div>
      <ul>{visibleActiveDeals.map((deal) => <li key={deal.id}><button onClick={() => onOpenTransaction(deal.id)}>
        <span><b>{deal.vehicle.maker} {deal.vehicle.model}</b><small>{deal.installerName}</small></span>
        <em className={`status-chip status-${deal.status.stage}`}>{dealerStageLabel(deal.status.stage)}</em>
      </button></li>)}</ul>
    </section>}

    <div className="dealer-secondary-actions">
      <button className="button button-ghost" onClick={onNewRequest}><Plus size={16} aria-hidden="true" /> 새 시공 요청</button>
      <button className="button button-ghost" onClick={onPriceGuide}><CircleDollarSign size={16} aria-hidden="true" /> 권장 패키지 확인</button>
      {onShopSearchRequests && <button className="button button-ghost" onClick={onShopSearchRequests}><Search size={16} aria-hidden="true" /> 시공점 찾기 요청</button>}
    </div>

    {deals.length === 0 && <section className="empty-state dashboard-empty"><span>+</span><h2>아직 거래가 없습니다.</h2><p>가까운 시공점을 찾아 첫 시공 요청을 만들어 보세요.</p><button className="primary" onClick={onFindShop}>가까운 시공점 찾기</button></section>}
  </section>;
}
