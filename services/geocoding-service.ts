export type GeocodeResult = {
  latitude: number;
  longitude: number;
  roadAddress: string;
  sido?: string;
  sigugun?: string;
};

type GeocodeApiResponse =
  | { success: true; latitude: number; longitude: number; roadAddress: string; sido?: string; sigugun?: string }
  | { success: false; reason: string };

/** Calls the server-side /api/geocode route (never NCP directly — the
 * Client Secret only ever lives on the server). Never throws: every failure
 * path (network/auth/rate-limit/not-found/not-configured) resolves to null
 * so callers can fall back to the existing district search without a
 * try/catch of their own. The specific failure reason is only logged, for
 * dev-time visibility into "did geocoding actually fail, or just not run". */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const trimmed = address.trim();
  if (!trimmed) return null;
  let response: Response;
  try {
    response = await fetch("/api/geocode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: trimmed }),
    });
  } catch (error) {
    console.warn("[geocoding] request failed (network)", error);
    return null;
  }
  if (!response.ok && response.status !== 400) {
    console.warn("[geocoding] request failed", response.status);
    return null;
  }
  let data: GeocodeApiResponse;
  try {
    data = (await response.json()) as GeocodeApiResponse;
  } catch {
    console.warn("[geocoding] invalid response body");
    return null;
  }
  if (!data.success) {
    console.warn(`[geocoding] no result: ${data.reason}`);
    return null;
  }
  return {
    latitude: data.latitude,
    longitude: data.longitude,
    roadAddress: data.roadAddress,
    sido: data.sido,
    sigugun: data.sigugun,
  };
}
