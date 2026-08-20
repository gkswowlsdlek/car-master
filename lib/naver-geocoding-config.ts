// Server-only credential check for app/api/geocode. Reuses the SAME NCP Maps
// application credentials the Web Dynamic Map SDK already uses
// (NEXT_PUBLIC_NAVER_MAP_CLIENT_ID, see components/map/NaverMapView.tsx) —
// NCP's current Maps product shares one Client ID/Secret pair across the map
// widget, Geocoding, Reverse Geocoding, and Directions sub-APIs, so this does
// not introduce a second credential pair to provision.
//
// The Client ID itself is already public (it ships in the map widget's own
// script tag), so reading NEXT_PUBLIC_NAVER_MAP_CLIENT_ID here is safe. The
// Secret is intentionally NOT prefixed NEXT_PUBLIC_ and is only ever read
// from this server-only module — never import this file from a "use client"
// component. If that happened by mistake anyway, Next.js never inlines a
// non-NEXT_PUBLIC_ var into the client bundle, so it would just read as
// undefined in the browser, not leak the secret.
const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID?.trim() ?? "";
const clientSecret = process.env.NAVER_MAP_CLIENT_SECRET?.trim() ?? "";

export const isNaverGeocodingConfigured = Boolean(clientId && clientSecret);

export function naverGeocodingCredentials() {
  if (!isNaverGeocodingConfigured) return null;
  return { clientId, clientSecret };
}
