import { ArrowRight, CircleDollarSign, Clock3, MapPin, Plus } from "lucide-react";
import type { Transaction, TransactionStage } from "../../types/transactions";

// 진행 중 = 시공예약(확정된 일정 대기)/입고(작업 중) — 완료/취소/견적(확인 대기,
// 별도 배너로 이미 다룸)은 여기 포함하지 않는다. Dashboard와 클릭 결과가
// 항상 같은 정의를 쓰도록 이 상수 하나로 고정.
const ACTIVE_STAGES: TransactionStage[] = ["시공예약", "입고"];

export function DealerDashboard({ dealerName, deals, onFilterDeals, onOpenTransaction, onNewRequest, onFindShop, onPriceGuide }: {
  dealerName: string;
  deals: Transaction[];
  onFilterDeals: (filter: TransactionStage | "전체") => void;
  onOpenTransaction: (id: string) => void;
  onNewRequest: () => void;
  onFindShop: () => void;
  onPriceGuide: () => void;
}) {
  const waitingCount = deals.filter((deal) => deal.status.stage === "견적").length;
  const activeDeals = deals
    .filter((deal) => ACTIVE_STAGES.includes(deal.status.stage))
    .sort((a, b) => b.status.updatedAt.localeCompare(a.status.updatedAt));
  const visibleActiveDeals = activeDeals.slice(0, 4);

  return <section className="dealer-dashboard role-home role-home-dealer">
    <header className="dealer-welcome"><div><p className="eyebrow">DEALER WORKSPACE</p><h1>{dealerName} 딜러님,<span className="dealer-welcome-subtitle">오늘 출고할 차량이 있나요?</span></h1></div></header>

    <button className="dealer-primary-action" onClick={onFindShop}>
      <MapPin size={22} aria-hidden="true" />
      <span><b>가까운 시공점 찾기</b><small>지역과 작업 조건으로 시공점을 비교하고 요청하세요.</small></span>
      <ArrowRight size={18} aria-hidden="true" />
    </button>

    {waitingCount > 0 && <button className="dealer-focus-banner" onClick={() => onFilterDeals("견적")}>
      <Clock3 size={16} aria-hidden="true" /> 확인이 필요한 요청이 {waitingCount}건 있어요 <ArrowRight size={14} aria-hidden="true" />
    </button>}

    {visibleActiveDeals.length > 0 && <section className="dealer-active-deals">
      <div className="section-head"><p className="eyebrow">진행 중인 거래</p>{activeDeals.length > visibleActiveDeals.length && <button className="dealer-active-deals-more" onClick={() => onFilterDeals("전체")}>전체 보기</button>}</div>
      <ul>{visibleActiveDeals.map((deal) => <li key={deal.id}><button onClick={() => onOpenTransaction(deal.id)}>
        <span><b>{deal.vehicle.maker} {deal.vehicle.model}</b><small>{deal.installerName}</small></span>
        <em className={`status-chip status-${deal.status.stage}`}>{deal.status.stage}</em>
      </button></li>)}</ul>
    </section>}

    <div className="dealer-secondary-actions">
      <button className="button button-ghost" onClick={onNewRequest}><Plus size={16} aria-hidden="true" /> 새 시공 요청</button>
      <button className="button button-ghost" onClick={onPriceGuide}><CircleDollarSign size={16} aria-hidden="true" /> 권장 패키지 확인</button>
    </div>

    {deals.length === 0 && <section className="empty-state dashboard-empty"><span>+</span><h2>아직 거래가 없습니다.</h2><p>가까운 시공점을 찾아 첫 시공 요청을 만들어 보세요.</p><button className="primary" onClick={onFindShop}>가까운 시공점 찾기</button></section>}
  </section>;
}
