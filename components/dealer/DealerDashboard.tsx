import { Bell, CheckCircle2, ChevronRight, MessageCircle, Phone, Search } from "lucide-react";
import { useState } from "react";
import type { Transaction, TransactionStage } from "../../types/transactions";
import { dealerStageLabel } from "../../services/transaction-state-service";

const ACTIVE_STAGES: TransactionStage[] = ["시공예약", "입고"];
const DESIGN_PROTOTYPE_ONLY = true;
type PrototypeJob = { id: string; vehicle: string; year: string; work: string; shop: string; status: string; tone: "blue" | "green" | "purple"; schedule: string; next: string };
const PROTOTYPE_JOBS: PrototypeJob[] = [
  { id: "design-prototype-job-1", vehicle: "제네시스 G80", year: "2022 · 123가 4567", work: "썬팅, 블랙박스", shop: "강남 프리미엄 카케어", status: "예약 확정", tone: "blue", schedule: "2024.05.25 (토) 10:00", next: "일정 확인" },
  { id: "design-prototype-job-2", vehicle: "BMW X5", year: "2021 · 45나 6789", work: "PPF (전체)", shop: "미사틴팅 스튜디오", status: "작업 진행 중", tone: "green", schedule: "2024.05.24 (금) 14:00", next: "작업 진행 확인" },
  { id: "design-prototype-job-3", vehicle: "테슬라 모델 3", year: "2023 · 12다 3456", work: "유리막 코팅", shop: "판교 디테일링 팩토리", status: "예약 대기", tone: "purple", schedule: "2024.05.27 (월) 11:00", next: "예약 확정 대기" },
];

function DealRow({ deal, onOpenTransaction }: { deal: Transaction; onOpenTransaction: (id: string) => void }) {
  const inbound = deal.schedule.confirmedInboundAt ?? deal.schedule.requestedInboundAt;
  return <button className="ws-row" onClick={() => onOpenTransaction(deal.id)}><span className="ws-row-main"><b>{deal.vehicle.maker} {deal.vehicle.model}</b><small>{deal.installerName} · {deal.service.workDescription || deal.service.product || "작업 내용 미정"}</small></span><span className="ws-row-schedule"><small>입고</small><b>{inbound ? new Date(inbound).toLocaleDateString("ko-KR", { month: "short", day: "numeric" }) : "미정"}</b></span>{deal.contactStatus === undefined && <span className="ws-badge ws-badge-red"><Phone size={11} /> 전화 확인 필요</span>}<em className={`status-chip status-${deal.status.stage}`}>{dealerStageLabel(deal.status.stage)}</em><span className="ws-row-next">열어보기 →</span></button>;
}
function PrototypeJobRow({ job }: { job: PrototypeJob }) { return <div className="prototype-job-row"><div className="prototype-job-vehicle"><b>{job.vehicle}</b><small>{job.year}</small></div><span>{job.work}</span><span>{job.shop}</span><em className={`prototype-status ${job.tone}`}>{job.status}</em><span>{job.schedule}</span><span>{job.next}</span><button type="button">상세 보기 <ChevronRight size={14} /></button></div>; }
function EmptyRow({ children }: { children: string }) { return <p className="ws-empty-row">{children}</p>; }

