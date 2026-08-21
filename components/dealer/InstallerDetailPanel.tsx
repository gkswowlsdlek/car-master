import { Check } from "lucide-react";
import type { InstallerListing } from "../../types/installer";
import { NaverMapView } from "../map/NaverMapView";

function supportsBrand(installer: InstallerListing, selectedBrand?: string) {
  if (!selectedBrand) return true;
  if (selectedBrand.startsWith("솔라가드")) return installer.brands.includes("솔라가드");
  return installer.brands.some((brand) => selectedBrand.includes(brand) || brand.includes(selectedBrand));
}

const NO_DISTANCE = "거리 정보 없음";

export function InstallerDetailPanel({
  installer,
  distanceLabel,
  selectedBrand,
  isOtherBrand,
  onRequest,
  onClose,
}: {
  installer: InstallerListing;
  distanceLabel: string;
  selectedBrand?: string;
  isOtherBrand: boolean;
  onRequest: () => void;
  onClose?: () => void;
}) {
  const brandSupported = supportsBrand(installer, selectedBrand);
  const hasDistance = distanceLabel !== NO_DISTANCE;

  return (
    <article className="installer-detail-panel">
      {onClose && (
        <button className="installer-detail-close" onClick={onClose} aria-label="상세 정보 닫기">
          닫기
        </button>
      )}

      <div className="installer-detail-head">
        <h2>{installer.name}</h2>
        <p className="installer-detail-location">
          {installer.province} {installer.city}
          {hasDistance ? ` · ${distanceLabel}` : ""}
        </p>
        <div className="installer-detail-badges">
          {installer.isDemo ? (
            <>
              <span className="demo-badge">데모 시공점</span>
              <span className="demo-location-badge">
                <Check size={15} strokeWidth={3.2} /> 위치
              </span>
            </>
          ) : (
            <span className="verified-badge">카마스터 등록 시공점</span>
          )}
        </div>
      </div>

      <div className="card-actions">
        {installer.available ? (
          <button className="primary" onClick={onRequest}>
            이 시공점에 시공 요청
          </button>
        ) : (
          <p className="installer-detail-closed-note">현재 시공 요청을 받고 있지 않아요.</p>
        )}
      </div>

      {installer.address && (
        <section className="installer-detail-section">
          <p className="installer-detail-label">주소</p>
          <p className="installer-detail-value">{installer.address}</p>
        </section>
      )}

      <div className="installer-detail-map">
        <NaverMapView installers={[installer]} selectedId={installer.id} onSelect={() => {}} />
      </div>

      {installer.works.length > 0 && (
        <section className="installer-detail-section">
          <p className="installer-detail-label">시공 가능</p>
          <p className="installer-detail-value">{installer.works.join(" · ")}</p>
        </section>
      )}

      {installer.brands.length > 0 && (
        <section className="installer-detail-section">
          <p className="installer-detail-label">취급 브랜드</p>
          <p className="installer-detail-value">{installer.brands.join(" · ")}</p>
          <span className={`brand-check-badge ${isOtherBrand || !brandSupported ? "inquiry" : "supported"}`}>
            {!isOtherBrand && brandSupported
              ? `${selectedBrand ?? "선택 브랜드"} 취급 가능`
              : "해당 브랜드 취급 여부 확인 필요"}
          </span>
        </section>
      )}

      {installer.hours && (
        <section className="installer-detail-section">
          <p className="installer-detail-label">영업시간</p>
          <p className="installer-detail-value">{installer.hours}</p>
        </section>
      )}
    </article>
  );
}
