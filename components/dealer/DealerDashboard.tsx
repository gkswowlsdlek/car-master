import { Bell, CalendarCheck, ChevronRight, MapPin, MessageCircle, Phone, Search } from "lucide-react";
import { useState } from "react";
import type { AppNotification } from "../../hooks/use-notifications";
import type { Transaction, TransactionStage } from "../../types/transactions";
import { dealerStageLabel } from "../../services/transaction-state-service";
import { EmptyState, ErrorState, SkeletonList } from "../common/ScreenState";

/** 실제 계정으로 갓 가입한 딜러가 처음 보는 화면이 바로 이 상태다. 빈 카드
 * 세 개를 나란히 보여주는 대신, 딜러가 실제로 밟아야 하는 세 단계를 한 블록에
 * 담아 시공점 찾기로 곧장 연결한다. */
const FIRST_RUN_STEPS = [
  "고객 차량이 있는 지역을 검색합니다.",
  "시공점을 고르고 시공 요청을 보냅니다.",
  "거래방에서 일정과 진행 상황을 관리합니다.",
];

const ACTIVE_STAGES: TransactionStage[] = ["시공예약", "입고"];

function DealRow({ deal, onOpenTransaction }: { deal: Transaction; onOpenTransaction: (id: string) => void }) {
  const inbound = deal.schedule.confirmedInboundAt ?? deal.schedule.requestedInboundAt;
  return (
    <button className="ws-row" onClick={() => onOpenTransaction(deal.id)}>
      <span className="ws-row-main">
        <b>
          {deal.vehicle.maker} {deal.vehicle.model}
        </b>
        <small>
          {deal.installerName} · {deal.service.workDescription || deal.service.product || "작업 내용 미정"}
        </small>
      </span>
      <span className="ws-row-schedule">
        <small>입고</small>
        <b>{inbound ? new Date(inbound).toLocaleDateString("ko-KR", { month: "short", day: "numeric" }) : "미정"}</b>
      </span>
      {/* 상태 칩과 전화 확인 칩을 한 칸에 묶는다 — 배지가 그리드의 5번째
       * 항목이 되면서 행마다 폭 전체를 차지하는 경고 띠로 흘러내렸고, 3건이
       * 모두 같은 문구라 실제 정보보다 목록을 시끄럽게 만들고 있었다. */}
      <span className="ws-row-status">
        <em className={`status-chip status-${deal.status.stage}`}>{dealerStageLabel(deal.status.stage)}</em>
        {deal.contactStatus === undefined && (
          <span className="ws-badge ws-badge-red">
            <Phone size={11} /> 전화 확인
          </span>
        )}
      </span>
      <span className="ws-row-next" aria-hidden="true">
        <ChevronRight size={16} />
      </span>
    </button>
  );
}
export function DealerDashboard({
  dealerName,
  deals,
  notifications,
  onFilterDeals,
  onOpenTransaction,
  onOpenMessages,
  onNewRequest: _onNewRequest,
  onFindShop,
  onSearchLocation,
  onShopSearchRequests,
  relativeTime,
  loading = false,
  loadError = "",
  onRetry,
}: {
  dealerName: string;
  deals: Transaction[];
  /** 새 메시지·거래 상태 변경·Admin 시공점 제안 — 전부 기존 데이터에서 파생된
   * 것이라(hooks/use-notifications) 가짜 항목이 섞일 수 없다. 빈 배열이면
   * 두 카드 모두 빈 상태를 보여준다. */
  notifications: AppNotification[];
  onFilterDeals: (filter: TransactionStage | "전체") => void;
  onOpenTransaction: (id: string) => void;
  /** 메신저로 이동(특정 거래 지정 없이) — "새 메시지" 카드의 전체 보기 전용. */
  onOpenMessages: () => void;
  onNewRequest: () => void;
  onFindShop: () => void;
  onSearchLocation: (area: string) => void;
  onShopSearchRequests?: () => void;
  relativeTime: (iso: string) => string;
  /** 첫 로드가 끝나기 전에는 "아직 작업이 없습니다"를 보여주지 않는다 — 잠깐
   * 스쳐 지나가는 빈 상태는 신규 딜러에게 "이 서비스는 비어 있다"로 읽힌다. */
  loading?: boolean;
  loadError?: string;
  onRetry?: () => void;
}) {
  const [area, setArea] = useState("");
  const activeDeals = deals.filter((deal) => ACTIVE_STAGES.includes(deal.status.stage));
  const recentDeals = [...activeDeals].sort((a, b) => b.status.updatedAt.localeCompare(a.status.updatedAt)).slice(0, 5);
  const submitSearch = () => (area.trim() ? onSearchLocation(area.trim()) : onFindShop());
  const messageNotifications = notifications.filter((item) => item.type === "message");
  // "새 메시지" 카드가 이미 message 알림을 전부 보여주므로, 옆의 "최근 알림"은
  // 나머지(단계 변경·시공점 제안)만 맡는다 — 같은 이벤트를 두 카드에 나란히
  // 중복 표시하던 문제.
  const recentNotifications = notifications.filter((item) => item.type !== "message").slice(0, 5);
  const openNotification = (item: AppNotification) => {
    if (item.type === "shop_proposed") onShopSearchRequests?.();
    else if (item.transactionId) onOpenTransaction(item.transactionId);
  };

  return (
    <section
      className={`dealer-dashboard r3-dealer-dashboard r4-dealer-dashboard reference-prototype-dashboard ${deals.length > 0 ? "has-deals" : "new-dealer"}`}
    >
      {/* 알림·메시지·프로필 아이콘은 상시 사이드바가 이미 갖고 있다 — 같은
       * 진입점을 화면마다 두 번 그리지 않는다. */}
      <header className="reference-dashboard-top">
        <div>
          <h1>{dealerName}님, 오늘 확인할 작업입니다.</h1>
        </div>
      </header>
      {/* 시공점 찾기는 딜러의 메인 행동이라 대시보드에서 의도적으로 크게 둔다. */}
      <section className="reference-search-panel">
        <div className="r3-hero-title">
          <h2>어디에서 차량용품 작업이 필요하세요?</h2>
        </div>
        <div className="ws-search-form r3-search-form">
          <label>
            <span className="sr-only">지역 또는 주소</span>
            <input
              value={area}
              onChange={(event) => setArea(event.target.value)}
              placeholder="예: 서울 강남구, 미사강변동로 95"
              onKeyDown={(event) => event.key === "Enter" && submitSearch()}
            />
          </label>
          <button className="primary ws-search-cta" onClick={submitSearch}>
            <Search size={17} /> 시공점 찾기
          </button>
        </div>
      </section>
      {loadError && deals.length === 0 ? (
        <ErrorState title="오늘의 작업을 불러오지 못했습니다." description={loadError} onRetry={onRetry} />
      ) : loading && deals.length === 0 ? (
        <SkeletonList rows={4} variant="card" label="오늘 확인할 작업을 불러오는 중입니다." />
      ) : deals.length === 0 ? (
        /* 신규 딜러: 빈 카드 세 개(알림·메시지·진행 중인 작업)를 나란히 세우면
         * 화면 대부분이 "없습니다"가 된다. 아직 아무것도 없는 계정에는 카드
         * 대신 시작 경로 하나만 보여주고, 데이터가 생기는 순간 원래 레이아웃이
         * 그대로 돌아온다. */
        <EmptyState
          icon={MapPin}
          title="아직 진행 중인 작업이 없습니다."
          description="카마스터는 고객 차량이 있는 지역의 시공점을 찾는 것에서 시작합니다. 위 검색창에 지역이나 주소를 넣거나, 아래 버튼으로 전국 시공점을 둘러보세요."
          steps={FIRST_RUN_STEPS}
          action={{ label: "시공점 찾기", onClick: onFindShop }}
          secondaryAction={
            onShopSearchRequests ? { label: "카마스터에 시공점 찾기 요청", onClick: onShopSearchRequests } : undefined
          }
        />
      ) : (
        <>
          <section className="reference-module-grid">
            <article className="reference-module">
              <header>
                <h2>
                  <Bell size={19} /> 최근 알림
                </h2>
                <button type="button" onClick={() => onFilterDeals("전체")}>
                  전체 보기 <ChevronRight size={14} />
                </button>
              </header>
              {recentNotifications.length > 0 ? (
                <ul>
                  {recentNotifications.map((item) => (
                    <li key={item.id}>
                      <button type="button" onClick={() => openNotification(item)}>
                        <i />
                        <span>
                          {item.type === "message"
                            ? `${item.title}님이 메시지를 보냈습니다.`
                            : item.type === "stage_change"
                              ? `${item.title} — ${item.body}`
                              : item.type === "shop_proposed"
                                ? `${item.title}을(를) 제안드렸습니다.`
                                : item.body}
                        </span>
                        <small>{relativeTime(item.createdAt)}</small>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  compact
                  icon={Bell}
                  title="새로 확인할 알림이 없습니다."
                  description="거래 단계가 바뀌거나 시공점이 답하면 여기에 바로 표시됩니다."
                />
              )}
            </article>
            <article className="reference-module">
              <header>
                <h2>
                  <MessageCircle size={19} /> 새 메시지
                </h2>
                <button type="button" onClick={onOpenMessages}>
                  전체 보기 <ChevronRight size={14} />
                </button>
              </header>
              {messageNotifications.length > 0 ? (
                <ul>
                  {messageNotifications.slice(0, 5).map((item) => (
                    <li key={item.id}>
                      <button type="button" onClick={() => openNotification(item)}>
                        <div>
                          <b>{item.title}</b>
                          <span>{item.body}</span>
                        </div>
                        <small>{relativeTime(item.createdAt)}</small>
                        <em>1</em>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  compact
                  icon={MessageCircle}
                  title="읽지 않은 메시지가 없습니다."
                  description="거래방에 새 메시지가 오면 여기에서 먼저 확인할 수 있어요."
                  action={{ label: "거래방 전체 보기", onClick: onOpenMessages }}
                />
              )}
            </article>
          </section>
          <section className="ws-card ws-list-card r3-recent-work reference-recent-work">
            <div className="ws-section-head">
              <div>
                <h2>진행 중인 작업</h2>
              </div>
              <button onClick={() => onFilterDeals("전체")}>
                전체 보기 <ChevronRight size={14} />
              </button>
            </div>
            {recentDeals.length > 0 && (
              <div className="ws-row-columns" aria-hidden="true">
                <span>차량 / 작업</span>
                <span>입고</span>
                <span>상태</span>
                <span />
              </div>
            )}
            {recentDeals.length > 0 ? (
              recentDeals.map((deal) => <DealRow key={deal.id} deal={deal} onOpenTransaction={onOpenTransaction} />)
            ) : (
              /* 여기까지 왔다는 건 거래는 있는데 "예약/작업 중"만 없다는 뜻이다
               * (전부 완료·종료됨). 신규 딜러 문구를 그대로 쓰면 거짓말이 되므로
               * 지난 거래로 가는 길과 새 요청을 함께 준다. 예시 차량·시공점을
               * 지어내지 않는 원칙은 그대로. */
              <EmptyState
                compact
                icon={CalendarCheck}
                title="지금 진행 중인 작업이 없습니다."
                description="예약되었거나 작업 중인 차량이 생기면 여기에 표시됩니다."
                action={{ label: "시공점 찾기", onClick: onFindShop }}
                secondaryAction={{ label: "지난 거래 보기", onClick: () => onFilterDeals("전체") }}
              />
            )}
          </section>
        </>
      )}
      {/* Real 모드 전용 시공점 찾기 요청 진입점. 현재 CSS에서
       * .prototype-legacy-actions가 display:none이라 화면에는 보이지 않지만,
       * Real 계정의 기능 진입점이라 이번 UI polish 범위에서 임의로 제거하지
       * 않는다(노출 여부는 별도 판단 필요 — 보고서 참고). */}
      <div className="prototype-legacy-actions" aria-hidden="true">
        {onShopSearchRequests && (
          <button className="button button-ghost" onClick={onShopSearchRequests}>
            시공점 찾기
          </button>
        )}
      </div>
    </section>
  );
}
