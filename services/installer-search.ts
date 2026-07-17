import type { InstallerShop } from "../lib/dealer-flow-data";
import type { InstallerSearchResult, SearchLocation } from "../types/location";

export function calculateDistanceKm(origin: { latitude: number; longitude: number }, destination: { latitude: number; longitude: number }) {
  const earthRadius = 6371;
  const dLat = ((destination.latitude - origin.latitude) * Math.PI) / 180;
  const dLng = ((destination.longitude - origin.longitude) * Math.PI) / 180;
  const lat1 = (origin.latitude * Math.PI) / 180;
  const lat2 = (destination.latitude * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistanceKm(value: number) { return `${value.toFixed(value < 10 ? 1 : 0)}km`; }
const responseMinutes = (value: string) => Number(value.match(/\d+/)?.[0] ?? Number.MAX_SAFE_INTEGER);

export function searchNearbyInstallers(location: SearchLocation, shops: InstallerShop[]): InstallerSearchResult[] {
  return shops.map((shop) => {
    const distanceKm = calculateDistanceKm(location, { latitude: shop.lat, longitude: shop.lng });
    return { shop, distanceKm, distanceLabel: formatDistanceKm(distanceKm) };
  }).sort((a, b) => {
    const distanceDifference = a.distanceKm - b.distanceKm;
    if (Math.abs(distanceDifference) > 0.01) return distanceDifference;
    return responseMinutes(a.shop.responseTime) - responseMinutes(b.shop.responseTime)
      || b.shop.recentTransactionCount - a.shop.recentTransactionCount
      || b.shop.rating - a.shop.rating;
  });
}
