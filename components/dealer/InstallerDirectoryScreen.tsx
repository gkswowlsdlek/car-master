"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Building2, ListFilter, MapPin, Search, SearchX, X } from "lucide-react";
import type { Brand, WorkType } from "../../lib/dealer-flow-data";
import { brands, workTypes } from "../../lib/dealer-flow-data";
import { getCurrentPosition, type GeoPosition } from "../../services/geolocation";
import type { InstallerListing } from "../../types/installer";
import type { SearchLocation } from "../../types/location";
import { NaverMapView } from "../map/NaverMapView";
import { InstallerCard } from "./InstallerCard";
import { InstallerDetailPanel } from "./InstallerDetailPanel";
import { EmptyState, SkeletonList } from "../common/ScreenState";
import {
  administrativeRegionNames,
  administrativeRegions,
  normalizeAdministrativeRegion,
  type AdministrativeRegion,
} from "../../data/administrative-regions";

// 정렬은 거리 하나뿐이다. 평점/응답시간/최근 작업 정렬 분기가 남아 있었지만
// 그 세 값은 실제 Shop에 존재하지 않는 수치라 아예 제거했다 — decisions.md의
// "가짜 평점·리뷰·거래건수" 항목. 거리 기준점이 없으면 정렬 기준 자체가 없어
// 이름순으로 떨어진다(searchNearbyInstallers와 같은 규칙).

