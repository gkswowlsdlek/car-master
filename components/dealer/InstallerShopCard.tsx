import type { InstallerShop } from "../../lib/dealer-flow-data";

function supportsBrand(shop: InstallerShop, selectedBrand?: string) {
  if (!selectedBrand) return true;
  if (selectedBrand.startsWith("솔라가드")) return shop.brands.includes("솔라가드");
  return shop.brands.some((brand) => selectedBrand.includes(brand) || brand.includes(selectedBrand));
}

export function InstallerShopCard({ shop, distanceLabel, selectedBrand, isOtherBrand, onRequest }: { shop: InstallerShop; distanceLabel: string; selectedBrand?: string; isOtherBrand: boolean; onRequest: () => void }) {
  const brandSupported = supportsBrand(shop, selectedBrand);
  return <article className="map-card installer-detail-card">
    <div className="map-card-head"><div><span className="verified-badge">카마스터 등록 시공점</span><h2>{shop.name}</h2><p>{shop.address}</p></div><b>{distanceLabel}</b></div>
    <div className="installer-brand-badges">
      {isOtherBrand ? <span className="brand-check-badge inquiry">해당 브랜드 취급 여부 확인 필요</span> : <span className={`brand-check-badge ${brandSupported ? "supported" : "inquiry"}`}>{brandSupported ? `${selectedBrand ?? "선택 브랜드"} 취급 가능` : "해당 브랜드 취급 여부 확인 필요"}</span>}
    </div>
    <dl>
      <div><dt>거리</dt><dd>{distanceLabel}</dd></div><div><dt>평점</dt><dd>★ {shop.rating.toFixed(1)}</dd></div>
      <div><dt>최근 거래</dt><dd>{shop.recentTransactionCount}건</dd></div><div><dt>평균 응답</dt><dd>{shop.responseTime}</dd></div>
      <div><dt>가능 브랜드</dt><dd>{shop.brands.slice(0, 4).join(", ")}</dd></div><div><dt>가능 작업</dt><dd>{shop.works.slice(0, 4).join(", ")}</dd></div>
      <div><dt>영업시간</dt><dd>{shop.hours}</dd></div><div><dt>요청 가능</dt><dd>{shop.available ? "가능" : "마감"}</dd></div>
    </dl>
    <div className="card-actions"><button className="primary" onClick={onRequest}>시공 요청하기</button></div>
  </article>;
}
