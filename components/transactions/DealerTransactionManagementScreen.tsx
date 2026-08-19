"use client";

import { useMemo, useState } from "react";
import { FileWarning, Phone, PhoneOff } from "lucide-react";
import { Search } from "lucide-react";
import type { Transaction, TransactionStage } from "../../types/transactions";
import {
  dealerStageIndex,
  isTerminalOutcome,
  OPERATIONAL_STATUS_LABEL,
  vehicleIdentityLabel,
  warrantyStatus,
  WARRANTY_STATUS_LABEL,
} from "../../services/transaction-state-service";

const won = (value?: number) => (value == null ? undefined : `${value.toLocaleString("ko-KR")}원`);
const shortDate = (value?: string) =>
  value ? new Date(value).toLocaleDateString("ko-KR", { month: "short", day: "numeric" }) : undefined;

type Group = "전체" | "진행중" | "완료" | "종료";
const GROUPS: Group[] = ["전체", "진행중", "완료", "종료"];

function groupOf(stage: TransactionStage): Exclude<Group, "전체"> {
  if (isTerminalOutcome(stage)) return "종료";
  if (stage === "출고") return "완료";
  return "진행중";
}

/** Dashboard quick-actions deep-link with a raw internal stage key (e.g.
 * "견적" for the "확인 대기" banner) — collapse it to the matching group so
 * this screen never needs to expose that granularity to the dealer. */
function groupFromStage(stage: TransactionStage | "전체"): Group {
  return stage === "전체" ? "전체" : groupOf(stage);
}

/* 세분 상태 드롭다운은 제거했다 — 탭(진행중/완료/종료)과 축이 겹쳤고(완료 탭
   = 출고 필터, 종료 탭 = 취소+시공불가), 딜러의 동시 진행 거래가 월 2~3건이라
   "진행중 안에서 작업 중만 보기" 세분이 쓰일 일이 없다. 거래량이 늘면 그때
   다시 넣는다. */

/* 상태 칩 색은 raw DB key가 아니라 딜러에게 보이는 4단계 기준으로 정한다.
   raw key 기준이면 같은 "입고 전"으로 접히는 견적(노랑)과 시공예약(파랑)이
   다른 색으로, 다른 단계인 시공예약(입고 전)과 입고(작업 중)가 같은 파랑으로
   나온다. 색 정의 자체(design-system.css)는 그대로 두고 단계별 대표 클래스만
   고른다: 입고 전=대기(warning), 작업 중=진행(primary), 작업 완료=success,
   출고=완결(ink). 취소/시공불가는 raw key가 곧 UI 상태라 그대로 쓴다. 배지에
   보이는 텍스트는 OPERATIONAL_STATUS_LABEL(Dealer/Shop/Admin 공통 어휘)로
   통일한다 — 색은 그대로 4단계, 글자만 확인 필요/일정 확정/작업 중/완료. */
const STAGE_CHIP_CLASSES = ["status-견적", "status-입고", "status-작업완료", "status-출고"] as const;

function stageChipClass(stage: TransactionStage) {
  if (isTerminalOutcome(stage)) return `status-${stage}`;
  return STAGE_CHIP_CLASSES[dealerStageIndex(stage)];
}

/**
 * Dealer 거래관리 — 목록 + 선택한 거래의 상세 요약을 한 화면에서 보여주고,
 * "거래방으로 이동" CTA로 실제 대화/작업 화면(TransactionChatWorkspace)으로
 * 넘긴다. 상세 패널은 읽기 전용 요약일 뿐 — 단계 전환/가격/보증서 발급 같은
 * 액션은 여기 두지 않는다(이미 거래방에 있음). Backend/DB/RLS는 미변경.
 */
