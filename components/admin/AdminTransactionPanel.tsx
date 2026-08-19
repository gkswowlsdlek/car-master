"use client";
import { useMemo, useState } from "react";
import { MessageSquare, PhoneOff } from "lucide-react";
import { isTerminalOutcome, stageLogLabel, stageOrder } from "../../services/transaction-state-service";
import { vehicleIdentityLabel, warrantyStatus, WARRANTY_STATUS_LABEL } from "../../services/transaction-state-service";
import type { ChatRoom, Transaction, TransactionStage } from "../../types/transactions";

const won = (value?: number) => (value == null ? undefined : `${value.toLocaleString("ko-KR")}원`);
const CONTACT_STATUS_LABEL: Record<string, string> = { contacted: "연결됨", unreachable: "연락 안 됨" };
const scheduleDate = (value?: string) =>
  value ? new Date(value).toLocaleDateString("ko-KR", { month: "short", day: "numeric" }) : "미정";

/** Unified search across every field an Admin might remember when
 * mediating a dispute — transaction id, customer, dealer (+ company), shop,
 * vehicle maker/model, plate, VIN. All of these already live on Transaction
 * (warranty snapshot fields added for warranty-issuance) — no new table. */
function searchHaystack(item: Transaction): string {
  return [
    item.id,
    item.warranty.customerName,
    item.warranty.customerPhone,
    item.dealerName,
    item.dealerCompanyName,
    item.installerName,
    item.vehicle.maker,
    item.vehicle.model,
    item.warranty.vehicleNumber,
    item.warranty.vin,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export type TransactionGroup = "전체" | "진행중" | "완료" | "종료";
const GROUPS: TransactionGroup[] = ["전체", "진행중", "완료", "종료"];
export function groupOf(stage: TransactionStage): Exclude<TransactionGroup, "전체"> {
  if (isTerminalOutcome(stage)) return "종료";
  if (stage === "출고") return "완료";
  return "진행중";
}

export function AdminTransactionPanel({
  transactions,
  rooms,
  group,
  onGroupChange,
  contactFilter,
  onContactFilterChange,
}: {
  transactions: Transaction[];
  rooms: ChatRoom[];
  /** Controlled by the parent so an Ops Queue card click can jump straight to a filtered view. */
  group: TransactionGroup;
  onGroupChange: (group: TransactionGroup) => void;
  /** Same controlled pattern, for the "연락 실패 거래" Queue card (Phase 8). */
  contactFilter: "전체" | "연락실패";
  onContactFilterChange: (value: "전체" | "연락실패") => void;
}) {
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<TransactionStage | "전체">("전체");
  const [selectedId, setSelectedId] = useState("");
  const [showRoom, setShowRoom] = useState(false);
  const visible = useMemo(
    () =>
      transactions
        .filter((item) => group === "전체" || groupOf(item.status.stage) === group)
        .filter((item) => stage === "전체" || item.status.stage === stage)
        .filter((item) => contactFilter === "전체" || item.contactStatus === "unreachable")
        .filter((item) => searchHaystack(item).includes(query.trim().toLowerCase())),
    [transactions, query, stage, group, contactFilter],
  );
  const selected = visible.find((item) => item.id === selectedId) ?? visible[0];
  const room = rooms.find((item) => item.transactionId === selected?.id);
  return (
    <section className="admin-transaction-panel" id="admin-transaction-panel">
      <div className="section-head">
        <div>
          <p className="eyebrow">TRANSACTION CONTROL</p>
          <h2>전체 거래 모니터링</h2>
          <p>사용자 숨김 여부와 관계없이 모든 거래 기록을 확인합니다.</p>
        </div>
        <div className="admin-search-tools">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="거래번호, 고객명, 연락처, 딜러, 시공점, 차량, 차량번호, 차대번호 검색"
            aria-label="통합 거래 검색"
          />
          <select value={stage} onChange={(event) => setStage(event.target.value as TransactionStage | "전체")}>
            <option value="전체">전체 상태</option>
            {[...stageOrder, "취소" as const, "시공불가" as const].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="transaction-tabs admin-transaction-groups">
        {GROUPS.map((value) => (
          <button key={value} className={group === value ? "active" : ""} onClick={() => onGroupChange(value)}>
            {value}
          </button>
        ))}
        <button
          className={contactFilter === "연락실패" ? "active" : ""}
          onClick={() => onContactFilterChange(contactFilter === "연락실패" ? "전체" : "연락실패")}
        >
          <PhoneOff size={13} aria-hidden="true" /> 연락 실패만
        </button>
      </div>
      {visible.length === 0 ? (
        <div className="compact-empty">
          <b>조건에 맞는 거래가 없습니다.</b>
          <span>검색어 또는 상태 필터를 변경해 주세요.</span>
        </div>
      ) : (
        <div className="admin-transaction-layout">
          <div className="admin-transaction-list">
            {visible.map((item) => {
              const vehicleId = vehicleIdentityLabel(item.warranty);
              const itemWarranty = warrantyStatus(item.warranty);
              return (
                <button
                  className={item.id === selected?.id ? "selected" : ""}
                  key={item.id}
                  onClick={() => {
                    setSelectedId(item.id);
                    setShowRoom(false);
                  }}
                >
                  <span>
                    <b>
                      {item.vehicle.maker} {item.vehicle.model}
                    </b>
                    <small>
                      {item.id}
                      {vehicleId ? ` · ${vehicleId}` : ""}
                    </small>
                  </span>
                  <span>
                    담당 딜러
                    <small>{[item.dealerName, item.dealerCompanyName].filter(Boolean).join(" · ") || "미확인"}</small>
                  </span>
                  <span>
                    시공점<small>{item.installerName}</small>
                  </span>
                  <span>
                    시공 항목<small>{item.service.product ?? item.service.workDescription}</small>
                  </span>
                  <span>
                    일정<small>{scheduleDate(item.schedule.confirmedInboundAt ?? item.schedule.requestedInboundAt)}</small>
                  </span>
                  <em className={`status-chip status-${item.status.stage}`}>{item.status.stage}</em>
                  <small className={`warranty-badge warranty-badge-${itemWarranty.toLowerCase()}`}>
                    {WARRANTY_STATUS_LABEL[itemWarranty]}
                  </small>
                </button>
              );
            })}
          </div>
          {selected && (
            <aside className="admin-transaction-detail">
              <div>
                <span>{selected.id}</span>
                <em className={`status-chip status-${selected.status.stage}`}>{selected.status.stage}</em>
              </div>
              <h3>
                {selected.vehicle.maker} {selected.vehicle.model}
              </h3>
              <dl>
                <div>
                  <dt>담당 딜러</dt>
                  <dd>{selected.dealerName || "미확인"}</dd>
                </div>
                <div>
                  <dt>딜러 소속</dt>
                  <dd>{selected.dealerCompanyName || "미확인"}</dd>
                </div>
                <div>
                  <dt>시공점</dt>
                  <dd>{selected.installerName}</dd>
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
                  <dt>작업</dt>
                  <dd>{selected.service.workDescription}</dd>
                </div>
                <div>
                  <dt>일정</dt>
                  <dd>{scheduleDate(selected.schedule.confirmedInboundAt ?? selected.schedule.requestedInboundAt)}</dd>
                </div>
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
                <div>
                  <dt>결제</dt>
                  <dd>{selected.pricing.paymentStatus}</dd>
                </div>
                {selected.pricing.finalPrice != null && (
                  <div>
                    <dt>최종 시공금액</dt>
                    <dd>{won(selected.pricing.finalPrice)}</dd>
                  </div>
                )}
                {selected.outcomeNote && (
                  <div>
                    <dt>종료 사유</dt>
                    <dd>{selected.outcomeNote}</dd>
                  </div>
                )}
                <div>
                  <dt>연락 상태</dt>
                  <dd>{selected.contactStatus ? CONTACT_STATUS_LABEL[selected.contactStatus] : "확인 전"}</dd>
                </div>
                <div>
                  <dt>최근 업데이트</dt>
                  <dd>{new Date(selected.status.updatedAt).toLocaleString("ko-KR")}</dd>
                </div>
                <div>
                  <dt>사용자 숨김</dt>
                  <dd>
                    딜러 {selected.visibility.hiddenByDealer ? "예" : "아니오"} · 시공점{" "}
                    {selected.visibility.hiddenByInstaller ? "예" : "아니오"}
                  </dd>
                </div>
              </dl>
              <h4>거래 로그</h4>
              <div className="admin-stage-log">
                {selected.stageLog.length === 0 ? (
                  <small>기록이 없습니다.</small>
                ) : (
                  [...selected.stageLog].reverse().map((event) => (
                    <p key={event.id}>
                      <b>{new Date(event.createdAt).toLocaleString("ko-KR")}</b>
                      <span>{stageLogLabel(event)}</span>
                    </p>
                  ))
                )}
              </div>
              <button type="button" className="admin-open-room-button" onClick={() => setShowRoom((value) => !value)}>
                <MessageSquare size={16} aria-hidden="true" /> {showRoom ? "거래방 접기" : "거래방 보기"}
              </button>
              {showRoom && (
                <div className="admin-chat-preview admin-chat-full">
                  {room && room.messages.length > 0 ? (
                    room.messages.map((message) => (
                      <p key={message.id}>
                        <b>{message.senderRole}</b>
                        <span>{message.text}</span>
                      </p>
                    ))
                  ) : (
                    <small>채팅 기록이 없습니다.</small>
                  )}
                </div>
              )}
            </aside>
          )}
        </div>
      )}
    </section>
  );
}
