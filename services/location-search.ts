import { districtCenters } from "../data/district-centers";
import type { SearchLocation } from "../types/location";

export interface LocationSearchProvider {
  search(query: string): Promise<SearchLocation | null>;
}

export function normalizeLocationQuery(value: string) {
  return value.trim().toLowerCase().replace(/서울특별시|서울시/g, "서울").replace(/경기도/g, "경기").replace(/\s+/g, "").trim();
}

export class LocalDistrictSearchProvider implements LocationSearchProvider {
  async search(query: string): Promise<SearchLocation | null> {
    const normalized = normalizeLocationQuery(query);
    if (normalized.length < 2) return null;
    const center = districtCenters.find((item) => item.aliases.some((alias) => normalizeLocationQuery(alias) === normalized));
    return center ? { id: center.id, city: center.city, district: center.district, label: center.label, latitude: center.latitude, longitude: center.longitude } : null;
  }
}

export const locationSearchProvider: LocationSearchProvider = new LocalDistrictSearchProvider();
export const searchLocation = (query: string) => locationSearchProvider.search(query);
