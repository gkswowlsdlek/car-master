// The actual NCP Maps Geocoding v2 call + response parsing, extracted out of
// app/api/geocode/route.ts so the exact same logic can be reused by
// scripts/backfill-shop-coordinates.mjs (a standalone Node script, not a
// Next.js request) without duplicating the fetch/parsing code. No
// Next.js-specific types here on purpose.
const NCP_GEOCODE_ENDPOINT = "https://maps.apigw.ntruss.com/map-geocode/v2/geocode";

type NcpAddressElement = { types?: string[]; longName?: string; shortName?: string };
type NcpAddress = {
  roadAddress?: string;
  jibunAddress?: string;
  x?: string;
  y?: string;
  addressElements?: NcpAddressElement[];
};
type NcpGeocodeResponse = { status?: string; addresses?: NcpAddress[]; errorMessage?: string };

export type NcpGeocodeSuccess = {
  success: true;
  latitude: number;
  longitude: number;
  roadAddress: string;
  sido?: string;
  sigugun?: string;
};
export type NcpGeocodeFailure = { success: false; reason: string; status?: number };
export type NcpGeocodeOutcome = NcpGeocodeSuccess | NcpGeocodeFailure;

function pickElement(elements: NcpAddressElement[] | undefined, type: string) {
  return elements?.find((item) => item.types?.includes(type));
}

export async function geocodeAddressViaNcp(
  address: string,
  credentials: { clientId: string; clientSecret: string },
): Promise<NcpGeocodeOutcome> {
  const url = `${NCP_GEOCODE_ENDPOINT}?query=${encodeURIComponent(address)}`;
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        "x-ncp-apigw-api-key-id": credentials.clientId,
        "x-ncp-apigw-api-key": credentials.clientSecret,
        Accept: "application/json",
      },
    });
  } catch (error) {
    console.warn("[ncp-geocode] network error calling NCP geocoding", error);
    return { success: false, reason: "network-error" };
  }

  if (response.status === 401 || response.status === 403) {
    console.warn(`[ncp-geocode] NCP geocoding auth failed (${response.status}) — check credentials.`);
    return { success: false, reason: "auth-error", status: response.status };
  }
  if (response.status === 429) {
    console.warn("[ncp-geocode] NCP geocoding rate-limited (429).");
    return { success: false, reason: "rate-limited", status: 429 };
  }
  if (!response.ok) {
    console.warn(`[ncp-geocode] NCP geocoding upstream error (${response.status}).`);
    return { success: false, reason: "upstream-error", status: response.status };
  }

  let data: NcpGeocodeResponse;
  try {
    data = (await response.json()) as NcpGeocodeResponse;
  } catch {
    return { success: false, reason: "invalid-response" };
  }

  const first = data.addresses?.[0];
  if (data.status !== "OK" || !first || !first.x || !first.y) {
    return { success: false, reason: "not-found" };
  }

  const latitude = Number(first.y);
  const longitude = Number(first.x);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { success: false, reason: "invalid-response" };
  }

  return {
    success: true,
    latitude,
    longitude,
    roadAddress: first.roadAddress || first.jibunAddress || address,
    sido: pickElement(first.addressElements, "SIDO")?.longName,
    sigugun: pickElement(first.addressElements, "SIGUGUN")?.longName,
  };
}
