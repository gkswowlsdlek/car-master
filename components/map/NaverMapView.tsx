"use client";

import { useEffect, useRef, useState } from "react";
import { getNaverDebugLog, loadNaverMaps, naverDebug } from "../../lib/naver-maps-loader";
import type { InstallerListing } from "../../types/installer";

const SEOUL_CENTER = { lat: 37.5665, lng: 126.978 };

function markerIcon(selected: boolean, ns: typeof naver.maps): naver.maps.HtmlIcon {
  const size = selected ? 24 : 16;
  return {
    content: `<div class="naver-marker-pin${selected ? " selected" : ""}"></div>`,
    size: new ns.Size(size, size),
    anchor: new ns.Point(size / 2, size / 2),
  };
}

export function NaverMapView({ installers, selectedId, onSelect, userLocation, onBoundsChanged, instanceLabel = "map" }: {
  installers: InstallerListing[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  userLocation?: { lat: number; lng: number } | null;
  onBoundsChanged?: (visibleIds: string[]) => void;
  instanceLabel?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<naver.maps.Map | null>(null);
  // Captured once, right after loadNaverMaps resolves with a verified-usable
  // SDK. Every later effect reads this ref instead of `window.naver.maps`
  // directly — re-reading the mutable global was a prior bug: on an auth
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
  const [, forceRerender] = useState(0);

  useEffect(() => {
    naverDebug(instanceLabel, "mount: env var check", { hasClientId: Boolean(clientId), clientIdRaw: JSON.stringify(clientId), clientIdLength: clientId?.length ?? 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!clientId || !containerRef.current) return;
    let cancelled = false;

    loadNaverMaps(clientId).then((ns) => {
      naverDebug(instanceLabel, "loadNaverMaps resolved", { typeofMap: typeof ns?.Map, typeofLatLng: typeof ns?.LatLng, isNull: ns === null });
      if (cancelled || !containerRef.current) return;
      nsRef.current = ns;
      const map = new ns.Map(containerRef.current, {
        center: new ns.LatLng(userLocation?.lat ?? SEOUL_CENTER.lat, userLocation?.lng ?? SEOUL_CENTER.lng),
        zoom: userLocation ? 12 : 7,
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
      naverDebug(instanceLabel, "map instance created OK");

      if (onBoundsChanged) {
        ns.Event.addListener(map, "idle", () => {
          const bounds = map.getBounds();
          const visible = installers.filter((item) => item.lat != null && item.lng != null && bounds.hasLatLng(new ns.LatLng(item.lat!, item.lng!))).map((item) => item.id);
          onBoundsChanged(visible);
        });
      }
    }).catch((error: unknown) => {
      naverDebug(instanceLabel, "loadNaverMaps rejected", { message: error instanceof Error ? error.message : String(error) });
      if (cancelled) return;
      setStatus("unavailable");
      setErrorMessage(error instanceof Error ? error.message : "지도를 불러오지 못했습니다.");
      forceRerender((n) => n + 1);
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  useEffect(() => {
    const map = mapRef.current;
    const ns = nsRef.current;
    if (!map || !ns || status !== "ready") return;
    const markers = markersRef.current;

    for (const [id, marker] of markers) {
      if (!installers.some((item) => item.id === id)) { marker.setMap(null); markers.delete(id); }
    }
    installers.forEach((item) => {
      if (item.lat == null || item.lng == null) return;
      const selected = item.id === selectedId;
      const existing = markers.get(item.id);
      if (existing) {
        existing.setIcon(markerIcon(selected, ns));
        existing.setZIndex(selected ? 200 : 100);
        return;
      }
      const marker = new ns.Marker({ position: new ns.LatLng(item.lat, item.lng), map, title: item.name, icon: markerIcon(selected, ns), zIndex: selected ? 200 : 100 });
      ns.Event.addListener(marker, "click", () => onSelect(item.id));
      markers.set(item.id, marker);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installers, status, selectedId]);

  useEffect(() => {
    const map = mapRef.current;
    const ns = nsRef.current;
    if (!map || !ns || status !== "ready") return;
    if (!userLocation) { userMarkerRef.current?.setMap(null); userMarkerRef.current = null; return; }
    const position = new ns.LatLng(userLocation.lat, userLocation.lng);
    if (userMarkerRef.current) userMarkerRef.current.setPosition(position);
    else userMarkerRef.current = new ns.Marker({ position, map, title: "현재 위치", icon: { content: '<div class="naver-marker-user"></div>', size: new ns.Size(18, 18), anchor: new ns.Point(9, 9) }, zIndex: 300 });
  }, [userLocation, status]);

  useEffect(() => {
    const map = mapRef.current;
    const ns = nsRef.current;
    if (!map || !ns || status !== "ready" || !selectedId) return;
    const target = installers.find((item) => item.id === selectedId);
    if (!target || target.lat == null || target.lng == null) return;
    map.panTo(new ns.LatLng(target.lat, target.lng), { duration: 300 });
    if (map.getZoom() < 12) map.setZoom(13);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  if (status === "unavailable") {
    return <div className="naver-map-fallback">
      <p className="naver-map-fallback-title">지도를 불러올 수 없습니다.</p>
      <p className="naver-map-fallback-body">{errorMessage || "NAVER 지도를 사용할 수 없어 목록으로만 시공점을 확인할 수 있습니다."}</p>
      {/* TEMP DEBUG PANEL — remove once the NAVER Maps auth-failure root cause is confirmed and fixed. */}
      <pre style={{ marginTop: 12, maxHeight: 220, overflow: "auto", background: "#111827", color: "#d1fae5", fontSize: 10, lineHeight: 1.5, padding: 10, borderRadius: 8, textAlign: "left", width: "100%" }}>
        {getNaverDebugLog().map((entry) => `[${entry.t}ms][${entry.instance}] ${entry.event} ${entry.data ? JSON.stringify(entry.data) : ""}`).join("\n")}
      </pre>
    </div>;
  }

  return <div className="naver-map-shell">
    {status === "loading" && <div className="naver-map-loading" role="status"><span className="naver-map-spinner" />지도를 불러오는 중입니다…</div>}
    <div ref={containerRef} className="naver-map-canvas" aria-label="시공점 지도" />
  </div>;
}
