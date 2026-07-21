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
  const grouped = packages.map((item) => ({ brand: item.brand, items: [item] }));
  return <section className="dealer-screen price-guide-screen">
    <div className="page-title price-guide-title"><div><p className="eyebrow">RECOMMENDED INSTALLATION PACKAGES</p><h1>권장 시공 패키지 가이드</h1><p className="page-subtitle">차량과 작업 범위에 맞는 권장 패키지와 예상 가격 범위를 확인하세요.</p></div><div className="price-title-summary"><span>권장 단계 {grouped.length}개</span><b>패키지 {packages.length}개</b></div></div>
    <div className="price-guide-toolbar"><div className="price-brand-tabs">{priceGuideFilters.map((filter) => <button key={filter} className={brandFilter === filter ? "active" : ""} onClick={() => setBrandFilter(filter)}>{filter}</button>)}</div><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="패키지 또는 예시 제품을 검색하세요" /></div>
    <div className="price-guide-layout"><section className="price-brand-card-grid">{grouped.length === 0 ? <div className="empty-state">검색 결과가 없습니다.</div> : grouped.map((group) => <section className="price-brand-card" key={group.brand}><h2>{group.brand}</h2><div className="price-product-list">{group.items.map((item) => <PricePackageRow key={item.id} item={item} selected={item.id === selectedPackageId} onDetail={() => setSelectedPackageId(item.id)} onQuote={() => onRequest(item, vehicleClass, [], "견적 문의")} onRequest={() => onRequest(item, vehicleClass, [], "실제 시공 요청")} />)}</div></section>)}</section>
      <PricePackageDetail item={selectedPackage} vehicleClass={vehicleClass} setVehicleClass={setVehicleClass} onQuote={() => onRequest(selectedPackage, vehicleClass, [], "견적 문의")} onRequest={() => onRequest(selectedPackage, vehicleClass, [], "실제 시공 요청")} />
    </div>
    <section className="price-guide-disclaimer"><p>본 가격은 전국 평균 시공 사례를 바탕으로 한 권장 시공 패키지 가이드입니다.</p><p>실제 시공 금액은 차량, 지역, 작업 범위, 시공점 정책에 따라 달라질 수 있습니다.</p></section>
  </section>;
}
