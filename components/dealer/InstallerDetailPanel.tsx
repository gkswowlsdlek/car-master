import type { InstallerListing } from "../../types/installer";
import { NaverMapView } from "../map/NaverMapView";

function supportsBrand(installer: InstallerListing, selectedBrand?: string) {
  if (!selectedBrand) return true;
  if (selectedBrand.startsWith("솔라가드")) return installer.brands.includes("솔라가드");
  return installer.brands.some((brand) => selectedBrand.includes(brand) || brand.includes(selectedBrand));
}

export function InstallerDetailPanel({ installer, distanceLabel, selectedBrand, isOtherBrand, onRequest, onClose }: {
  installer: InstallerListing;
  distanceLabel: string;
  selectedBrand?: string;
  isOtherBrand: boolean;
  onRequest: () => void;
  onClose?: () => void;
}) {
  const brandSupported = supportsBrand(installer, selectedBrand);
  return <article className="installer-detail-panel">
    {onClose && <button className="installer-detail-close" onClick={onClose} aria-label="상세 정보 닫기">닫기</button>}
    <div className="installer-detail-head">
      <div>
        {installer.isDemo ? <><span className="demo-badge">데모 시공점</span><span className="demo-location-badge">✓ 위치</span></> : <span className="verified-badge">카마스터 등록 시공점</span>}
        <h2>{installer.name}</h2>
        <p>{installer.address}</p>
      </div>
      <b>{distanceLabel}</b>
    </div>
    <div className="installer-detail-map"><NaverMapView installers={[installer]} selectedId={installer.id} onSelect={() => {}} /></div>
    <div className="installer-brand-badges">
      {isOtherBrand ? <span className="brand-check-badge inquiry">해당 브랜드 취급 여부 확인 필요</span> : <span className={`brand-check-badge ${brandSupported ? "supported" : "inquiry"}`}>{brandSupported ? `${selectedBrand ?? "선택 브랜드"} 취급 가능` : "해당 브랜드 취급 여부 확인 필요"}</span>}
    </div>
    <dl className="installer-detail-grid">
      <div><dt>지역</dt><dd>{installer.province} {installer.city}</dd></div>
      <div><dt>거리</dt><dd>{distanceLabel}</dd></div>
      <div><dt>평점</dt><dd>★ {installer.rating.toFixed(1)} ({installer.reviewCount}건 리뷰)</dd></div>
      <div><dt>최근 30일 작업</dt><dd>{installer.recentTransactionCount}건</dd></div>
      <div><dt>평균 응답</dt><dd>{installer.responseTime}</dd></div>
      <div><dt>다음 작업 가능</dt><dd>{installer.nextAvailableDate}</dd></div>
      <div><dt>전문 분야</dt><dd>{installer.works.join(", ")}</dd></div>
      <div><dt>취급 브랜드</dt><dd>{installer.brands.join(", ")}</dd></div>
      <div><dt>영업시간</dt><dd>{installer.hours}</dd></div>
      <div><dt>요청 가능</dt><dd>{installer.available ? "가능" : "마감"}</dd></div>
    </dl>
    <div className="card-actions"><button className="primary" onClick={onRequest} disabled={!installer.available}>{installer.available ? "이 시공점에 시공 요청" : "현재 요청 마감"}</button></div>
  </article>;
}
