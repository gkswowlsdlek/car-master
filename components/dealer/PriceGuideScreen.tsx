import type { PriceGuideFilter, PricePackage } from "../../data/pricePackages";
import { priceGuideFilters } from "../../data/pricePackages";
import type { VehicleClass } from "../../data/vehicle-class-options";
import type { RequestType } from "../../types/dealer";
import { PricePackageDetail } from "./PricePackageDetail";
import { PricePackageRow } from "./PricePackageRow";

export function PriceGuideScreen({ packages, selectedPackage, selectedPackageId, setSelectedPackageId, brandFilter, setBrandFilter, search, setSearch, vehicleClass, setVehicleClass, onRequest }: {
  packages: PricePackage[]; selectedPackage: PricePackage; selectedPackageId: string; setSelectedPackageId: (id: string) => void;
  brandFilter: PriceGuideFilter; setBrandFilter: (filter: PriceGuideFilter) => void; search: string; setSearch: (value: string) => void;
  vehicleClass: VehicleClass; setVehicleClass: (value: VehicleClass) => void;
  onRequest: (item: PricePackage, vehicleClass: VehicleClass, optional?: string[], type?: RequestType) => void;
}) {
  const grouped = Array.from(new Set(packages.map((item) => item.brand))).map((brand) => ({ brand, items: packages.filter((item) => item.brand === brand) }));
  const showsOther = packages.some((item) => item.brandGroup === "기타");
  return <section className="dealer-screen price-guide-screen">
    <div className="page-title price-guide-title"><div><p className="eyebrow">INSTALLATION PRICE GUIDE · v0.2.8 PATCH 1</p><h1>시공 가격 가이드</h1><small>차량 등급을 선택하면 적용 가능한 가이드 금액을 확인할 수 있습니다.</small></div><div className="price-title-summary"><span>브랜드 {grouped.length}개</span><b>제품 {packages.length}개</b></div></div>
    <div className="price-guide-toolbar"><div className="price-brand-tabs">{priceGuideFilters.map((filter) => <button key={filter} className={brandFilter === filter ? "active" : ""} onClick={() => setBrandFilter(filter)}>{filter}</button>)}</div><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="브랜드 또는 필름명을 검색하세요" /></div>
    {showsOther && <section className="other-brand-notice"><b>기타 브랜드 안내</b><p>일부 브랜드는 지역별 취급 시공점이 제한적일 수 있습니다.<br />시공 요청 전 취급 가능 여부를 확인해 주세요.</p></section>}
    <div className="price-guide-layout"><section className="price-brand-card-grid">{grouped.length === 0 ? <div className="empty-state">검색 결과가 없습니다.</div> : grouped.map((group) => <section className="price-brand-card" key={group.brand}><h2>{group.brand}</h2><div className="price-product-list">{group.items.map((item) => <PricePackageRow key={item.id} item={item} selected={item.id === selectedPackageId} onDetail={() => setSelectedPackageId(item.id)} onQuote={() => onRequest(item, vehicleClass, [], "견적 문의")} onRequest={() => onRequest(item, vehicleClass, [], "실제 시공 요청")} />)}</div></section>)}</section>
      <PricePackageDetail item={selectedPackage} vehicleClass={vehicleClass} setVehicleClass={setVehicleClass} onQuote={() => onRequest(selectedPackage, vehicleClass, [], "견적 문의")} onRequest={() => onRequest(selectedPackage, vehicleClass, [], "실제 시공 요청")} />
    </div>
    <section className="price-guide-disclaimer"><p>※ 같은 차량 등급이라도 창문 크기, 필름 사용량 및 작업 조건에 따라 추가 비용이 발생할 수 있습니다.</p><p>※ 정확한 금액은 시공점과 거래방에서 최종 확인해주세요.</p></section>
  </section>;
}
