import { districtCenters } from "../data/district-centers";
import {
  administrativeRegionFullNames,
  administrativeRegionNames,
  administrativeRegions,
} from "../data/administrative-regions";
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

export const locationSearchProvider: LocationSearchProvider = new LocalDistrictSearchProvider();
export const searchLocation = (query: string) => locationSearchProvider.search(query);
