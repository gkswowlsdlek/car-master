import { Building2, Check } from "lucide-react";
import type { InstallerListing } from "../../types/installer";

/**
 * Card 단계에서는 사진을 fetch하지 않는다 (Shop Photos backend 자체가
 * Production DB에 아직 없음 — 이번 배포 범위 밖) — 그래서 Card는 항상
 * 중립 placeholder 아이콘만 보여준다. Phase C에서 전면 배너였던 photo
 * block을 작은 inline 아이콘으로 줄여 카드 높이를 압축했다(정보 자체는
 * 그대로 — 표시 크기만 축소).
 */
function CardPhoto() {
  return (
    <div className="installer-card-photo" aria-hidden="true">
      <Building2 size={18} />
    </div>
  );
}

export function InstallerCard({
  installer,
  distanceLabel,
  selected,
  favorite,
  onToggleFavorite,
  onOpenDetail,
  onRequest,
}: {
  installer: InstallerListing;
  distanceLabel: string;
  selected: boolean;
  favorite: boolean;
  onToggleFavorite: () => void;
  onOpenDetail: () => void;
  onRequest: () => void;
}) {
  return (
    <div id={`installer-card-${installer.id}`} className={`installer-card ${selected ? "selected" : ""}`}>
      <button
        type="button"
        className={`favorite-star ${favorite ? "active" : ""}`}
        onClick={onToggleFavorite}
        aria-label={`${installer.name} 즐겨찾기`}
      >
        ★
      </button>
      <button type="button" className="installer-card-body" onClick={onOpenDetail}>
        <CardPhoto />
        <div className="installer-card-main">
          <div className="installer-card-top">
            <b className="installer-card-name">{installer.name}</b>
            <span>{distanceLabel}</span>
          </div>
          <p className="installer-card-location">
            {installer.province} {installer.city}
          </p>
          <div className="installer-card-heading">
            {installer.isDemo ? (
              <>
                <span className="demo-badge">데모 시공점</span>
                <span className="demo-location-badge">
                  <Check size={14} strokeWidth={3.2} /> 위치
                </span>
              </>
            ) : (
              <span className="verified-badge">카마스터 등록 시공점</span>
            )}
            <span className={`installer-availability ${installer.available ? "open" : "closed"}`}>
              {installer.available ? "요청 가능" : "마감"}
            </span>
          </div>
          <p className="installer-card-works">{installer.works.slice(0, 3).join(", ")}</p>
        </div>
      </button>
      <div className="installer-card-actions">
        <button type="button" className="button button-primary" onClick={onRequest}>
          시공 요청
        </button>
      </div>
    </div>
  );
}
