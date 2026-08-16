import type { InstallerListing } from "../../types/installer";
import type { ServiceRequest } from "../../types/dealer";
import { ServiceRequestForm } from "./ServiceRequestForm";

const NO_RESPONSE = "응답 정보 없음";

// 평점/최근 거래/응답 시간은 실데이터가 있을 때만 노출한다 — 방금 등록된 실제
// Shop은 세 값 모두 0/placeholder이고, 그대로 보여주면 "★0.0"처럼 근거 없는
// 통계로 오인된다. Demo 픽스처는 항상 0이 아닌 값을 갖는다
// (data/installer-directory-demo.ts) — InstallerDetailPanel.tsx와 동일한 규칙.
function shopTrustParts(shop: InstallerListing, includeRecent: boolean): string[] {
  const parts: string[] = [];
  if (shop.reviewCount > 0) parts.push(`★ ${shop.rating.toFixed(1)}`);
  if (includeRecent && shop.recentTransactionCount > 0) parts.push(`최근 거래 ${shop.recentTransactionCount}건`);
  if (shop.responseTime !== NO_RESPONSE) parts.push(shop.responseTime);
  return parts;
}

export function ServiceRequestScreen({
  request,
  setRequest,
  shops,
  selectedShop,
  selectedShopId,
  setSelectedShopId,
  onFindShops,
  onSummary,
  onPriceGuide,
}: {
  request: ServiceRequest;
  setRequest: (value: ServiceRequest) => void;
  shops: { shop: InstallerListing; distanceLabel: string }[];
  selectedShop: InstallerListing;
  selectedShopId: string;
  setSelectedShopId: (id: string) => void;
  onFindShops: (area?: string) => void;
  onSummary: () => void;
  onPriceGuide: () => void;
}) {
  const selectedTrust = shopTrustParts(selectedShop, true).join(" · ");
  return (
    <section className="section request-page">
      <header className="page-title">
        <div>
          <p className="eyebrow">NEW REQUEST</p>
          <h1>새 시공 요청</h1>
          <p className="page-subtitle">필수 정보만 입력하고 작업을 맡길 시공점을 선택하세요.</p>
        </div>
      </header>
      {request.selectedPackageName && (
        <div className="card selected-package-summary">
          <div>
            <span>선택한 권장 시공 패키지</span>
            <b>
              {request.selectedPackageBrand} {request.selectedPackageName}
            </b>
            <p>
              {request.vehicleClass} · {request.expectedPrice}
            </p>
          </div>
          <button className="button button-secondary" onClick={onPriceGuide}>
            상품 변경
          </button>
        </div>
      )}
      <div className="request-layout">
        <ServiceRequestForm
          request={request}
          setRequest={setRequest}
          onFindShops={onFindShops}
          onSummary={onSummary}
          hasSelectedShop={Boolean(selectedShop)}
        />
        <aside className="card request-shop-panel">
          <div className="section-heading">
            <h2>시공점 선택</h2>
            <button className="button button-ghost" onClick={() => onFindShops()}>
              다시 검색
            </button>
          </div>
          <div className="request-shop-list">
            {shops.slice(0, 6).map(({ shop, distanceLabel }) => {
              const selected = shop.id === selectedShopId;
              const trust = shopTrustParts(shop, false).join(" · ");
              return (
                <button key={shop.id} className={selected ? "selected" : ""} onClick={() => setSelectedShopId(shop.id)}>
                  <span>
                    <b>{shop.name}</b>
                    <small>{shop.address}</small>
                  </span>
                  <em>{distanceLabel}</em>
                  {trust && <i>{trust}</i>}
                  {selected && <strong>선택됨</strong>}
                </button>
              );
            })}
          </div>
          <div className="selected-installer">
            <span>선택된 시공점</span>
            <b>{selectedShop.name}</b>
            <small>{selectedShop.address}</small>
            {selectedTrust && <p>{selectedTrust}</p>}
          </div>
        </aside>
      </div>
    </section>
  );
}
