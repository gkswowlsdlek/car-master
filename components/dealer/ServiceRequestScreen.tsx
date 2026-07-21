import type { InstallerShop } from "../../lib/dealer-flow-data";
import type { ServiceRequest } from "../../types/dealer";
import { ServiceRequestForm } from "./ServiceRequestForm";

export function ServiceRequestScreen({ request, setRequest, shops, selectedShop, selectedShopId, setSelectedShopId, onFindShops, onSummary, onPriceGuide }: {
  request: ServiceRequest; setRequest: (value: ServiceRequest) => void; shops: { shop: InstallerShop; distanceLabel: string }[]; selectedShop: InstallerShop;
  selectedShopId: string; setSelectedShopId: (id: string) => void; onFindShops: () => void; onSummary: () => void; onPriceGuide: () => void;
}) {
  return <section className="section request-page"><header className="page-title"><div><p className="eyebrow">NEW INSTALLATION REQUEST</p><h1>새 시공 요청</h1><p className="page-subtitle">필수 정보만 입력하고 작업을 맡길 시공점을 선택하세요.</p></div></header>
    {request.selectedPackageName && <div className="card selected-package-summary"><div><span>선택한 권장 시공 패키지</span><b>{request.selectedPackageBrand} {request.selectedPackageName}</b><p>{request.vehicleClass} · {request.expectedPrice}</p></div><button className="button button-secondary" onClick={onPriceGuide}>상품 변경</button></div>}
    <div className="request-layout"><ServiceRequestForm request={request} setRequest={setRequest} onFindShops={onFindShops} onSummary={onSummary} hasSelectedShop={Boolean(selectedShop)} />
      <aside className="card request-shop-panel"><div className="section-heading"><div><span>SELECT INSTALLER</span><h2>시공점 선택</h2></div><button className="button button-ghost" onClick={onFindShops}>다시 검색</button></div><div className="request-shop-list">{shops.slice(0, 6).map(({ shop, distanceLabel }) => { const selected = shop.id === selectedShopId; return <button key={shop.id} className={selected ? "selected" : ""} onClick={() => setSelectedShopId(shop.id)}><span><b>{shop.name}</b><small>{shop.address}</small></span><em>{distanceLabel}</em><i>★ {shop.rating.toFixed(1)} · {shop.responseTime}</i>{selected && <strong>선택됨</strong>}</button>; })}</div><div className="selected-installer"><span>선택된 시공점</span><b>{selectedShop.name}</b><small>{selectedShop.address}</small><p>★ {selectedShop.rating.toFixed(1)} · 최근 거래 {selectedShop.recentTransactionCount}건 · {selectedShop.responseTime}</p></div></aside>
    </div></section>;
}
