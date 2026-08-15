import { useState } from "react";
import { Building2, CheckCircle2, CircleDollarSign, MapPin, Phone, Plus, Search, TriangleAlert } from "lucide-react";
import type { Transaction, TransactionStage } from "../../types/transactions";
import { dealerStageLabel } from "../../services/transaction-state-service";

// 진행 중 = 시공예약(확정된 일정 대기)/입고(작업 중) — 완료/취소/견적(확인 대기,
// 별도 배너로 이미 다룸)은 여기 포함하지 않는다. Dashboard와 클릭 결과가
// 항상 같은 정의를 쓰도록 이 상수 하나로 고정.
const ACTIVE_STAGES: TransactionStage[] = ["시공예약", "입고"];
const COMPLETED_STAGES: TransactionStage[] = ["작업완료", "출고"];

function isThisMonth(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function DealRow({ deal, onOpenTransaction }: { deal: Transaction; onOpenTransaction: (id: string) => void }) {
  return <button className="ws-row" onClick={() => onOpenTransaction(deal.id)}>
    <span className="ws-row-main">
      <b>{deal.vehicle.maker} {deal.vehicle.model}</b>
      <small>{deal.installerName} · {deal.service.workDescription || deal.service.product || "작업 내용 미정"}</small>
    </span>
    <span className="ws-row-schedule"><small>입고</small><b>{deal.schedule.confirmedInboundAt ?? deal.schedule.requestedInboundAt ? new Date(deal.schedule.confirmedInboundAt ?? deal.schedule.requestedInboundAt!).toLocaleDateString("ko-KR", { month: "short", day: "numeric" }) : "미정"}</b></span>
    {deal.contactStatus === undefined && <span className="ws-badge ws-badge-red"><Phone size={11} /> 전화 확인 필요</span>}
    <em className={`status-chip status-${deal.status.stage}`}>{dealerStageLabel(deal.status.stage)}</em>
    <span className="ws-row-next">열어보기 →</span>
  </button>;
}

function EmptyRow({ children }: { children: string }) {
  return <p className="ws-empty-row">{children}</p>;
}

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

  const waitingDeals = deals.filter((deal) => deal.status.stage === "견적").sort((a, b) => b.status.updatedAt.localeCompare(a.status.updatedAt));
  const activeDeals = deals.filter((deal) => ACTIVE_STAGES.includes(deal.status.stage)).sort((a, b) => b.status.updatedAt.localeCompare(a.status.updatedAt));
  const monthlyCompletedCount = deals.filter((deal) => COMPLETED_STAGES.includes(deal.status.stage) && isThisMonth(deal.status.updatedAt)).length;
  const visibleWaitingDeals = waitingDeals.slice(0, 5);
  const visibleActiveDeals = activeDeals.slice(0, 4);
  const hasAnyDeal = deals.length > 0;

  const submitSearch = () => (area.trim() ? onSearchLocation(area.trim(), workType) : onFindShop());

  return <section className="dealer-dashboard">
    <header className="ws-dashboard-header">
      <p className="ws-eyebrow">Dealer Workspace</p>
      <h1>{dealerName} 딜러님</h1>
    </header>

    <section className="ws-search-hero">
      <div className="ws-search-hero-copy">
        <span className="ws-search-hero-icon"><MapPin size={20} /></span>
        <div>
          <h2>어디로 출고하시나요?</h2>
          <p>지역과 작업 종류를 입력하면 해당 지역의 시공점을 바로 찾을 수 있어요.</p>
        </div>
      </div>
      <div className="ws-search-form">
        <label>
          <span>지역 또는 주소</span>
          <input value={area} onChange={(event) => setArea(event.target.value)} placeholder="예: 서울 강남구" onKeyDown={(event) => event.key === "Enter" && submitSearch()} />
        </label>
        <label>
          <span>작업 유형</span>
          <select value={workType} onChange={(event) => setWorkType(event.target.value)}><option>썬팅</option><option>PPF</option><option>블랙박스</option><option>유리막</option><option>기타</option></select>
        </label>
        <button className="primary ws-search-cta" onClick={submitSearch}><Search size={17} /> 시공점 찾기</button>
      </div>
      <div className="ws-search-hero-shortcuts">
        <button className="button button-ghost" onClick={onNewRequest}><Plus size={16} aria-hidden="true" /> 새 시공 요청</button>
        <button className="button button-ghost" onClick={onPriceGuide}><CircleDollarSign size={16} aria-hidden="true" /> 권장 패키지 확인</button>
        {onShopSearchRequests && <button className="button button-ghost" onClick={onShopSearchRequests}><Search size={16} aria-hidden="true" /> 시공점 찾기 요청</button>}
      </div>
    </section>

    {hasAnyDeal ? <>
      <div className="ws-summary-row">
        <button className="ws-summary-card tone-red" onClick={() => onFilterDeals("견적")}><span className="ws-summary-icon"><TriangleAlert size={16} /></span><span><b>{waitingDeals.length}</b><small>확인 필요 거래</small></span></button>
        <button className="ws-summary-card tone-blue" onClick={() => onFilterDeals("전체")}><span className="ws-summary-icon"><Building2 size={16} /></span><span><b>{activeDeals.length}</b><small>진행 중 거래</small></span></button>
        <div className="ws-summary-card tone-green"><span className="ws-summary-icon"><CheckCircle2 size={16} /></span><span><b>{monthlyCompletedCount}</b><small>이번 달 완료</small></span></div>
      </div>

      <div className="ws-work-grid">
        <section className="ws-card ws-list-card">
          <div className="ws-section-head"><div><h2>지금 확인해야 할 작업</h2><p>전화 확인과 일정 조율이 필요한 차량입니다.</p></div>{waitingDeals.length > 0 && <button onClick={() => onFilterDeals("견적")}>전체 보기</button>}</div>
          <div className="ws-row-columns" aria-hidden="true"><span>차량 / 작업</span><span>입고</span><span>상태</span><span>다음 행동</span></div>
          {visibleWaitingDeals.length > 0 ? visibleWaitingDeals.map((deal) => <DealRow key={deal.id} deal={deal} onOpenTransaction={onOpenTransaction} />) : <EmptyRow>확인이 필요한 거래가 없습니다.</EmptyRow>}
        </section>
        <section className="ws-card ws-list-card">
          <div className="ws-section-head"><div><h2>진행 중인 차량</h2><p>현재 작업 단계와 일정을 확인하세요.</p></div>{activeDeals.length > 0 && <button onClick={() => onFilterDeals("전체")}>전체 보기</button>}</div>
          <div className="ws-row-columns" aria-hidden="true"><span>차량 / 작업</span><span>입고</span><span>상태</span><span>다음 행동</span></div>
          {visibleActiveDeals.length > 0 ? visibleActiveDeals.map((deal) => <DealRow key={deal.id} deal={deal} onOpenTransaction={onOpenTransaction} />) : <EmptyRow>진행 중인 거래가 없습니다.</EmptyRow>}
        </section>
      </div>
    </> : <section className="empty-state dashboard-empty"><span>+</span><h2>아직 거래가 없습니다.</h2><p>가까운 시공점을 찾아 첫 시공 요청을 만들어 보세요.</p><button className="primary" onClick={onFindShop}>가까운 시공점 찾기</button></section>}
  </section>;
}
