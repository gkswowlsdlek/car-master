import type { InstallerListing } from "../types/installer";
import type { InstallerSearchResult, SearchLocation } from "../types/location";

export function calculateDistanceKm(
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number },
) {
  const earthRadius = 6371;
  const dLat = ((destination.latitude - origin.latitude) * Math.PI) / 180;
  const dLng = ((destination.longitude - origin.longitude) * Math.PI) / 180;
  const lat1 = (origin.latitude * Math.PI) / 180;
  const lat2 = (destination.latitude * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistanceKm(value: number) {
  return `${value.toFixed(value < 10 ? 1 : 0)}km`;
}
export function searchNearbyInstallers(location: SearchLocation, shops: InstallerListing[]): InstallerSearchResult[] {
  return shops
    .map((shop) => {
      if (shop.lat == null || shop.lng == null) return { shop, distanceKm: null, distanceLabel: "거리 정보 없음" };
      const distanceKm = calculateDistanceKm(location, { latitude: shop.lat, longitude: shop.lng });
      return { shop, distanceKm, distanceLabel: formatDistanceKm(distanceKm) };
    })
    // Distance is the only ranking signal the product actually has. The old
    // tie-breakers (응답시간 → 최근 거래 → 평점) ranked on numbers no real Shop
    // has, so they only ever reordered demo fixtures — see decisions.md,
    // "가짜 평점·리뷰·거래건수". Ties fall back to a stable name order.
    .sort((a, b) => {
      if (a.distanceKm == null) return b.distanceKm == null ? 0 : 1;
      if (b.distanceKm == null) return -1;
      const distanceDifference = a.distanceKm - b.distanceKm;
      if (Math.abs(distanceDifference) > 0.01) return distanceDifference;
      return a.shop.name.localeCompare(b.shop.name, "ko");
    });
}