function distanceKm(a: GeoPosition, b: { lat: number; lng: number }) {
  const earthRadius = 6371;
  const dLat = ((b.lat - a.latitude) * Math.PI) / 180;
  const dLng = ((b.lng - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const sin = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(sin), Math.sqrt(1 - sin));
}
export function InstallerDirectoryScreen({
  installers,
  loading,
  // 카드 스크롤이 클릭 핸들러로 옮겨가면서 이 컴포넌트는 selectedId를 더 이상
  // 읽지 않는다. 쓰기(setSelectedId)만 하므로 관례대로 _ 접두로 남겨둔다 —
  // 프로퍼티를 제거하면 DealerWorkspace 쪽 시그니처까지 번진다.
  selectedId: _selectedId,
  setSelectedId,
  favoriteIds,
  toggleFavorite,
  selectedBrand,
  isOtherBrand,
  onRequest,
  onShopSearchRequest,
  onSearchAddress,
  searchOrigin = null,
}: {
  installers: InstallerListing[];
  loading?: boolean;
  selectedId: string;
  setSelectedId: (id: string) => void;
  favoriteIds: string[];
  toggleFavorite: (id: string) => void;
  selectedBrand?: string;
  isOtherBrand: boolean;
  onRequest: () => void;
  /** Only passed in Real (Supabase) mode — surfaces the "원하는 시공점을 찾지 못하셨나요?" CTA when the filtered list is empty. */
  onShopSearchRequest?: () => void;
  /** 주소/지역 → 좌표 검색. 이 화면에서 직접 기준점을 잡을 수 있게 해준다.
   * true를 돌려주면 성공, false면 해당 행정구역을 찾지 못한 것. */
  onSearchAddress?: (value: string) => Promise<boolean>;
  /** The address the dealer actually searched for, already resolved to
   * coordinates. When present this is the distance reference point — a dealer
   * looks up shops near the CUSTOMER's car, which is rarely where the dealer
   * is standing, so their own GPS is only a fallback for when nothing has
   * been searched yet. Null until the dealer runs a search. */
  searchOrigin?: SearchLocation | null;
}) {
  const [search, setSearch] = useState("");
  const [province, setProvince] = useState("전체");
  const [city, setCity] = useState("전체");
  const [workFilter, setWorkFilter] = useState<WorkType | "전체">("전체");
  const [brandFilter, setBrandFilter] = useState<Brand | "전체">("전체");
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "map">("list");
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [focusedInstallerId, setFocusedInstallerId] = useState("");
  const [userLocation, setUserLocation] = useState<GeoPosition | null>(null);
  const [locationStatus, setLocationStatus] = useState<"pending" | "granted" | "unavailable">("pending");
  const [boundsOnly, setBoundsOnly] = useState(false);
  const [originDraft, setOriginDraft] = useState("");
  const [originError, setOriginError] = useState("");
  const [originPending, setOriginPending] = useState(false);
  const [visibleBoundsIds, setVisibleBoundsIds] = useState<string[] | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    void getCurrentPosition().then((position) => {
      if (!active) return;
      if (position) {
        setUserLocation(position);
        setLocationStatus("granted");
      } else setLocationStatus("unavailable");
    });
    return () => {
      active = false;
    };
  }, []);

  const provinceOptions = ["전체", ...administrativeRegionNames];
  const cityOptions =
    province === "전체" ? ["전체"] : ["전체", ...administrativeRegions[province as AdministrativeRegion]];

  // Searched address wins over the dealer's own GPS: the dealer is looking for
  // shops near the customer's vehicle, not near their desk.
  const distanceOrigin = searchOrigin ?? userLocation;

  const withDistance = useMemo(
    () =>
      installers.map((installer) => {
        const km =
          distanceOrigin && installer.lat != null && installer.lng != null
            ? distanceKm(distanceOrigin, { lat: installer.lat, lng: installer.lng })
            : null;
        return {
          installer,
          distanceKm: km,
          distanceLabel: km == null ? "거리 정보 없음" : `${km.toFixed(km < 10 ? 1 : 0)}km`,
        };
      }),
    [installers, distanceOrigin],
  );

  const filtered = useMemo(
    () =>
      withDistance.filter(({ installer }) => {
        if (province !== "전체" && normalizeAdministrativeRegion(installer.province) !== province) return false;
        if (city !== "전체" && installer.city !== city) return false;
        if (workFilter !== "전체" && !installer.works.includes(workFilter)) return false;
        if (brandFilter !== "전체" && !installer.brands.includes(brandFilter)) return false;
        if (onlyAvailable && !installer.available) return false;
        if (boundsOnly && visibleBoundsIds && !visibleBoundsIds.includes(installer.id)) return false;
        if (search.trim()) {
          const keyword = search.trim().toLowerCase();
          const haystack =
            `${installer.name} ${installer.address} ${installer.works.join(" ")} ${installer.brands.join(" ")}`.toLowerCase();
          if (!haystack.includes(keyword)) return false;
        }
        return true;
      }),
    [withDistance, province, city, workFilter, brandFilter, onlyAvailable, boundsOnly, visibleBoundsIds, search],
  );

  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        if (a.distanceKm == null || b.distanceKm == null) {
          if (a.distanceKm != null) return -1;
          if (b.distanceKm != null) return 1;
          return a.installer.name.localeCompare(b.installer.name, "ko");
        }
        return a.distanceKm - b.distanceKm;
      }),
    [filtered],
  );

  const selected = installers.find((item) => item.id === focusedInstallerId);
  const selectedDistanceLabel =
    withDistance.find((item) => item.installer.id === selected?.id)?.distanceLabel ?? "거리 정보 없음";

  // 카드 스크롤은 selectedId를 관찰하는 effect가 아니라 사용자 클릭 핸들러에서만
  // 일으킨다. selectedId는 화면 진입 직후에도 자동으로 바뀌기 때문이다 — 시드
  // 기본값에 이어 지오로케이션이 최근접 시공점을 다시 고르는(setSelectedShopId)
  // 두 번째 변경까지 있어, effect 방식은 어떤 가드를 세워도 진입 시 창을 몇 px
  // 끌어내렸다(fix/shell-consistency 문제 2). rAF는 setState 반영 후 카드가
  // 실제로 그려진 다음 프레임에 스크롤하기 위함이다.
  function scrollToCard(id: string) {
    requestAnimationFrame(() => {
      document.getElementById(`installer-card-${id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  function selectInstaller(id: string) {
    setFocusedInstallerId(id);
    setSelectedId(id);
    scrollToCard(id);
  }
  function selectAndOpenDetail(id: string) {
    selectInstaller(id);
    setDetailOpen(true);
  }
  /* 딜러가 찾는 기준은 자기 위치가 아니라 "고객 차량이 있는 지역"이다. 기준점이
     없으면 62곳 전부에 "거리 정보 없음"이 붙은 목록이 나오는데, 그건 정보가
     아니라 소음이다 — 대신 그 자리에서 기준 주소를 넣을 수 있게 한다. */
  async function submitOrigin() {
    const value = originDraft.trim();
    if (!value || !onSearchAddress || originPending) return;
    setOriginPending(true);
    setOriginError("");
    try {
      const found = await onSearchAddress(value);
      if (!found) setOriginError("검색 가능한 행정구역을 찾지 못했습니다. 시/군/구 단위로 입력해 보세요.");
      else setOriginDraft("");
    } finally {
      setOriginPending(false);
    }
  }

  function resetFilters() {
    setProvince("전체");
    setCity("전체");
    setWorkFilter("전체");
    setBrandFilter("전체");
    setOnlyAvailable(false);
    setSearch("");
  }

  const filterControls = (
    <div className="installer-filter-controls">
      <label>
        시/도
        <select
          value={province}
          onChange={(event) => {
            setProvince(event.target.value);
            setCity("전체");
          }}
        >
          {provinceOptions.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <label>
        시/군/구
        <select value={city} onChange={(event) => setCity(event.target.value)}>
          {cityOptions.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <label>
        시공 종류
        <select value={workFilter} onChange={(event) => setWorkFilter(event.target.value as WorkType | "전체")}>
          <option value="전체">전체</option>
          {workTypes.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <label>
        취급 브랜드
        <select value={brandFilter} onChange={(event) => setBrandFilter(event.target.value as Brand | "전체")}>
          <option value="전체">전체</option>
          {brands.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <button className="button button-ghost" onClick={resetFilters}>
        필터 초기화
      </button>
    </div>
  );

  return (
    <section className="dealer-screen installer-directory">
      <header className="ws-dashboard-header">
        <h1>시공점 찾기</h1>
        <p className="ws-page-subtitle">지역과 작업 조건에 맞는 시공점을 찾아보세요.</p>
      </header>

      <div className="ws-shop-search-bar">
        <div className="installer-toolbar">
          <label className="search-field">
            <Search size={18} aria-hidden="true" />
            <input
              aria-label="시공점 검색"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="시공점 이름, 브랜드, 작업 종류로 좁히기"
            />
          </label>
          <label className="installer-filter-toggle">
            <input
              type="checkbox"
              checked={onlyAvailable}
              onChange={(event) => setOnlyAvailable(event.target.checked)}
            />{" "}
            요청 가능한 시공점만
          </label>
          <button className="button button-secondary installer-filter-open" onClick={() => setFilterSheetOpen(true)}>
            <ListFilter size={16} /> 필터
          </button>
        </div>
        <div className="ws-shop-search-filters">{filterControls}</div>
      </div>
      {/* 검색한 주소를 화면에 계속 남긴다. 이전에는 대시보드에서 넘어온 주소가
       * 검색창에도 남지 않고 작은 회색 안내문에만 있어서, 딜러가 "내가 뭘로
       * 찾았더라" 하고 옆 검색창에 주소를 다시 치면 그 칸은 이름/브랜드
       * 필터라 결과가 오히려 사라졌다 — 같은 칸이 두 가지 일을 하는 것처럼
       * 보이던 문제. */}
      {searchOrigin && (
        <p className="installer-origin-chip">
          <MapPin size={14} aria-hidden="true" />
          <b>{searchOrigin.label}</b>
          <span>기준 · 가까운 순</span>
        </p>
      )}
      {/* 검색 전 상태. 기준점이 없으면 거리도 정렬도 없으므로, 목록을 그냥
          쏟아내는 대신 이 화면이 무엇을 필요로 하는지 한 줄로 말하고 바로 그
          자리에서 입력받는다. 목록 자체는 계속 보인다 — List First 방침. */}
      {!distanceOrigin && onSearchAddress && (
        <div className="installer-origin-prompt">
          <span className="installer-origin-prompt-icon" aria-hidden="true">
            <MapPin size={18} strokeWidth={1.9} />
          </span>
          <div className="installer-origin-prompt-body">
            <b>고객 차량이 있는 지역을 먼저 알려주세요.</b>
            <p>기준 지역을 넣으면 가까운 순으로 정렬되고 거리가 함께 표시됩니다.</p>
          </div>
          <form
            className="installer-origin-form"
            onSubmit={(event) => {
              event.preventDefault();
              void submitOrigin();
            }}
          >
            <label className="search-field">
              <Search size={17} aria-hidden="true" />
              <input
                aria-label="기준 지역 또는 주소"
                value={originDraft}
                onChange={(event) => setOriginDraft(event.target.value)}
                placeholder="예: 경기 하남시, 부산 해운대구"
              />
            </label>
            <button type="submit" className="button button-primary" disabled={originPending || !originDraft.trim()}>
              {originPending ? "찾는 중…" : "이 지역 기준으로 보기"}
            </button>
          </form>
          {originError && (
            <p className="installer-origin-error" role="alert">
              {originError}
            </p>
          )}
          {locationStatus === "unavailable" && !originError && (
            <p className="installer-origin-note">현재 위치를 쓸 수 없어 거리 기준이 아직 없습니다.</p>
          )}
        </div>
      )}

      <div className="installer-mobile-tabs">
        <button className={mobileView === "list" ? "active" : ""} onClick={() => setMobileView("list")}>
          리스트 ({sorted.length})
        </button>
        <button className={mobileView === "map" ? "active" : ""} onClick={() => setMobileView("map")}>
          <MapPin size={15} /> 지도
        </button>
      </div>

      <div className="installer-directory-layout">
        <div className={`installer-list-pane ${mobileView === "map" ? "mobile-hidden" : ""}`}>
          <div className="installer-list-head">
            <b>{loading ? "불러오는 중" : `${sorted.length}곳`}</b>
            <span>{distanceOrigin ? "가까운 순" : "이름순"}</span>
          </div>
          {loading ? (
            <SkeletonList rows={4} variant="card" label="시공점 정보를 불러오는 중입니다." />
          ) : installers.length === 0 ? (
            /* 디렉터리 자체가 비어 있음 — 필터 탓이 아니다. 실제 계정으로 갓
               가입한 딜러가 승인된 시공점이 아직 한 곳도 없을 때 보는 화면이라,
               "필터 초기화"를 권하면 아무 일도 일어나지 않는다. */
            <EmptyState
              icon={Building2}
              title="아직 등록된 시공점이 없습니다."
              description="카마스터가 시공점을 확인해 등록하는 중입니다. 원하는 지역을 알려주시면 그 지역부터 직접 찾아 연결해 드립니다."
              action={onShopSearchRequest ? { label: "시공점 찾기 요청", onClick: onShopSearchRequest } : undefined}
            />
          ) : sorted.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="조건에 맞는 시공점이 없습니다."
              description="지역·시공 종류·브랜드 필터를 넓히면 더 많은 시공점이 나옵니다."
              action={{ label: "필터 초기화", onClick: resetFilters }}
              secondaryAction={
                onShopSearchRequest ? { label: "카마스터에 찾기 요청", onClick: onShopSearchRequest } : undefined
              }
            />
          ) : (
            <div className="installer-list" ref={listRef}>
              {sorted.map(({ installer, distanceKm: km, distanceLabel }) => (
                <InstallerCard
                  key={installer.id}
                  installer={installer}
                  /* 기준점이 없을 때 62개 카드 전부에 "거리 정보 없음"을 붙이면
                     정보량 0짜리 라벨이 목록을 가득 채운다. 값이 없으면 칸을 비운다. */
                  distanceLabel={km == null ? "" : distanceLabel}
                  selected={installer.id === focusedInstallerId}
                  favorite={favoriteIds.includes(installer.id)}
                  onToggleFavorite={() => toggleFavorite(installer.id)}
                  onOpenDetail={() => selectAndOpenDetail(installer.id)}
                  onRequest={() => {
                    selectInstaller(installer.id);
                    onRequest();
                  }}
                />
              ))}
            </div>
          )}
        </div>
        <div className={`installer-map-pane ${mobileView === "list" ? "mobile-hidden" : ""}`}>
          <NaverMapView
            installers={sorted.map((item) => item.installer)}
            selectedId={focusedInstallerId}
            onSelect={(id) => selectAndOpenDetail(id)}
            userLocation={userLocation ? { lat: userLocation.latitude, lng: userLocation.longitude } : null}
            onBoundsChanged={setVisibleBoundsIds}
          />
          <div className="installer-map-footer">
            <label className="installer-bounds-toggle">
              <input type="checkbox" checked={boundsOnly} onChange={(event) => setBoundsOnly(event.target.checked)} />{" "}
              현재 지도 영역만 보기
            </label>
            <span className="installer-map-legend">
              <i className="installer-map-legend-star" aria-hidden="true">
                ★
              </i>{" "}
              위치 등록 데모 시공점
            </span>
          </div>
        </div>
      </div>

      {detailOpen &&
        selected &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="installer-detail-overlay">
            <div className="installer-detail-backdrop" onClick={() => setDetailOpen(false)} />
            <div className="installer-detail-sheet">
              <InstallerDetailPanel
                installer={selected}
                distanceLabel={selectedDistanceLabel}
                selectedBrand={selectedBrand}
                isOtherBrand={isOtherBrand}
                onRequest={() => {
                  setSelectedId(selected.id);
                  onRequest();
                }}
                onClose={() => setDetailOpen(false)}
              />
            </div>
          </div>,
          document.body,
        )}

      {filterSheetOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="installer-filter-overlay">
            <div className="installer-detail-backdrop" onClick={() => setFilterSheetOpen(false)} />
            <div className="installer-filter-sheet">
              <div className="installer-filter-sheet-head">
                <b>필터</b>
                <button aria-label="필터 닫기" onClick={() => setFilterSheetOpen(false)}>
                  <X size={18} />
                </button>
              </div>
              {filterControls}
              <button
                className="button button-primary installer-filter-apply"
                onClick={() => setFilterSheetOpen(false)}
              >
                {sorted.length}곳 보기
              </button>
            </div>
          </div>,
          document.body,
        )}
    </section>
  );
}
