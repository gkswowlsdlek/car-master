import type { InstallerListing } from "../../types/installer";
import type { ServiceRequest } from "../../types/dealer";
import { ServiceRequestForm } from "./ServiceRequestForm";

// 평점·리뷰·응답시간·최근 거래건수는 이 화면에서 전부 제거했다. 실데이터가
// 없어 Demo에서만 값이 있었고, 그 값은 카마스터에 실적이 있다는 인상을 준다
// (decisions.md의 "가짜 평점·리뷰·거래건수"). 딜러 인터뷰에서 실제로 요구된
// 정보는 업체정보·위치·연락처다.

export function ServiceRequestScreen({
  request,
  setRequest,
  shops,
  selectedShop,
  selectedShopId,
  setSelectedShopId,
  onFindShops,
  onSummary,
}: {
  request: ServiceRequest;
  setRequest: (value: ServiceRequest) => void;
  shops: { shop: InstallerListing; distanceLabel: string }[];
  selectedShop: InstallerListing;
  selectedShopId: string;
  setSelectedShopId: (id: string) => void;
  onFindShops: (area?: string) => void;
  onSummary: () => void;
}) {
  return (
    <section className="section request-page">
      <header className="page-title">
        <div>
          <h1>새 시공 요청</h1>
          <p className="page-subtitle">필수 정보만 입력하고 작업을 맡길 시공점을 선택하세요.</p>
        </div>
      </header>
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
              return (
                <button key={shop.id} className={selected ? "selected" : ""} onClick={() => setSelectedShopId(shop.id)}>
                  <span>
                    <b>{shop.name}</b>
                    <small>{shop.address}</small>
                  </span>
                  <em>{distanceLabel}</em>
                  {selected && <strong>선택됨</strong>}
                </button>
              );
            })}
          </div>
          {/* "선택된 시공점" 요약 카드는 뺐다 — 바로 위 목록에서 해당 업체가
           * 이미 파란 테두리 + "선택됨" 배지로 표시되는데 같은 업체명·주소를
           * 한 패널 안에서 두 번 반복했고, 그 카드가 패널 밖으로 잘려 나가기도
           * 했다. */}
        </aside>
      </div>
    </section>
  );
}
