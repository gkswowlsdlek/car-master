"use client";

import { useMemo, useState } from "react";
import { ArrowRight, MessageCircle, Search } from "lucide-react";
import type {
  ChatRoom,
  PaymentStatus,
  Transaction,
  TransactionChatMessage,
  TransactionStage,
  WarrantyStatus,
} from "../../types/transactions";
import {
  canTransitionStage,
  dealerStageIndex,
  dealerStageLabel,
  DEALER_STAGE_LABELS,
  isTerminalOutcome,
  nextForwardStage,
  OPERATIONAL_STATUS_LABEL,
  stageOrder,
  STAGE_ACTION_LABEL,
  vehicleIdentityLabel,
  warrantyStatus,
  WARRANTY_STATUS_LABEL,
} from "../../services/transaction-state-service";
import { EndTransactionOutcomeModal } from "./EndTransactionOutcomeModal";

const won = (value?: number) => (value == null ? "미확정" : `${value.toLocaleString("ko-KR")}원`);
const scheduleDate = (value?: string) =>
  value
    ? new Date(value).toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric", weekday: "short" })
    : "미정";

export function TransactionManagementScreen({
  role,
  transactions,
  selectedId,
  initialStageFilter,
  onSelect,
  onHide,
  onUnhide,
  onFinalPriceChange,
  onStageChange,
  onEndOutcome,
  onFindAnotherShop,
  onNewRequest,
  onOpenMessages,
}: {
  role: "dealer" | "shop";
  userId: string;
  transactions: Transaction[];
  rooms: ChatRoom[];
  selectedId: string;
  /** One-shot initial filter (e.g. a Dashboard quick-action for "확인 대기 거래") — only read on mount, not kept in sync afterwards. */
  initialStageFilter?: TransactionStage | "전체" | "진행중";
  useRemoteAttachments: boolean;
  onSelect: (id: string) => void;
  onSend: (transaction: Transaction, message: TransactionChatMessage) => Promise<void>;
  onHide: (id: string, role: "dealer" | "shop") => void;
  onUnhide: (id: string, role: "dealer" | "shop") => void;
  onFinalPriceChange: (transaction: Transaction, finalPrice: number) => void;
  onStageChange: (transaction: Transaction, stage: TransactionStage) => Promise<void>;
  onPaymentChange: (transaction: Transaction, status: PaymentStatus) => void;
  /** 취소/시공불가 — never deletes the Transaction/Room/Messages/Shop (Phase 5). */
  onEndOutcome: (transaction: Transaction, outcome: "취소" | "시공불가", note?: string) => Promise<void>;
  /** Only meaningful for role === "dealer" on a terminated transaction. */
  onFindAnotherShop?: () => void;
  onNewRequest: () => void;
  onMarkRead?: (roomId: string) => void;
  /** Prepends the previous page of chat history for one room. */
  onLoadOlder?: (roomId: string) => Promise<boolean>;
  onLoadContact?: (transaction: Transaction) => Promise<{ name: string; phone: string } | null>;
  onOpenMessages: (transactionId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<TransactionStage | "전체" | "진행중">(initialStageFilter ?? "전체");
  const [warrantyFilter, setWarrantyFilter] = useState<WarrantyStatus | "전체">("전체");
  const [showHidden, setShowHidden] = useState(false);
  const [stagePending, setStagePending] = useState(false);
  const [finalPriceDraft, setFinalPriceDraft] = useState("");
  const [endOutcomeModal, setEndOutcomeModal] = useState<"취소" | "시공불가" | null>(null);

  const visible = useMemo(
    () =>
      transactions
        .filter(
          (item) =>
            showHidden || !(role === "dealer" ? item.visibility.hiddenByDealer : item.visibility.hiddenByInstaller),
        )
        .filter(
          (item) =>
            stageFilter === "전체" ||
            (stageFilter === "진행중" && ["시공예약", "입고"].includes(item.status.stage)) ||
            item.status.stage === stageFilter,
        )
        .filter((item) => warrantyFilter === "전체" || warrantyStatus(item.warranty) === warrantyFilter)
        .filter((item) =>
          `${item.id} ${item.vehicle.maker} ${item.vehicle.model} ${item.installerName} ${item.status.stage}`
            .toLowerCase()
            .includes(query.toLowerCase()),
        ),
    [transactions, showHidden, role, query, stageFilter, warrantyFilter],
  );
  const selected = visible.find((item) => item.id === selectedId) ?? visible[0];
  const selectedTerminalOutcome = selected ? isTerminalOutcome(selected.status.stage) : false;
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
  const saveFinalPrice = () => {
    if (!selected) return;
    const value = Number(finalPriceDraft.replace(/\D/g, ""));
    if (value <= 0) return;
    onFinalPriceChange(selected, value);
    setFinalPriceDraft("");
  };
  const hideSelected = () => {
    if (!selected) return;
    const warning =
      !["작업완료", "출고", "취소", "시공불가"].includes(selected.status.stage) && role === "shop"
        ? "진행 중인 거래입니다. 그래도 숨기시겠습니까?\n"
        : "";
    if (confirm(`${warning}이 거래방은 목록에서 숨겨집니다. 거래 기록은 카마스터에 보관됩니다.`))
      onHide(selected.id, role);
  };

  return (
    <section
      className={`transaction-management-screen ${role === "shop" ? "shop-transaction-management" : "dealer-transaction-management"}`}
    >
      <div className="page-title transaction-page-title">
        <div>
          <p className="eyebrow">{role === "dealer" ? "거래 관리" : "시공 거래 운영"}</p>
          <h1>{role === "dealer" ? "거래 관리" : "시공 거래 관리"}</h1>
          <p className="page-subtitle">
            {role === "dealer"
              ? "진행 중인 차량과 거래를 빠르게 찾아 거래방으로 이동하세요."
              : "입고 예정, 진행 중인 차량과 Dealer 요청을 업무 순서대로 처리하세요."}
          </p>
        </div>
        {role === "dealer" && (
          <button className="primary" onClick={onNewRequest}>
            + 새 시공 요청
          </button>
        )}
      </div>
      <div className={`transaction-summary-strip ${role === "shop" ? "shop-operation-strip" : ""}`}>
        <button className={stageFilter === "전체" ? "active" : ""} onClick={() => setStageFilter("전체")}>
          <span>{role === "shop" ? "전체" : "전체 거래"}</span>
          <b>{transactions.length}</b>
        </button>
        <button className={stageFilter === "견적" ? "active" : ""} onClick={() => setStageFilter("견적")}>
          <span>{role === "shop" ? "확인 필요" : "확인 대기"}</span>
          <b>{transactions.filter((item) => item.status.stage === "견적").length}</b>
        </button>
        <button className={stageFilter === "진행중" ? "active" : ""} onClick={() => setStageFilter("진행중")}>
          <span>{role === "shop" ? "작업 중" : "진행 중"}</span>
          <b>{activeCount}</b>
        </button>
        <button className={stageFilter === "작업완료" ? "active" : ""} onClick={() => setStageFilter("작업완료")}>
          <span>완료</span>
          <b>{transactions.filter((item) => item.status.stage === "작업완료").length}</b>
        </button>
      </div>
      <div className="transaction-filters">
        <label className="search-field">
          <Search size={18} aria-hidden="true" />
          <input
            aria-label="거래 검색"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="거래번호, 차량, 시공점 검색"
          />
        </label>
        <select
          value={stageFilter}
          onChange={(event) => setStageFilter(event.target.value as TransactionStage | "전체" | "진행중")}
        >
          <option value="전체">전체 상태</option>
          <option value="진행중">진행 중</option>
          {[...stageOrder, "취소" as const, "시공불가" as const].map((stage) => (
            <option key={stage} value={stage}>
              {stage}
            </option>
          ))}
        </select>
        {role === "shop" && (
          <select
            aria-label="보증서 상태 필터"
            value={warrantyFilter}
            onChange={(event) => setWarrantyFilter(event.target.value as WarrantyStatus | "전체")}
          >
            <option value="전체">보증서 상태: 전체</option>
            <option value="READY">발급 대기</option>
            <option value="ISSUED">발급 완료</option>
          </select>
        )}
        <label className="compact-control">
          <input type="checkbox" checked={showHidden} onChange={(event) => setShowHidden(event.target.checked)} />
          <span>숨긴 거래 보기</span>
        </label>
      </div>
      {visible.length === 0 ? (
        <section className="empty-state transaction-empty">
          <span>↗</span>
          <h2>{query ? "검색 결과가 없습니다." : "아직 진행 중인 거래가 없습니다."}</h2>
          <p>
            {query ? "검색어나 숨긴 거래 설정을 확인해 주세요." : "가격 확인부터 시작해 첫 시공 요청을 만들어 보세요."}
          </p>
          {role === "dealer" && !query && (
            <button className="primary" onClick={onNewRequest}>
              새 시공 요청 만들기
            </button>
          )}
        </section>
      ) : (
        <div className="transaction-room-layout transaction-workspace-layout">
          <aside className="transaction-list">
            {visible.map((item) => {
              const vehicleId = vehicleIdentityLabel(item.warranty);
              const itemWarranty = warrantyStatus(item.warranty);
              return (
                <button
                  data-testid={`transaction-card-${item.id}`}
                  aria-label={`${item.id} ${item.vehicle.maker} ${item.vehicle.model}`}
                  className={item.id === selected?.id ? "selected" : ""}
                  key={item.id}
                  onClick={() => onSelect(item.id)}
                >
                  <b>
                    {item.vehicle.maker} {item.vehicle.model}
                  </b>
                  <small>
                    {role === "shop"
                      ? [item.dealerName || "Dealer 요청", item.dealerCompanyName].filter(Boolean).join(" · ")
                      : item.installerName}
                  </small>
                  <small className="transaction-list-schedule">
                    입고 {scheduleDate(item.schedule.confirmedInboundAt ?? item.schedule.requestedInboundAt)}
                    {item.schedule.desiredReleaseAt ? ` · 출고 ${scheduleDate(item.schedule.desiredReleaseAt)}` : ""}
                    {vehicleId ? ` · ${vehicleId}` : ""}
                  </small>
                  <em className={`status-chip status-${item.status.stage}`}>
                    {role === "dealer" ? dealerStageLabel(item.status.stage) : OPERATIONAL_STATUS_LABEL[item.status.stage]}
                  </em>
                  <small className={`warranty-badge warranty-badge-${itemWarranty.toLowerCase()}`}>
                    {WARRANTY_STATUS_LABEL[itemWarranty]}
                  </small>
                  <em>{item.lastMessage}</em>
                </button>
              );
            })}
          </aside>
          {selected && (
            <article className="transaction-operations-detail" data-testid={`transaction-detail-${selected.id}`}>
              <header>
                <div>
                  <small>{selected.id}</small>
                  <h2>
                    {selected.vehicle.maker} {selected.vehicle.model}
                  </h2>
                  <p>
                    {role === "shop"
                      ? [selected.dealerName || "담당 딜러", selected.dealerCompanyName].filter(Boolean).join(" · ")
                      : selected.installerName}{" "}
                    · {selected.service.product ?? selected.service.workDescription}
                  </p>
                </div>
                <div className="transaction-detail-status">
                  <span>현재 상태</span>
                  <em className={`status-chip status-${selected.status.stage}`}>
                    {role === "dealer" ? dealerStageLabel(selected.status.stage) : OPERATIONAL_STATUS_LABEL[selected.status.stage]}
                  </em>
                </div>
              </header>
              <section className="transaction-progress-card">
                <div>
                  <span>거래 진행 단계</span>
                  <b>{role === "dealer" ? dealerStageLabel(selected.status.stage) : selected.status.stage}</b>
                </div>
                <ol>
                  {role === "dealer"
                    ? DEALER_STAGE_LABELS.map((label, index) => {
                        const dealerIndex = dealerStageIndex(selected.status.stage);
                        return (
                          <li
                            className={index < dealerIndex ? "complete" : index === dealerIndex ? "active" : ""}
                            key={label}
                          >
                            <i>{index < dealerIndex ? "✓" : index + 1}</i>
                            <span>{label}</span>
                          </li>
                        );
                      })
                    : stageOrder.map((stage, index) => (
                        <li
                          className={
                            index < selectedStageIndex ? "complete" : index === selectedStageIndex ? "active" : ""
                          }
                          key={stage}
                        >
                          <i>{index < selectedStageIndex ? "✓" : index + 1}</i>
                          <span>{stage}</span>
                        </li>
                      ))}
                </ol>
              </section>
              {role === "shop" && canAdvance && (
                <div className="shop-next-action">
                  <span>다음 처리</span>
                  <b>{STAGE_ACTION_LABEL[nextStage!]}</b>
                  <button className="primary" onClick={() => void advance()} disabled={stagePending}>
                    {stagePending ? "처리 중…" : STAGE_ACTION_LABEL[nextStage!]} <ArrowRight size={17} />
                  </button>
                </div>
              )}
              <dl className="transaction-core-info">
                <div>
                  <dt>시공 품목</dt>
                  <dd>{selected.service.product ? `${selected.service.product} · ${selected.service.workDescription}` : selected.service.workDescription}</dd>
                </div>
                <div>
                  <dt>입고 일정</dt>
                  <dd>{scheduleDate(selected.schedule.confirmedInboundAt ?? selected.schedule.requestedInboundAt)}</dd>
                </div>
                <div>
                  <dt>출고 일정</dt>
                  <dd>{scheduleDate(selected.schedule.desiredReleaseAt)}</dd>
                </div>
                <div>
                  <dt>차량번호</dt>
                  <dd>{selected.warranty.vehicleNumber || "미등록"}</dd>
                </div>
                <div>
                  <dt>차대번호</dt>
                  <dd>{selected.warranty.vin || "미등록"}</dd>
                </div>
                <div>
                  <dt>고객명</dt>
                  <dd>{selected.warranty.customerName || "미등록"}</dd>
                </div>
                <div>
                  <dt>고객 연락처</dt>
                  <dd>{selected.warranty.customerPhone || "미등록"}</dd>
                </div>
                <div>
                  <dt>최종 시공금액</dt>
                  <dd>{won(selected.pricing.finalPrice)}</dd>
                </div>
                {/* Free Beta에서는 payment/settlement UI 비활성. 향후 결제 모델
                    확정 후 재검토 — 결제 상태 표시는 여기서 숨기고, DB
                    컬럼(pricing.paymentStatus)/RPC(onPaymentChange, transitionPayment)는
                    그대로 둔다. */}
                <div>
                  <dt>보증서 상태</dt>
                  <dd>
                    <small
                      className={`warranty-badge warranty-badge-${warrantyStatus(selected.warranty).toLowerCase()}`}
                    >
                      {WARRANTY_STATUS_LABEL[warrantyStatus(selected.warranty)]}
                    </small>
                  </dd>
                </div>
              </dl>
              {selectedTerminalOutcome && (
                <div className={`transaction-outcome-banner outcome-${selected.status.stage}`}>
                  <b>
                    {selected.status.stage === "취소"
                      ? "이 거래는 취소되었습니다."
                      : "이 거래는 시공 불가로 종료되었습니다."}
                  </b>
                  {selected.outcomeNote && <p>{selected.outcomeNote}</p>}
                </div>
              )}
              {(role === "shop" || role === "dealer") && (
                <div className="transaction-price-editor">
                  <span>최종 시공금액 입력</span>
                  <div>
                    <input
                      value={finalPriceDraft}
                      onChange={(event) => setFinalPriceDraft(event.target.value)}
                      placeholder="예: 450000"
                      inputMode="numeric"
                    />
                    <button className="secondary" onClick={saveFinalPrice} disabled={!finalPriceDraft}>
                      저장
                    </button>
                  </div>
                </div>
              )}
              <footer>
                <button className="primary" onClick={() => onOpenMessages(selected.id)}>
                  <MessageCircle size={17} /> 거래방으로 이동
                </button>
                {(role === "dealer" ? selected.visibility.hiddenByDealer : selected.visibility.hiddenByInstaller) ? (
                  <button className="secondary" onClick={() => onUnhide(selected.id, role)}>
                    숨김 해제
                  </button>
                ) : (
                  <button className="secondary" onClick={hideSelected}>
                    거래 숨기기
                  </button>
                )}
                {role === "dealer" && !selectedTerminalOutcome && (
                  <button className="secondary" onClick={() => setEndOutcomeModal("취소")}>
                    거래 취소
                  </button>
                )}
                {role === "dealer" && !selectedTerminalOutcome && (
                  <button className="secondary" onClick={() => setEndOutcomeModal("시공불가")}>
                    시공 불가
                  </button>
                )}
                {role === "dealer" && selectedTerminalOutcome && onFindAnotherShop && (
                  <button className="primary" onClick={onFindAnotherShop}>
                    <Search size={17} /> 다른 시공점 찾기
                  </button>
                )}
                {role === "dealer" && canAdvance && (
                  <button className="primary" onClick={() => void advance()} disabled={stagePending}>
                    {stagePending ? "처리 중…" : STAGE_ACTION_LABEL[nextStage!]} <ArrowRight size={17} />
                  </button>
                )}
              </footer>
            </article>
          )}
        </div>
      )}
      {endOutcomeModal && selected && (
        <EndTransactionOutcomeModal
          outcome={endOutcomeModal}
          onClose={() => setEndOutcomeModal(null)}
          onConfirm={async (note) => {
            await onEndOutcome(selected, endOutcomeModal, note);
            setEndOutcomeModal(null);
          }}
        />
      )}
    </section>
  );
}
