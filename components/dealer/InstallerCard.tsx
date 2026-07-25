import type { InstallerListing } from "../../types/installer";

export function InstallerCard({ installer, distanceLabel, selected, favorite, onToggleFavorite, onSelect, onOpenDetail, onRequest }: {
  installer: InstallerListing;
  distanceLabel: string;
  selected: boolean;
  favorite: boolean;
  onToggleFavorite: () => void;
  onSelect: () => void;
  onOpenDetail: () => void;
  onRequest: () => void;
}) {
  return <div id={`installer-card-${installer.id}`} className={`installer-card ${selected ? "selected" : ""}`}>
    <button type="button" className={`favorite-star ${favorite ? "active" : ""}`} onClick={onToggleFavorite} aria-label={`${installer.name} 즐겨찾기`}>★</button>
    <button type="button" className="installer-card-body" onClick={onSelect}>
      <div className="installer-card-top">
        <div className="installer-card-heading">
          <b>{installer.name}</b>
          {installer.isDemo ? <><span className="demo-badge">데모 시공점</span><span className="demo-location-badge">✓ 위치</span></> : <span className="verified-badge">카마스터 등록 시공점</span>}
        </div>
        <span className={`installer-availability ${installer.available ? "open" : "closed"}`}>{installer.available ? "요청 가능" : "마감"}</span>
      </div>
      <p className="installer-card-location">{installer.province} {installer.city} · {distanceLabel}</p>
      <div className="installer-card-meta">
        <span>★ {installer.rating.toFixed(1)} <small>({installer.reviewCount})</small></span>
        <span>{installer.responseTime}</span>
        <span>최근 30일 {installer.recentTransactionCount}건</span>
      </div>
      <p className="installer-card-works">{installer.works.slice(0, 3).join(", ")}</p>
      <p className="installer-card-brands">{installer.brands.slice(0, 4).join(", ")}</p>
    </button>
    <div className="installer-card-actions">
      <button type="button" className="button button-ghost" onClick={onOpenDetail}>상세 보기</button>
      <button type="button" className="button button-primary" onClick={onRequest}>시공 요청</button>
    </div>
  </div>;
}
