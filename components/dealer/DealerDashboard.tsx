import { Bell, ChevronRight, MessageCircle, Phone, Search } from "lucide-react";
import { useState } from "react";
import type { AppNotification } from "../../hooks/use-notifications";
import type { Transaction, TransactionStage } from "../../types/transactions";
import { dealerStageLabel } from "../../services/transaction-state-service";

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
            <p className="reference-module-empty">아직 알림이 없습니다.</p>
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
            <p className="reference-module-empty">아직 대화가 없습니다.</p>
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
          /* 실제 거래가 없을 때 예시 차량·시공점을 지어내지 않는다 — 빈 상태에서
           * 해야 할 다음 행동(시공점 찾기)으로 그대로 연결한다. */
          <div className="ws-dashboard-empty">
            <p>아직 진행 중인 작업이 없습니다.</p>
            <button type="button" className="button button-primary" onClick={onFindShop}>
              시공점 찾고 첫 작업 요청하기
            </button>
          </div>
        )}
      </section>
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
