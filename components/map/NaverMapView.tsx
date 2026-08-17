"use client";

import { useEffect, useRef, useState } from "react";
import { loadNaverMaps } from "../../lib/naver-maps-loader";
import type { InstallerListing } from "../../types/installer";

const SEOUL_CENTER = { lat: 37.5665, lng: 126.978 };
// "지하철역 정도가 보이는" neighborhood/street-level zoom for focusing a
// selected installer — NAVER's zoom scale, not a percentage.
const FOCUS_ZOOM = 16;

const STAR_PATH = "M12 2.5l2.97 6.02 6.64.97-4.8 4.68 1.13 6.6L12 17.77l-5.94 3 1.13-6.6-4.8-4.68 6.64-.97L12 2.5z";

function markerIcon(selected: boolean, isDemo: boolean, ns: typeof naver.maps): naver.maps.HtmlIcon {
  if (!isDemo) {
    const size = selected ? 26 : 18;
    return {
      content: `<div class="naver-marker-pin${selected ? " selected" : ""}"></div>`,
      size: new ns.Size(size, size),
      anchor: new ns.Point(size / 2, size / 2),
    };
  }
  // Demo (위치 등록) installers get a solid green circle with a white star,
  // matching NAVER's own "저장된 장소" marker convention — a small filled
  // dot sized like the basemap's own POI icons, not an oversized badge.
  const size = selected ? 30 : 24;
  return {
    content: `<div class="naver-marker-star${selected ? " selected" : ""}"><svg viewBox="0 0 24 24" width="${Math.round(size * 0.55)}" height="${Math.round(size * 0.55)}"><path d="${STAR_PATH}" /></svg></div>`,
    size: new ns.Size(size, size),
    anchor: new ns.Point(size / 2, size / 2),
  };
}