export function DealerTransactionManagementScreen({
  transactions,
  initialGroupFilter,
  onOpenTransaction,
  onNewRequest,
  onFindShop,
}: {
  transactions: Transaction[];
  /** One-shot initial group (Dashboard's "확인 대기" / "전체 보기" quick actions) — read once on mount only. */
  initialGroupFilter?: TransactionStage | "전체";
  onOpenTransaction: (id: string) => void;
  onNewRequest: () => void;
  onFindShop: () => void;
}) {
  const [group, setGroup] = useState<Group>(() => groupFromStage(initialGroupFilter ?? "전체"));
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");

  const visible = useMemo(() => transactions.filter((item) => !item.visibility.hiddenByDealer), [transactions]);
  const counts = useMemo(
    () => ({
      전체: visible.length,
      진행중: visible.filter((item) => groupOf(item.status.stage) === "진행중").length,
      완료: visible.filter((item) => groupOf(item.status.stage) === "완료").length,
      종료: visible.filter((item) => groupOf(item.status.stage) === "종료").length,
    }),
    [visible],
  );

  const filtered = useMemo(
    () =>
      visible
        .filter((item) => group === "전체" || groupOf(item.status.stage) === group)
        .filter((item) => {
          const keyword = query.trim().toLowerCase();
          return (
            !keyword ||
            `${item.vehicle.maker} ${item.vehicle.model} ${item.installerName}`.toLowerCase().includes(keyword)
          );
        })
        // "최근 활동" = transactions.updated_at — touched server-side on every
        // stage change, final-price change, outcome change, and chat message
        // insert (set_transaction_room_updated_at trigger), the one timestamp
        // that reflects all of those rather than just one signal.
        .slice()
        .sort((a, b) => b.status.updatedAt.localeCompare(a.status.updatedAt)),
    [visible, group, query],
  );

  // 필터가 바뀌어 선택된 행이 목록에서 사라지면 새 목록의 첫 행으로 자연히
  // 대체된다(별도 effect 없이) — selectedId 자체는 갱신하지 않아도, 다음
  // 클릭이 selectedId를 다시 유효한 값으로 되돌리므로 문제 없다.
  const selected = filtered.find((item) => item.id === selectedId) ?? filtered[0];

  const empty = query.trim()
    ? { title: "검색 결과가 없습니다.", body: "차량, 시공점 이름으로 다시 검색해 보세요." }
    : visible.length === 0
      ? { title: "아직 진행 중인 거래가 없습니다.", body: "시공점을 찾아 첫 시공 요청을 시작해 보세요." }
      : group === "진행중"
        ? { title: "진행 중인 거래가 없습니다.", body: "" }
        : group === "완료"
          ? { title: "완료된 거래가 없습니다.", body: "" }
          : group === "종료"
            ? { title: "종료된 거래가 없습니다.", body: "" }
            : { title: "해당 조건의 거래가 없습니다.", body: "검색어나 필터를 확인해 주세요." };

  return (
    <section className="transaction-management-screen dealer-transaction-management">
      <div className="page-title transaction-page-title">
        <div>
          <p className="eyebrow">TRANSACTION WORKSPACE</p>
          <h1>거래 관리</h1>
          <p className="page-subtitle">진행 중인 차량과 거래를 빠르게 찾아 거래방으로 이동하세요.</p>
        </div>
        <button className="primary" onClick={onNewRequest}>
          + 새 시공 요청
        </button>
      </div>

      <div className="transaction-tabs dealer-deal-groups">
        {GROUPS.map((value) => (
          <button key={value} className={group === value ? "active" : ""} onClick={() => setGroup(value)}>
            {value} <em>{counts[value]}</em>
          </button>
        ))}
      </div>

      <div className="transaction-filters">
        <label className="search-field">
          <Search size={18} aria-hidden="true" />
          <input
            aria-label="거래 검색"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="차량, 시공점으로 검색"
          />
        </label>
      </div>

      {filtered.length === 0 ? (
        <section className="empty-state transaction-empty">
          <span>↗</span>
          <h2>{empty.title}</h2>
          {empty.body && <p>{empty.body}</p>}
          {visible.length === 0 && !query.trim() && (
            <button className="primary" onClick={onFindShop}>
              시공점 찾기
            </button>
          )}
        </section>
      ) : (
        <div className="transaction-room-layout dealer-transaction-workspace-layout">
          <aside className="transaction-list dealer-transaction-list" role="list" aria-label="거래 작업 목록">
            {filtered.map((item) => {
              const terminal = isTerminalOutcome(item.status.stage);
              const inPhoneConfirmWindow = item.status.stage === "견적" || item.status.stage === "시공예약";
              const needsPhoneConfirm = inPhoneConfirmWindow && item.contactStatus == null;
              const contactUnreachable = item.contactStatus === "unreachable";
              const scheduled =
                !terminal && item.status.stage !== "출고"
                  ? shortDate(item.schedule.confirmedInboundAt ?? item.schedule.requestedInboundAt)
                  : undefined;
              // 작업 생성 직후~입고 전엔 옅게, 입고~작업완료(출고 전) 구간부터는
              // 강조 스타일로 — 처음부터 강하게 방해하지 않는다는 요구사항 그대로.
              const warranty = warrantyStatus(item.warranty);
              const warrantyUrgent = item.status.stage === "입고" || item.status.stage === "작업완료";
              const showWarrantyFlag = !terminal && warranty !== "READY" && warranty !== "ISSUED";
              const vehicleId = vehicleIdentityLabel(item.warranty);
              return (
                <button
                  key={item.id}
                  role="listitem"
                  data-testid={`transaction-card-${item.id}`}
                  data-stage={item.status.stage}
                  aria-label={`${item.id} ${item.vehicle.maker} ${item.vehicle.model}`}
                  className={item.id === selected?.id ? "selected" : ""}
                  onClick={() => setSelectedId(item.id)}
                >
                  <b>
                    {item.vehicle.maker} {item.vehicle.model}
                  </b>
                  <span>
                    {item.installerName} · {item.service.product ?? item.service.workDescription}
                  </span>
                  <small className="dealer-transaction-row-meta">
                    {[scheduled ? `입고 ${scheduled}` : "일정 미정", vehicleId].filter(Boolean).join(" · ")}
                  </small>
                  <em className={`status-chip ${stageChipClass(item.status.stage)}`}>
                    {OPERATIONAL_STATUS_LABEL[item.status.stage]}
                  </em>
                  {showWarrantyFlag && (
                    <small
                      className={`phone-confirm-flag${warrantyUrgent ? " phone-confirm-flag-unreachable" : ""}`}
                    >
                      <FileWarning size={11} aria-hidden="true" />{" "}
                      {item.warranty.vehicleNumber == null && item.warranty.vin
                        ? "차량번호 대기"
                        : "보증서 정보 미입력"}
                    </small>
                  )}
                  {(warranty === "READY" || warranty === "ISSUED") && (
                    <small className={`warranty-badge warranty-badge-${warranty.toLowerCase()}`}>
                      {WARRANTY_STATUS_LABEL[warranty]}
                    </small>
                  )}
                  {needsPhoneConfirm && (
                    <small className="phone-confirm-flag">
                      <Phone size={11} aria-hidden="true" /> 전화 확인 필요
                    </small>
                  )}
                  {contactUnreachable && (
                    <small className="phone-confirm-flag phone-confirm-flag-unreachable">
                      <PhoneOff size={11} aria-hidden="true" /> 연락 안 됨
                    </small>
                  )}
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
                    {selected.installerName} · {selected.service.product ?? selected.service.workDescription}
                  </p>
                </div>
                <div className="transaction-detail-status">
                  <span>현재 상태</span>
                  <em className={`status-chip ${stageChipClass(selected.status.stage)}`}>
                    {OPERATIONAL_STATUS_LABEL[selected.status.stage]}
                  </em>
                </div>
              </header>
              <dl className="transaction-core-info">
                <div>
                  <dt>다음 행동</dt>
                  <dd>
                    {isTerminalOutcome(selected.status.stage)
                      ? "기록 보기"
                      : selected.status.stage === "견적"
                        ? "시공점의 요청 확인 대기"
                        : selected.status.stage === "출고"
                          ? "거래 완료"
                          : "거래방에서 진행 상황 확인"}
                  </dd>
                </div>
                <div>
                  <dt>시공점</dt>
                  <dd>{selected.installerName}</dd>
                </div>
                <div>
                  <dt>시공 항목</dt>
                  <dd>{selected.service.product ?? selected.service.workDescription}</dd>
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
                  <dt>입고 일정</dt>
                  <dd>{shortDate(selected.schedule.confirmedInboundAt ?? selected.schedule.requestedInboundAt) || "미정"}</dd>
                </div>
                <div>
                  <dt>출고 일정</dt>
                  <dd>{shortDate(selected.schedule.desiredReleaseAt) || "미정"}</dd>
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
                  <dt>보증서 상태</dt>
                  <dd>
                    <small className={`warranty-badge warranty-badge-${warrantyStatus(selected.warranty).toLowerCase()}`}>
                      {WARRANTY_STATUS_LABEL[warrantyStatus(selected.warranty)]}
                    </small>
                  </dd>
                </div>
                <div>
                  <dt>최종 시공금액</dt>
                  <dd>{won(selected.pricing.finalPrice) ?? "미확정"}</dd>
                </div>
              </dl>
              <footer className="dealer-transaction-detail-footer">
                <button className="primary" onClick={() => onOpenTransaction(selected.id)}>
                  거래방으로 이동
                </button>
              </footer>
            </article>
          )}
        </div>
      )}
    </section>
  );
}
