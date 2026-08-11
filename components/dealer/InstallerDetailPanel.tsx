import { Check } from "lucide-react";
import type { InstallerListing } from "../../types/installer";
import { NaverMapView } from "../map/NaverMapView";

function supportsBrand(installer: InstallerListing, selectedBrand?: string) {
  if (!selectedBrand) return true;
  if (selectedBrand.startsWith("솔라가드")) return installer.brands.includes("솔라가드");
  return installer.brands.some((brand) => selectedBrand.includes(brand) || brand.includes(selectedBrand));
}

const NO_DISTANCE = "거리 정보 없음";
const NO_RESPONSE = "응답 정보 없음";

export function InstallerDetailPanel({ installer, distanceLabel, selectedBrand, isOtherBrand, onRequest, onClose }: {
  installer: InstallerListing;
  distanceLabel: string;
  selectedBrand?: string;
  isOtherBrand: boolean;
  onRequest: () => void;
  onClose?: () => void;
}) {
  const brandSupported = supportsBrand(installer, selectedBrand);
  const hasDistance = distanceLabel !== NO_DISTANCE;
  // 평점/응답/최근작업은 실데이터가 생기기 전까지는 항목 자체를 숨긴다
  // ("정보 없음"을 반복 노출하지 않는다) — 하나라도 실데이터가 있을 때만
  // 이 섹션이 나타난다. Demo 픽스처는 항상 0이 아닌 값을 만들어 두므로
  // Demo 데이터를 가리는 일은 없다.
  const trustRows: { label: string; value: string }[] = [
    ...(installer.reviewCount > 0 ? [{ label: "평점", value: `★ ${installer.rating.toFixed(1)} (${installer.reviewCount}건 리뷰)` }] : []),
    ...(installer.recentTransactionCount > 0 ? [{ label: "최근 30일 작업", value: `${installer.recentTransactionCount}건` }] : []),
    ...(installer.responseTime !== NO_RESPONSE ? [{ label: "평균 응답", value: installer.responseTime }] : []),
  ];

  return <article className="installer-detail-panel">
    {onClose && <button className="installer-detail-close" onClick={onClose} aria-label="상세 정보 닫기">닫기</button>}

    <div className="installer-detail-head">
      <h2>{installer.name}</h2>
      <p className="installer-detail-location">{installer.province} {installer.city}{hasDistance ? ` · ${distanceLabel}` : ""}</p>
      <div className="installer-detail-badges">
        {installer.isDemo ? <><span className="demo-badge">데모 시공점</span><span className="demo-location-badge"><Check size={15} strokeWidth={3.2} /> 위치</span></> : <span className="verified-badge">카마스터 등록 시공점</span>}
      </div>
    </div>

    <div className="card-actions">
      {installer.available
        ? <button className="primary" onClick={onRequest}>이 시공점에 시공 요청</button>
        : <p className="installer-detail-closed-note">현재 시공 요청을 받고 있지 않아요.</p>}
    </div>

    {installer.address && <section className="installer-detail-section">
      <p className="installer-detail-label">주소</p>
      <p className="installer-detail-value">{installer.address}</p>
    </section>}

    <div className="installer-detail-map"><NaverMapView installers={[installer]} selectedId={installer.id} onSelect={() => {}} /></div>

    {installer.works.length > 0 && <section className="installer-detail-section">
      <p className="installer-detail-label">시공 가능</p>
      <p className="installer-detail-value">{installer.works.join(" · ")}</p>
    </section>}

    {installer.brands.length > 0 && <section className="installer-detail-section">
      <p className="installer-detail-label">취급 브랜드</p>
      <p className="installer-detail-value">{installer.brands.join(" · ")}</p>
      <span className={`brand-check-badge ${isOtherBrand || !brandSupported ? "inquiry" : "supported"}`}>{!isOtherBrand && brandSupported ? `${selectedBrand ?? "선택 브랜드"} 취급 가능` : "해당 브랜드 취급 여부 확인 필요"}</span>
    </section>}

    {installer.hours && <section className="installer-detail-section">
      <p className="installer-detail-label">영업시간</p>
      <p className="installer-detail-value">{installer.hours}</p>
    </section>}

    {trustRows.length > 0 && <section className="installer-detail-section installer-detail-section-secondary">
      {trustRows.map((row) => <p key={row.label}><span>{row.label}</span><span>{row.value}</span></p>)}
    </section>}
  </article>;
}