export function NaverMapView({
  installers,
  selectedId,
  onSelect,
  userLocation,
  onBoundsChanged,
}: {
  installers: InstallerListing[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  userLocation?: { lat: number; lng: number } | null;
  onBoundsChanged?: (visibleIds: string[]) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<naver.maps.Map | null>(null);
  // Captured once, right after loadNaverMaps resolves with a verified-usable
  // SDK. Every later effect reads this ref instead of `window.naver.maps`
  // directly — re-reading the mutable global was the actual bug: on an auth
  // failure NAVER can leave `window.naver.maps` null/incomplete some time
  // after the initial (successful) resolution, and any effect that re-read
  // the global at that point would crash on `ns.LatLng` with "Cannot read
  // properties of null". Holding our own validated reference sidesteps that
  // entirely regardless of what the global does afterward.
  const nsRef = useRef<typeof naver.maps | null>(null);
  const markersRef = useRef<Map<string, naver.maps.Marker>>(new Map());
  const userMarkerRef = useRef<naver.maps.Marker | null>(null);
  const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">(clientId ? "loading" : "unavailable");
  const [errorMessage, setErrorMessage] = useState(clientId ? "" : "NAVER 지도 API 키가 설정되지 않았습니다.");

  // installers/selectedId at the moment loadNaverMaps() resolves — not at
  // the moment this effect was created. The SDK load is async (500ms+), and
  // during that gap the directory screen's data/selection can arrive or
  // change. Reading through refs (updated every render below) means the
  // map's very first center is seeded from whatever is actually selected by
  // the time construction happens, instead of racing a panTo() against the
  // map's own post-construction settle.
  const installersRef = useRef(installers);
  const selectedIdRef = useRef(selectedId);
  useEffect(() => {
    installersRef.current = installers;
    selectedIdRef.current = selectedId;
  });

  useEffect(() => {
    if (!clientId || !containerRef.current) return;
    let cancelled = false;

    loadNaverMaps(clientId)
      .then((ns) => {
        if (cancelled || !containerRef.current) return;
        nsRef.current = ns;
        const selectedTarget = installersRef.current.find((item) => item.id === selectedIdRef.current);
        const initialCenter =
          selectedTarget?.lat != null && selectedTarget?.lng != null
            ? { lat: selectedTarget.lat, lng: selectedTarget.lng }
            : userLocation;
        const map = new ns.Map(containerRef.current, {
          center: new ns.LatLng(initialCenter?.lat ?? SEOUL_CENTER.lat, initialCenter?.lng ?? SEOUL_CENTER.lng),
          zoom: initialCenter ? FOCUS_ZOOM : 10,
          minZoom: 6,
          maxZoom: 19,
          zoomControl: true,
          zoomControlOptions: { position: ns.Position.TOP_RIGHT },
          scaleControl: false,
          logoControl: true,
          mapDataControl: false,
        });
        mapRef.current = map;
        setStatus("ready");

        if (onBoundsChanged) {
          ns.Event.addListener(map, "idle", () => {
            const bounds = map.getBounds();
            const visible = installers
              .filter(
                (item) => item.lat != null && item.lng != null && bounds.hasLatLng(new ns.LatLng(item.lat!, item.lng!)),
              )
              .map((item) => item.id);
            onBoundsChanged(visible);
          });
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setStatus("unavailable");
        setErrorMessage(error instanceof Error ? error.message : "지도를 불러오지 못했습니다.");
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  useEffect(() => {
    const map = mapRef.current;
    const ns = nsRef.current;
    if (!map || !ns || status !== "ready") return;
    const markers = markersRef.current;

    for (const [id, marker] of markers) {
      if (!installers.some((item) => item.id === id)) {
        marker.setMap(null);
        markers.delete(id);
      }
    }
    installers.forEach((item) => {
      if (item.lat == null || item.lng == null) return;
      const selected = item.id === selectedId;
      const existing = markers.get(item.id);
      if (existing) {
        existing.setIcon(markerIcon(selected, item.isDemo, ns));
        existing.setZIndex(selected ? 200 : 100);
        return;
      }
      const marker = new ns.Marker({
        position: new ns.LatLng(item.lat, item.lng),
        map,
        title: item.name,
        icon: markerIcon(selected, item.isDemo, ns),
        zIndex: selected ? 200 : 100,
      });
      ns.Event.addListener(marker, "click", () => onSelect(item.id));
      markers.set(item.id, marker);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installers, status, selectedId]);

  useEffect(() => {
    const map = mapRef.current;
    const ns = nsRef.current;
    if (!map || !ns || status !== "ready") return;
    if (!userLocation) {
      userMarkerRef.current?.setMap(null);
      userMarkerRef.current = null;
      return;
    }
    const position = new ns.LatLng(userLocation.lat, userLocation.lng);
    if (userMarkerRef.current) userMarkerRef.current.setPosition(position);
    else
      userMarkerRef.current = new ns.Marker({
        position,
        map,
        title: "현재 위치",
        icon: {
          content: '<div class="naver-marker-user"></div>',
          size: new ns.Size(18, 18),
          anchor: new ns.Point(9, 9),
        },
        zIndex: 300,
      });
  }, [userLocation, status]);

  useEffect(() => {
    const map = mapRef.current;
    const ns = nsRef.current;
    // `status` must be a dependency here, not just `selectedId` — selectedId
    // is usually already set on mount (a default installer is pre-selected),
    // so this effect's first real run happens before the map finishes async
    // loading and used to bail out silently, leaving the map at its default
    // wide view forever even though something was "selected". Re-running
    // once status flips to "ready" is what actually focuses the map.
    if (!map || !ns || status !== "ready" || !selectedId) return;
    const target = installers.find((item) => item.id === selectedId);
    if (!target || target.lat == null || target.lng == null) return;
    map.panTo(new ns.LatLng(target.lat, target.lng), { duration: 300 });
    if (map.getZoom() < FOCUS_ZOOM) map.setZoom(FOCUS_ZOOM);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, status]);

  if (status === "unavailable") {
    return (
      <div className="naver-map-fallback">
        <p className="naver-map-fallback-title">지도를 불러올 수 없습니다.</p>
        <p className="naver-map-fallback-body">
          {errorMessage || "NAVER 지도를 사용할 수 없습니다."}
          <br />
          시공점 목록에서 계속 비교하고 선택할 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="naver-map-shell">
      {status === "loading" && (
        <div className="naver-map-loading" role="status">
          <span className="naver-map-spinner" />
          지도를 불러오는 중입니다…
        </div>
      )}
      <div ref={containerRef} className="naver-map-canvas" aria-label="시공점 지도" />
    </div>
  );
}
