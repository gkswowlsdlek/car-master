export type GeoPosition = { latitude: number; longitude: number };

/**
 * Resolves to the browser's current position, or `null` if geolocation is
 * unsupported, the permission is denied, or the request times out. Never
 * throws — callers should always have a non-geolocation fallback ready.
 */
export function getCurrentPosition(): Promise<GeoPosition | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      () => resolve(null),
      { timeout: 8000, maximumAge: 300000 },
    );
  });
}