export function DealerDashboard({ dealerName, deals, onFilterDeals, onOpenTransaction, onNewRequest: _onNewRequest, onFindShop, onSearchLocation, onPriceGuide: _onPriceGuide, onShopSearchRequests }: {
  dealerName: string; deals: Transaction[]; onFilterDeals: (filter: TransactionStage | "전체") => void; onOpenTransaction: (id: string) => void; onNewRequest: () => void; onFindShop: () => void; onSearchLocation: (area: string, workType: string) => void; onPriceGuide: () => void; onShopSearchRequests?: () => void;
}) {
  const [area, setArea] = useState("");
  const [workType, setWorkType] = useState("썬팅");
  const activeDeals = deals.filter((deal) => ACTIVE_STAGES.includes(deal.status.stage));
  const recentDeals = [...activeDeals].sort((a, b) => b.status.updatedAt.localeCompare(a.status.updatedAt)).slice(0, 5);
  const quickWorkTypes = ["썬팅", "블랙박스", "PPF", "유리막", "기타"];
  const submitSearch = () => (area.trim() ? onSearchLocation(area.trim(), workType) : onFindShop());
  const usePrototypeJobs = DESIGN_PROTOTYPE_ONLY && deals.length === 0;

  return <section className={`dealer-dashboard r3-dealer-dashboard r4-dealer-dashboard reference-prototype-dashboard ${deals.length > 0 ? "has-deals" : "new-dealer"}`}>
    <header className="reference-dashboard-top"><div><h1>안녕하세요, {dealerName}님 👋</h1><p>오늘도 안전하고 성공적인 출고를 응원합니다.</p></div><div className="reference-utility"><button type="button" aria-label="알림"><Bell size={22} /></button><button type="button" aria-label="메시지"><MessageCircle size={22} /><b>2</b></button><span className="reference-avatar">{dealerName.slice(0, 1)}</span></div></header>
    <section className="reference-search-panel"><div className="r3-hero-title"><h2>어디에서 차량용품 작업이 필요하세요?</h2></div><div className="ws-search-form r3-search-form"><label><span className="sr-only">지역 또는 주소</span><input value={area} onChange={(event) => setArea(event.target.value)} placeholder="예: 서울 강남구, 미사강변동로 95" onKeyDown={(event) => event.key === "Enter" && submitSearch()} /></label><button className="primary ws-search-cta" onClick={submitSearch}><Search size={17} /> 시공점 찾기</button></div><div className="reference-quick-work" aria-label="자주 찾는 작업">{quickWorkTypes.map((type) => <button key={type} type="button" onClick={() => { setWorkType(type); onSearchLocation(area.trim(), type); }}>{type}</button>)}</div></section>
    <section className="reference-module-grid"><article className="reference-module"><header><h2><Bell size={19} /> 최근 알림</h2><button type="button">전체 보기 <ChevronRight size={14} /></button></header><ul><li><i />작업 일정이 변경되었습니다.<small>1시간 전</small></li><li><i />새 메시지 2건이 도착했습니다.<small>2시간 전</small></li><li><i />작업이 완료되어 리뷰를 요청드립니다.<small>1일 전</small></li></ul></article><article className="reference-module"><header><h2><MessageCircle size={19} /> 새 메시지</h2><button type="button" onClick={() => onFilterDeals("전체")}>전체 보기 <ChevronRight size={14} /></button></header><ul><li><div><b>강남 프리미엄 카케어</b><span>안녕하세요, 작업 일정 확인 부탁드립니다.</span></div><small>1시간 전</small><em>1</em></li><li><div><b>미사틴팅 스튜디오</b><span>PPF 시공 관련 추가 문의드립니다.</span></div><small>3시간 전</small><em>1</em></li></ul></article><article className="reference-module getting-started"><header><h2><CheckCircle2 size={19} /> 처음 시작하기</h2></header><ol><li><b>1</b><span>주소 입력</span><em className="done">완료 <CheckCircle2 size={14} /></em></li><li><b>2</b><span>시공점 찾기</span><em>바로가기 <ChevronRight size={14} /></em></li><li><b>3</b><span>작업 요청하기</span><em className="pending">대기 중</em></li></ol></article></section>
    {deals.length > 0 ? <section className="ws-card ws-list-card r3-recent-work reference-recent-work"><div className="ws-section-head"><div><h2>최근 진행 중인 작업</h2><p>차량 작업의 현재 상태와 다음 행동을 확인하세요.</p></div><button onClick={() => onFilterDeals("전체")}>전체 보기 <ChevronRight size={14} /></button></div><div className="ws-row-columns" aria-hidden="true"><span>차량 / 작업</span><span>입고</span><span>상태</span><span>다음 행동</span></div>{recentDeals.length > 0 ? recentDeals.map((deal) => <DealRow key={deal.id} deal={deal} onOpenTransaction={onOpenTransaction} />) : <EmptyRow>진행 중인 거래가 없습니다.</EmptyRow>}</section> : <section className="reference-recent-work prototype-recent-work"><header><h2>최근 진행 중인 작업</h2><button type="button">전체 보기 <ChevronRight size={14} /></button></header><div className="prototype-job-head"><span>차량</span><span>작업 내용</span><span>시공점</span><span>상태</span><span>일정</span><span>다음 행동</span><span>상세 보기</span></div>{PROTOTYPE_JOBS.map((job) => <PrototypeJobRow key={job.id} job={job} />)}</section>}
    <div className="prototype-legacy-actions" aria-hidden="true">{onShopSearchRequests && <button className="button button-ghost" onClick={onShopSearchRequests}>시공점 찾기</button>}</div>
    {usePrototypeJobs && <span className="prototype-only-label">DESIGN_PROTOTYPE_ONLY · 실제 거래 데이터가 없는 로컬 시안입니다.</span>}
  </section>;
}
