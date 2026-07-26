"use client";

import { useMemo, useState } from "react";
import { ArrowRight, MessageCircle, Search } from "lucide-react";
import type { ChatRoom, PaymentStatus, Transaction, TransactionChatMessage, TransactionStage } from "../../types/transactions";
import { canTransitionStage, nextForwardStage, stageOrder, STAGE_ACTION_LABEL } from "../../services/transaction-state-service";

const won = (value?: number) => value == null ? "미확정" : `${value.toLocaleString("ko-KR")}원`;

export function TransactionManagementScreen({ role, transactions, selectedId, onSelect, onStageChange, onNewRequest, onOpenMessages }: {
  role: "dealer" | "shop";
  userId: string;
  transactions: Transaction[];
  rooms: ChatRoom[];
  selectedId: string;
  useRemoteAttachments: boolean;
  onSelect: (id: string) => void;
  onSend: (transaction: Transaction, message: TransactionChatMessage) => Promise<void>;
  onHide: (id: string, role: "dealer" | "shop") => void;
  onFinalPriceChange: (transaction: Transaction, finalPrice: number) => void;
  onStageChange: (transaction: Transaction, stage: TransactionStage) => Promise<void>;
  onPaymentChange: (transaction: Transaction, status: PaymentStatus) => void;
  onNewRequest: () => void;
  onMarkRead?: (roomId: string) => void;
  onLoadContact?: (transaction: Transaction) => Promise<{ name: string; phone: string } | null>;
  onOpenMessages: (transactionId: string) => void;
}) {
  const [tab, setTab] = useState<"거래내역" | "결제 및 정산">("거래내역");
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<TransactionStage | "전체" | "진행중">("전체");
  const [showHidden, setShowHidden] = useState(false);
  const [stagePending, setStagePending] = useState(false);

  const visible = useMemo(() => transactions
    .filter((item) => showHidden || !(role === "dealer" ? item.visibility.hiddenByDealer : item.visibility.hiddenByInstaller))
    .filter((item) => stageFilter === "전체" || stageFilter === "진행중" && ["시공예약", "입고"].includes(item.status.stage) || item.status.stage === stageFilter)
    .filter((item) => `${item.id} ${item.vehicle.maker} ${item.vehicle.model} ${item.installerName} ${item.status.stage}`.toLowerCase().includes(query.toLowerCase())), [transactions, showHidden, role, query, stageFilter]);
  const selected = visible.find((item) => item.id === selectedId) ?? visible[0];
  const activeCount = transactions.filter((item) => ["시공예약", "입고"].includes(item.status.stage)).length;
  const selectedStageIndex = selected ? stageOrder.indexOf(selected.status.stage) : -1;
  const nextStage = selected ? nextForwardStage(selected.status.stage) : null;
  const canAdvance = Boolean(selected && nextStage && canTransitionStage(selected.status.stage, nextStage, role));

  const advance = async () => {
    if (!selected || !nextStage || !canAdvance || stagePending) return;
    setStagePending(true);
    try {
      await onStageChange(selected, nextStage);
    } finally {
      setStagePending(false);
    }
  };

  return <section className="transaction-management-screen">
    <div className="page-title transaction-page-title"><div><p className="eyebrow">TRANSACTION WORKSPACE</p><h1>{role === "dealer" ? "거래 관리" : "시공 거래 관리"}</h1><p className="page-subtitle">거래 상태, 일정과 다음 업무를 거래별로 관리합니다.</p></div>{role === "dealer" && <button className="primary" onClick={onNewRequest}>+ 새 시공 요청</button>}</div>
    <div className="transaction-summary-strip"><button className={stageFilter === "전체" ? "active" : ""} onClick={() => setStageFilter("전체")}><span>전체 거래</span><b>{transactions.length}</b></button><button className={stageFilter === "견적" ? "active" : ""} onClick={() => setStageFilter("견적")}><span>확인 대기</span><b>{transactions.filter((item) => item.status.stage === "견적").length}</b></button><button className={stageFilter === "진행중" ? "active" : ""} onClick={() => setStageFilter("진행중")}><span>진행 중</span><b>{activeCount}</b></button><button className={stageFilter === "작업완료" ? "active" : ""} onClick={() => setStageFilter("작업완료")}><span>완료</span><b>{transactions.filter((item) => item.status.stage === "작업완료").length}</b></button></div>
    <div className="transaction-tabs"><button className={tab === "거래내역" ? "active" : ""} onClick={() => setTab("거래내역")}>거래내역</button><button className={tab === "결제 및 정산" ? "active" : ""} onClick={() => setTab("결제 및 정산")}>결제 및 정산</button></div>
    <div className="transaction-filters"><label className="search-field"><Search size={18} aria-hidden="true" /><input aria-label="거래 검색" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="거래번호, 차량, 시공점 검색" /></label><select value={stageFilter} onChange={(event) => setStageFilter(event.target.value as TransactionStage | "전체" | "진행중")}><option value="전체">전체 상태</option><option value="진행중">진행 중</option>{[...stageOrder, "취소" as const].map((stage) => <option key={stage} value={stage}>{stage}</option>)}</select><label className="compact-control"><input type="checkbox" checked={showHidden} onChange={(event) => setShowHidden(event.target.checked)} /><span>숨긴 거래 보기</span></label></div>
    {visible.length === 0 ? <section className="empty-state transaction-empty"><span>↗</span><h2>{query ? "검색 결과가 없습니다." : "아직 진행 중인 거래가 없습니다."}</h2><p>{query ? "검색어나 숨긴 거래 설정을 확인해 주세요." : "가격 확인부터 시작해 첫 시공 요청을 만들어 보세요."}</p>{role === "dealer" && !query && <button className="primary" onClick={onNewRequest}>새 시공 요청 만들기</button>}</section>
      : tab === "결제 및 정산" ? <div className="transaction-payment-table">{visible.map((item) => <button data-testid={`transaction-card-${item.id}`} aria-label={`${item.id} ${item.vehicle.maker} ${item.vehicle.model}`} key={item.id} onClick={() => onSelect(item.id)}><b>{item.id}</b><span>{won(item.pricing.finalPrice)}</span><span>{item.pricing.paymentStatus}</span><span>{item.schedule.completedAt ?? "시공일 미정"}</span></button>)}</div>
        : <div className="transaction-room-layout transaction-workspace-layout"><aside className="transaction-list">{visible.map((item) => <button data-testid={`transaction-card-${item.id}`} aria-label={`${item.id} ${item.vehicle.maker} ${item.vehicle.model}`} className={item.id === selected?.id ? "selected" : ""} key={item.id} onClick={() => onSelect(item.id)}><b>{item.id}</b><span>{item.vehicle.maker} {item.vehicle.model}</span><small>{item.installerName} · {item.status.stage}</small><em>{item.lastMessage}</em></button>)}</aside>
          {selected && <article className="transaction-operations-detail" data-testid={`transaction-detail-${selected.id}`}>
            <header><div><small>{selected.id}</small><h2>{selected.vehicle.maker} {selected.vehicle.model}</h2><p>{selected.installerName} · {selected.service.product ?? selected.service.workDescription}</p></div><em className={`status-chip status-${selected.status.stage}`}>{selected.status.stage}</em></header>
            <section className="transaction-progress-card"><div><span>거래 진행 단계</span><b>{selected.status.stage}</b></div><ol>{stageOrder.map((stage, index) => <li className={index < selectedStageIndex ? "complete" : index === selectedStageIndex ? "active" : ""} key={stage}><i>{index < selectedStageIndex ? "✓" : index + 1}</i><span>{stage}</span></li>)}</ol></section>
            <dl className="transaction-core-info"><div><dt>시공 품목</dt><dd>{selected.service.workDescription}</dd></div><div><dt>다음 일정</dt><dd>{selected.schedule.confirmedInboundAt ?? selected.schedule.requestedInboundAt ?? "미정"}</dd></div><div><dt>확정 금액</dt><dd>{won(selected.pricing.finalPrice)}</dd></div><div><dt>결제 상태</dt><dd>{selected.pricing.paymentStatus}</dd></div></dl>
            <footer><button className="secondary" onClick={() => onOpenMessages(selected.id)}><MessageCircle size={17} /> 메시지 열기</button>{canAdvance && <button className="primary" onClick={() => void advance()} disabled={stagePending}>{stagePending ? "처리 중…" : STAGE_ACTION_LABEL[nextStage!] } <ArrowRight size={17} /></button>}</footer>
          </article>}
        </div>}
  </section>;
}
