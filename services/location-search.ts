import { districtCenters } from "../data/district-centers";
import {
  administrativeRegionFullNames,
  administrativeRegionNames,
  administrativeRegions,
} from "../data/administrative-regions";
import { geocodeAddress } from "./geocoding-service";
import type { SearchLocation } from "../types/location";

export interface LocationSearchProvider {
  search(query: string): Promise<SearchLocation | null>;
}

export function normalizeLocationQuery(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/서울특별시|서울시/g, "서울")
    .replace(/경기도/g, "경기")
    .replace(/\s+/g, "")
    .trim();
}

export class LocalDistrictSearchProvider implements LocationSearchProvider {
  async search(query: string): Promise<SearchLocation | null> {
    const normalized = normalizeLocationQuery(query);
    if (normalized.length < 2) return null;
    const center = districtCenters.find((item) =>
      item.aliases.some((alias) => normalizeLocationQuery(alias) === normalized),
    );
    if (center)
      return {
        id: center.id,
        city: center.city,
        district: center.district,
        label: center.label,
        latitude: center.latitude,
        longitude: center.longitude,
      };

    const region = administrativeRegionNames.find((name) => normalized.includes(normalizeLocationQuery(name)));
    if (!region) return null;
    const district = administrativeRegions[region].find((name) => normalized.includes(normalizeLocationQuery(name)));
    if (!district) return null;
    const regionCenter = districtCenters.find((item) => item.city === administrativeRegionFullNames[region]);
    if (!regionCenter) return null;
    const seed = [...district].reduce((sum, character) => sum + character.charCodeAt(0), 0);
    const angle = (seed * 137.508 * Math.PI) / 180;
    const radius = 0.012 + (seed % 7) * 0.003;
    return {
      id: `${region}-${district}`,
      city: administrativeRegionFullNames[region],
      district,
      label: `${region} ${district}`,
      latitude: Number((regionCenter.latitude + Math.sin(angle) * radius).toFixed(5)),
      longitude: Number((regionCenter.longitude + Math.cos(angle) * radius).toFixed(5)),
    };
  }
}

/** Real geocoding — the address the dealer typed is sent to NCP Maps
 * Geocoding (via the server-side /api/geocode route, see
 * services/geocoding-service.ts) and the actual returned coordinates become
 * the search origin. city/district come from NCP's own SIDO/SIGUGUN address
 * elements (already full-name, matching districtCenters' convention) rather
 * than re-parsing the road address string. */
export class NaverGeocodingSearchProvider implements LocationSearchProvider {
  async search(query: string): Promise<SearchLocation | null> {
    const trimmed = query.trim();
    if (trimmed.length < 2) return null;
    const result = await geocodeAddress(trimmed);
    if (!result) return null;
    return {
      id: `geocode-${result.latitude}-${result.longitude}`,
      city: result.sido ?? "",
      district: result.sigugun ?? "",
      label: result.roadAddress,
      latitude: result.latitude,
      longitude: result.longitude,
    };
  }
}

/** Tries each provider in order, returning the first real result. */
export class CompositeLocationSearchProvider implements LocationSearchProvider {
  private readonly providers: LocationSearchProvider[];
  constructor(providers: LocationSearchProvider[]) {
    this.providers = providers;
  }
  async search(query: string): Promise<SearchLocation | null> {
    for (const provider of this.providers) {
      const result = await provider.search(query);
      if (result) return result;
    }
    return null;
  }
}

// 실제 Geocoding(NaverGeocodingSearchProvider) 성공 좌표를 우선 사용하고,
// 실패했을 때만(NCP 인증정보 미설정/네트워크 오류/주소를 찾지 못함 등)
// district 중심점 + 결정적 랜덤 오프셋으로 만든 가짜 좌표(LocalDistrictSearchProvider)로
// 넘어간다 — 실패 자체가 앱을 죽이지 않도록 하는 안전망일 뿐, 실제 위치는
// 아니다.
// TODO: Free Beta 출시 전 fake coordinate fallback(LocalDistrictSearchProvider) 제거 —
// 출시 후에는 Geocoding 실패 시 가짜 거리를 보여주지 말고 "거리 정보 없음"
// 등으로 명확히 표시해야 한다.
export const locationSearchProvider: LocationSearchProvider = new CompositeLocationSearchProvider([
  new NaverGeocodingSearchProvider(),
  new LocalDistrictSearchProvider(),
]);
export const searchLocation = (query: string) => locationSearchProvider.search(query);
