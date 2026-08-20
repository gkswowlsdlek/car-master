import { NextResponse, type NextRequest } from "next/server";
import { naverGeocodingCredentials } from "../../../lib/naver-geocoding-config";
import { geocodeAddressViaNcp } from "../../../lib/ncp-geocode";

const MAX_ADDRESS_LENGTH = 200;

// 딜러가 입력한 고객 작업 주소를 실제 위/경도로 변환한다 — 이 결과가
// searchOrigin이 되어 시공점 거리 정렬의 기준점이 된다(searchLocation ->
// services/location-search.ts). Client Secret은 여기(서버)에서만 읽는다;
// 브라우저 번들에는 절대 포함되지 않는다. 실제 NCP 호출/파싱은
// lib/ncp-geocode.ts에 있다 — scripts/backfill-shop-coordinates.mjs도 같은
// 함수를 재사용한다.
export async function POST(request: NextRequest) {
  // Validate the request shape before deciding whether we can even attempt
  // the upstream call — a malformed request is a 400 regardless of whether
  // credentials happen to be configured.
  const body = (await request.json().catch(() => null)) as { address?: unknown } | null;
  const address = typeof body?.address === "string" ? body.address.trim() : "";
  if (!address) return NextResponse.json({ success: false, reason: "invalid-address" }, { status: 400 });
  if (address.length > MAX_ADDRESS_LENGTH) {
    return NextResponse.json({ success: false, reason: "invalid-address" }, { status: 400 });
  }

  const credentials = naverGeocodingCredentials();
  if (!credentials) {
    console.warn("[geocode] NAVER Maps credentials not configured — falling back to district search.");
    return NextResponse.json({ success: false, reason: "not-configured" });
  }

  const outcome = await geocodeAddressViaNcp(address, credentials);
  return NextResponse.json(outcome);
}
