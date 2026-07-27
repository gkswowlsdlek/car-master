"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ListFilter, MapPin, Search, X } from "lucide-react";
import type { Brand, WorkType } from "../../lib/dealer-flow-data";
import { brands, workTypes } from "../../lib/dealer-flow-data";
import { getCurrentPosition, type GeoPosition } from "../../services/geolocation";
import type { InstallerListing } from "../../types/installer";
import { NaverMapView } from "../map/NaverMapView";
import { InstallerCard } from "./InstallerCard";
import { InstallerDetailPanel } from "./InstallerDetailPanel";
import { administrativeRegionNames, administrativeRegions, normalizeAdministrativeRegion, type AdministrativeRegion } from "../../data/administrative-regions";

type SortKey = "distance" | "rating" | "response" | "recent";
const SORT_LABELS: Record<SortKey, string> = { distance: "가까운 순", rating: "평점 높은 순", response: "응답 빠른 순", recent: "최근 작업 많은 순" };

function distanceKm(a: GeoPosition, b: { lat: number; lng: number }) {
  const earthRadius = 6371;
  const dLat = ((b.lat - a.latitude) * Math.PI) / 180;
  const dLng = ((b.lng - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const sin = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(sin), Math.sqrt(1 - sin));
}
function responseMinutes(value: string) { return Number(value.match(/\d+/)?.[0] ?? Number.MAX_SAFE_INTEGER); }

export function InstallerDirectoryScreen({ installers, loading, selectedId, setSelectedId, favoriteIds, toggleFavorite, selectedBrand, isOtherBrand, onRequest }: {
  installers: InstallerListing[];
  loading?: boolean;
  selectedId: string;
  setSelectedId: (id: string) => void;
  favoriteIds: string[];
  toggleFavorite: (id: string) => void;
  selectedBrand?: string;
  isOtherBrand: boolean;
  onRequest: () => void;
}) {
  const [search, setSearch] = useState("");
  const [province, setProvince] = useState("전체");
  const [city, setCity] = useState("전체");
  const [workFilter, setWorkFilter] = useState<WorkType | "전체">("전체");
  const [brandFilter, setBrandFilter] = useState<Brand | "전체">("전체");
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("distance");
  const [mobileView, setMobileView] = useState<"list" | "map">("list");
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [focusedInstallerId, setFocusedInstallerId] = useState("");
  const [userLocation, setUserLocation] = useState<GeoPosition | null>(null);
  const [locationStatus, setLocationStatus] = useState<"pending" | "granted" | "unavailable">("pending");
  const [boundsOnly, setBoundsOnly] = useState(false);
  const [visibleBoundsIds, setVisibleBoundsIds] = useState<string[] | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    void getCurrentPosition().then((position) => {
      if (!active) return;
      if (position) { setUserLocation(position); setLocationStatus("granted"); }
      else setLocationStatus("unavailable");
    });
    return () => { active = false; };
  }, []);

  const provinceOptions = ["전체", ...administrativeRegionNames];
  const cityOptions = province === "전체" ? ["전체"] : ["전체", ...administrativeRegions[province as AdministrativeRegion]];

  const withDistance = useMemo(() => installers.map((installer) => {
    const km = userLocation && installer.lat != null && installer.lng != null ? distanceKm(userLocation, { lat: installer.lat, lng: installer.lng }) : null;
    return { installer, distanceKm: km, distanceLabel: km == null ? "거리 정보 없음" : `${km.toFixed(km < 10 ? 1 : 0)}km` };
  }), [installers, userLocation]);

  const filtered = useMemo(() => withDistance.filter(({ installer }) => {
    if (province !== "전체" && normalizeAdministrativeRegion(installer.province) !== province) return false;
    if (city !== "전체" && installer.city !== city) return false;
    if (workFilter !== "전체" && !installer.works.includes(workFilter)) return false;
    if (brandFilter !== "전체" && !installer.brands.includes(brandFilter)) return false;
    if (onlyAvailable && !installer.available) return false;
    if (boundsOnly && visibleBoundsIds && !visibleBoundsIds.includes(installer.id)) return false;
    if (search.trim()) {
      const keyword = search.trim().toLowerCase();
      const haystack = `${installer.name} ${installer.address} ${installer.works.join(" ")} ${installer.brands.join(" ")}`.toLowerCase();
      if (!haystack.includes(keyword)) return false;
    }
    return true;
  }), [withDistance, province, city, workFilter, brandFilter, onlyAvailable, boundsOnly, visibleBoundsIds, search]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    if (sortKey === "rating") return b.installer.rating - a.installer.rating;
    if (sortKey === "response") return responseMinutes(a.installer.responseTime) - responseMinutes(b.installer.responseTime);
    if (sortKey === "recent") return b.installer.recentTransactionCount - a.installer.recentTransactionCount;
    if (a.distanceKm == null) return b.distanceKm == null ? 0 : 1;
    if (b.distanceKm == null) return -1;
    return a.distanceKm - b.distanceKm;
  }), [filtered, sortKey]);

  const selected = installers.find((item) => item.id === focusedInstallerId);
  const selectedDistanceLabel = withDistance.find((item) => item.installer.id === selected?.id)?.distanceLabel ?? "거리 정보 없음";

  useEffect(() => {
    if (!selectedId) return;
    document.getElementById(`installer-card-${selectedId}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedId]);

  function selectInstaller(id: string) { setFocusedInstallerId(id); setSelectedId(id); }
  function selectAndOpenDetail(id: string) { selectInstaller(id); setDetailOpen(true); }
  function resetFilters() { setProvince("전체"); setCity("전체"); setWorkFilter("전체"); setBrandFilter("전체"); setOnlyAvailable(false); setSearch(""); }

  const filterControls = <div className="installer-filter-controls">
    <label>시/도<select value={province} onChange={(event) => { setProvince(event.target.value); setCity("전체"); }}>{provinceOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
    <label>시/군/구<select value={city} onChange={(event) => setCity(event.target.value)}>{cityOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
    <label>시공 종류<select value={workFilter} onChange={(event) => setWorkFilter(event.target.value as WorkType | "전체")}><option value="전체">전체</option>{workTypes.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
    <label>취급 브랜드<select value={brandFilter} onChange={(event) => setBrandFilter(event.target.value as Brand | "전체")}><option value="전체">전체</option>{brands.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
    <button className="button button-ghost" onClick={resetFilters}>필터 초기화</button>
  </div>;

  return <section className="dealer-screen installer-directory">
    <div className="page-title"><div><p className="eyebrow">INSTALLER NETWORK</p><h1>전국 시공점 찾기</h1><p className="page-subtitle">지도와 목록에서 시공점을 비교하고 바로 시공 요청을 보내세요.</p></div></div>

    <div className="installer-toolbar">
      <label className="search-field"><Search size={18} aria-hidden="true" /><input aria-label="시공점 검색" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="시공점, 지역, 브랜드, 작업 종류로 검색" /></label>
      <label className="installer-filter-toggle"><input type="checkbox" checked={onlyAvailable} onChange={(event) => setOnlyAvailable(event.target.checked)} /> 요청 가능한 시공점만</label>
      <button className="button button-secondary installer-filter-open" onClick={() => setFilterSheetOpen(true)}><ListFilter size={16} /> 필터</button>
      <label className="installer-sort-select">정렬<select value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)}>{(Object.keys(SORT_LABELS) as SortKey[]).map((key) => <option key={key} value={key}>{SORT_LABELS[key]}</option>)}</select></label>
    </div>
    {locationStatus === "unavailable" && sortKey === "distance" && <p className="installer-location-note">현재 위치를 사용할 수 없어 정확한 거리 대신 기본 지역 기준으로 표시됩니다.</p>}

    <div className="installer-mobile-tabs">
      <button className={mobileView === "list" ? "active" : ""} onClick={() => setMobileView("list")}>리스트 ({sorted.length})</button>
      <button className={mobileView === "map" ? "active" : ""} onClick={() => setMobileView("map")}><MapPin size={15} /> 지도</button>
    </div>

    {loading && <p className="installer-loading-note" role="status">시공점 정보를 불러오는 중입니다…</p>}

    <div className="installer-directory-layout">
      <div className={`installer-list-pane ${mobileView === "map" ? "mobile-hidden" : ""}`}>
        <div className="installer-list-head"><b>{sorted.length}곳</b><span>{SORT_LABELS[sortKey]}</span></div>
        {sorted.length === 0 ? <div className="installer-empty-state"><span>🔍</span><h2>조건에 맞는 시공점이 없습니다.</h2><p>검색어나 필터를 조정해 보세요.</p><button className="button button-secondary" onClick={resetFilters}>필터 초기화</button></div> : <div className="installer-list" ref={listRef}>
          {sorted.map(({ installer, distanceLabel }) => <InstallerCard key={installer.id} installer={installer} distanceLabel={distanceLabel} selected={installer.id === focusedInstallerId} favorite={favoriteIds.includes(installer.id)} onToggleFavorite={() => toggleFavorite(installer.id)} onSelect={() => selectInstaller(installer.id)} onOpenDetail={() => selectAndOpenDetail(installer.id)} onRequest={() => { selectInstaller(installer.id); onRequest(); }} />)}
        </div>}
      </div>
      <div className={`installer-map-pane ${mobileView === "list" ? "mobile-hidden" : ""}`}>
        <NaverMapView installers={sorted.map((item) => item.installer)} selectedId={focusedInstallerId} onSelect={(id) => selectAndOpenDetail(id)} userLocation={userLocation ? { lat: userLocation.latitude, lng: userLocation.longitude } : null} onBoundsChanged={setVisibleBoundsIds} />
        <div className="installer-map-footer">
          <label className="installer-bounds-toggle"><input type="checkbox" checked={boundsOnly} onChange={(event) => setBoundsOnly(event.target.checked)} /> 현재 지도 영역만 보기</label>
          <span className="installer-map-legend"><i className="installer-map-legend-star" aria-hidden="true">★</i> 위치 등록 데모 시공점</span>
        </div>
      </div>
      {selected && <div className="installer-detail-pane">
        <InstallerDetailPanel installer={selected} distanceLabel={selectedDistanceLabel} selectedBrand={selectedBrand} isOtherBrand={isOtherBrand} onRequest={() => { setSelectedId(selected.id); onRequest(); }} />
      </div>}
    </div>

    {detailOpen && selected && typeof document !== "undefined" && createPortal(
      <div className="installer-detail-overlay">
        <div className="installer-detail-backdrop" onClick={() => setDetailOpen(false)} />
        <div className="installer-detail-sheet">
          <InstallerDetailPanel installer={selected} distanceLabel={selectedDistanceLabel} selectedBrand={selectedBrand} isOtherBrand={isOtherBrand} onRequest={() => { setSelectedId(selected.id); onRequest(); }} onClose={() => setDetailOpen(false)} />
        </div>
      </div>,
      document.body,
    )}

    {filterSheetOpen && typeof document !== "undefined" && createPortal(
      <div className="installer-filter-overlay">
        <div className="installer-detail-backdrop" onClick={() => setFilterSheetOpen(false)} />
        <div className="installer-filter-sheet">
          <div className="installer-filter-sheet-head"><b>필터</b><button aria-label="필터 닫기" onClick={() => setFilterSheetOpen(false)}><X size={18} /></button></div>
          {filterControls}
          <button className="button button-primary installer-filter-apply" onClick={() => setFilterSheetOpen(false)}>{sorted.length}곳 보기</button>
        </div>
      </div>,
      document.body,
    )}
  </section>;
}
