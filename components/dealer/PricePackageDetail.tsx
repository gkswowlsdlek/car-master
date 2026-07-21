import { formatGuidePrice } from "../../data/installation-price-guide";
import { calculateVehicleClassPrice, vehicleClassOptions, type VehicleClass } from "../../data/vehicle-class-options";
import type { PricePackage } from "../../data/pricePackages";

export function PricePackageDetail({ item, vehicleClass, setVehicleClass, onQuote, onRequest }: { item: PricePackage; vehicleClass: VehicleClass; setVehicleClass: (value: VehicleClass) => void; onQuote: () => void; onRequest: () => void }) {
  const price = calculateVehicleClassPrice(item.guidePrice, vehicleClass);
  return <aside className="price-package-detail">
    <span>권장 시공 패키지 가이드</span><h2>{item.name} · {item.product}</h2>
    <div className="vehicle-class-detail-options">{vehicleClassOptions.map((option) => <button key={option.id} className={vehicleClass === option.id ? "active" : ""} onClick={() => setVehicleClass(option.id)}><b>{option.label}</b><small>{option.description}</small></button>)}</div>
    <div className="detail-price-box"><small>{vehicleClass} 권장 범위</small><b>{item.prices[vehicleClass] ?? (price.priceRequiresInquiry ? "상담 후 견적" : formatGuidePrice(price.finalGuidePrice ?? item.guidePrice))}</b></div>
    {vehicleClass === "수입 승용" && <p className="prototype-price-note">수입 승용 5만원 추가는 현재 가이드 계산 기준입니다.</p>}
    <dl><div><dt>브랜드</dt><dd>{item.brand}</dd></div><div><dt>제품명</dt><dd>{item.product}</dd></div><div><dt>추가 작업</dt><dd>{item.optionalServices.join(", ")}</dd></div><div><dt>안내</dt><dd>{item.notice}</dd></div></dl>
    <div className="price-notice-box"><p>※ 같은 차량 등급이라도 창문 크기, 필름 사용량 및 작업 조건에 따라 추가 비용이 발생할 수 있습니다.</p></div>
    <div className="price-detail-actions"><button className="secondary" onClick={onQuote}>견적 문의</button><button className="primary" onClick={onRequest}>시공 요청</button></div>
  </aside>;
}
