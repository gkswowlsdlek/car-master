import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const normalize = (source) => source.replace(/\r\n?/g, "\n");

let routeSource;
let ncpGeocodeSource;
let serviceSource;
let locationSearchSource;
let configSource;
let installerDirectorySource;
let installerSearchSource;
let migrationSource;
let envExampleSource;
let adminShopRepoSource;
let adminModalSource;
let adminShopTypesSource;
let backfillScriptSource;
let addressCoordinateRefreshMigrationSource;
let shopManagementRepoSource;
let shopManagementScreenSource;

test.before(async () => {
  routeSource = normalize(await read("app/api/geocode/route.ts"));
  ncpGeocodeSource = normalize(await read("lib/ncp-geocode.ts"));
  serviceSource = normalize(await read("services/geocoding-service.ts"));
  locationSearchSource = normalize(await read("services/location-search.ts"));
  configSource = normalize(await read("lib/naver-geocoding-config.ts"));
  installerDirectorySource = normalize(await read("components/dealer/InstallerDirectoryScreen.tsx"));
  installerSearchSource = normalize(await read("services/installer-search.ts"));
  migrationSource = normalize(await read("supabase/migrations/202608190002_admin_shop_geocoded_coordinates.sql"));
  envExampleSource = normalize(await read(".env.example"));
  adminShopRepoSource = normalize(await read("repositories/admin-shop-repository.ts"));
  adminModalSource = normalize(await read("components/admin/AdminQuickShopRegistrationModal.tsx"));
  adminShopTypesSource = normalize(await read("types/admin-shop.ts"));
  backfillScriptSource = normalize(await read("scripts/backfill-shop-coordinates.mjs"));
  addressCoordinateRefreshMigrationSource = normalize(
    await read("supabase/migrations/202608190003_shop_address_change_coordinate_refresh.sql"),
  );
  shopManagementRepoSource = normalize(await read("repositories/shop-management-repository.ts"));
  shopManagementScreenSource = normalize(await read("components/shop/ShopManagementScreen.tsx"));
});

// F. Client Secret은 절대 브라우저 번들에 노출되지 않는다 — NEXT_PUBLIC_ 접두를
// 붙이지 않고, "use client" 파일에서 config 모듈을 import하지 않는다.
test("NAVER_MAP_CLIENT_SECRET is never referenced with a NEXT_PUBLIC_ prefix, and the server-only config module isn't imported by any client component", async () => {
  assert.doesNotMatch(configSource, /NEXT_PUBLIC_NAVER_MAP_CLIENT_SECRET/);
  assert.match(configSource, /process\.env\.NAVER_MAP_CLIENT_SECRET/);
  assert.doesNotMatch(routeSource, /NEXT_PUBLIC_NAVER_MAP_CLIENT_SECRET/);
  // route.ts must not be a client component
  assert.doesNotMatch(routeSource, /"use client"/);
  // the client-side wrapper only ever talks to our own /api/geocode route,
  // never to NCP directly — the Secret literally cannot reach the browser.
  assert.doesNotMatch(serviceSource, /apigw\.ntruss\.com/);
  assert.match(serviceSource, /fetch\("\/api\/geocode"/);
  assert.doesNotMatch(serviceSource, /NAVER_MAP_CLIENT_SECRET/);
});

test("the shared NCP geocoding call (lib/ncp-geocode.ts, reused by the route AND the backfill script) only ever fetches a hardcoded NCP endpoint — the caller-supplied address is a query param, never a caller-supplied URL (no open fetch proxy)", () => {
  assert.match(ncpGeocodeSource, /const NCP_GEOCODE_ENDPOINT = "https:\/\/maps\.apigw\.ntruss\.com\/map-geocode\/v2\/geocode";/);
  assert.match(ncpGeocodeSource, /fetch\(url,/);
  assert.doesNotMatch(ncpGeocodeSource, /fetch\(\s*(?:request\.|body\.|payload\.)/);
  assert.match(routeSource, /import \{ geocodeAddressViaNcp \} from "\.\.\/\.\.\/\.\.\/lib\/ncp-geocode";/);
});

// D. 잘못된 주소 → crash 없음. API 입력값 validation.
test("the geocode route validates input defensively — empty/non-string/overlong address returns a 400 with a reason, never throws", () => {
  assert.match(routeSource, /const address = typeof body\?\.address === "string" \? body\.address\.trim\(\) : "";/);
  assert.match(routeSource, /if \(!address\) return NextResponse\.json\(\{ success: false, reason: "invalid-address" \}, \{ status: 400 \}\);/);
  assert.match(routeSource, /if \(address\.length > MAX_ADDRESS_LENGTH\)/);
  assert.match(routeSource, /await request\.json\(\)\.catch\(\(\) => null\)/);
});

// E. Geocoding API 실패(401/403/429/5xx/네트워크) → 안전하게 처리, crash 없음.
test("the shared NCP geocoding call handles every upstream failure mode (network/401/403/429/5xx/malformed json) without throwing, each with a distinguishable reason for dev-log visibility — used by both the route and the backfill script", () => {
  assert.match(ncpGeocodeSource, /catch \(error\) \{\s*\n\s*console\.warn\("\[ncp-geocode\] network error/);
  assert.match(ncpGeocodeSource, /response\.status === 401 \|\| response\.status === 403/);
  assert.match(ncpGeocodeSource, /reason: "auth-error"/);
  assert.match(ncpGeocodeSource, /response\.status === 429/);
  assert.match(ncpGeocodeSource, /reason: "rate-limited"/);
  assert.match(ncpGeocodeSource, /if \(!response\.ok\)/);
  assert.match(ncpGeocodeSource, /reason: "upstream-error"/);
  assert.match(ncpGeocodeSource, /catch \{\s*\n\s*return \{ success: false, reason: "invalid-response" \};\s*\n\s*\}/);
});

test("missing NAVER credentials degrade to a clear not-configured response instead of throwing (mirrors the isServiceRoleConfigured capability-probe convention already used by app/api/demo-attachments)", () => {
  assert.match(routeSource, /if \(!credentials\) \{/);
  assert.match(routeSource, /reason: "not-configured"/);
  assert.match(configSource, /export const isNaverGeocodingConfigured = Boolean\(clientId && clientSecret\);/);
});

// A. 정상 주소 → 실제 lat/lng 반환 (파싱 로직 검증 — 실제 NCP 호출 없이 mock).
test("geocodeAddress parses a successful /api/geocode response into real lat/lng + road address, using NCP's own SIDO/SIGUGUN address elements for city/district", async () => {
  const originalFetch = globalThis.fetch;
  let capturedRequest;
  globalThis.fetch = async (url, init) => {
    capturedRequest = { url, init };
    return {
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        latitude: 37.497913,
        longitude: 127.027583,
        roadAddress: "서울특별시 강남구 테헤란로 152",
        sido: "서울특별시",
        sigugun: "강남구",
      }),
    };
  };
  try {
    const { geocodeAddress } = await import("../services/geocoding-service.ts");
    const result = await geocodeAddress("서울 강남구 테헤란로 152");
    assert.equal(capturedRequest.url, "/api/geocode");
    assert.equal(capturedRequest.init.method, "POST");
    assert.deepEqual(JSON.parse(capturedRequest.init.body), { address: "서울 강남구 테헤란로 152" });
    assert.equal(result.latitude, 37.497913);
    assert.equal(result.longitude, 127.027583);
    assert.equal(result.sido, "서울특별시");
    assert.equal(result.sigugun, "강남구");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// D + E 조합. geocodeAddress 레벨에서도 절대 throw하지 않는다.
test("geocodeAddress never throws — empty input, network failure, and a not-found NCP response all resolve to null", async () => {
  const { geocodeAddress } = await import("../services/geocoding-service.ts");
  assert.equal(await geocodeAddress(""), null);
  assert.equal(await geocodeAddress("   "), null);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("simulated network failure");
  };
  try {
    assert.equal(await geocodeAddress("존재하지 않는 주소 asdkfjaslkdfj"), null);
  } finally {
    globalThis.fetch = originalFetch;
  }

  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ success: false, reason: "not-found" }),
  });
  try {
    assert.equal(await geocodeAddress("존재하지 않는 주소"), null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// C + E. CompositeLocationSearchProvider — 실제 Geocoding 우선, 실패 시에만
// 다음 provider(district fallback)로 넘어간다는 우선순위 검증.
//
// location-search.ts는 런타임 상대경로 import(../data/district-centers, 확장자
// 없음)를 갖고 있어 --experimental-strip-types(strip-only 모드)로 직접
// dynamic import 실행이 안 된다 — TS bundler-resolution 관례(tsconfig
// moduleResolution: "bundler")를 그대로 쓰는 기존 코드베이스 전반의 특성이지
// 이번 변경으로 생긴 문제가 아니다(services/transaction-state-service.ts 등
// 기존에 동적 import되는 파일들은 전부 import type만 가진 우연). 이 파일 안의
// 다른 두 값-import-없는 신규 서비스(geocoding-service.ts, installer-search.ts)는
// 위에서 실제로 동적 import해 실행 검증했고, 이 provider는 이 저장소의 기존
// 관례대로 소스 패턴 검증으로 확인한다.
test("CompositeLocationSearchProvider tries providers in order and stops at the first real result — NaverGeocodingSearchProvider first, LocalDistrictSearchProvider only as fallback", () => {
  assert.match(
    locationSearchSource,
    /export const locationSearchProvider: LocationSearchProvider = new CompositeLocationSearchProvider\(\[\s*\n\s*new NaverGeocodingSearchProvider\(\),\s*\n\s*new LocalDistrictSearchProvider\(\),\s*\n\s*\]\);/,
  );
  assert.match(
    locationSearchSource,
    /for \(const provider of this\.providers\) \{\s*\n\s*const result = await provider\.search\(query\);\s*\n\s*if \(result\) return result;\s*\n\s*\}\s*\n\s*return null;/,
  );
});

// TODO 주석이 실제로 남아 있는지 — item 5의 명시적 요구사항.
test("a TODO explicitly marks the fake coordinate fallback for removal before Free Beta launch", () => {
  assert.match(locationSearchSource, /TODO: Free Beta 출시 전 fake coordinate fallback\(LocalDistrictSearchProvider\) 제거/);
});

// B. 주소 검색 후에는 searchOrigin이 origin — browser GPS보다 우선.
// (기존 InstallerDirectoryScreen.tsx 로직 확인 — 이번 작업에서 변경하지 않았음을
// 회귀 테스트로 보호한다.)
test("InstallerDirectoryScreen already prioritizes a searched address (searchOrigin) over the dealer's own GPS (userLocation) — unchanged by this feature, protected here as a regression guard", () => {
  assert.match(
    installerDirectorySource,
    /const distanceOrigin = searchOrigin \?\? userLocation;/,
  );
});

// C. 서로 다른 주소 검색 → 거리 결과가 달라진다 (순수 거리 계산 함수 검증).
test("calculateDistanceKm produces genuinely different distances for different origins against the same shop — real haversine math, not a stub", async () => {
  const { calculateDistanceKm } = await import("../services/installer-search.ts");
  const shop = { latitude: 37.5665, longitude: 126.978 }; // 서울시청
  const gangnam = { latitude: 37.4979, longitude: 127.0276 };
  const busan = { latitude: 35.1796, longitude: 129.0756 };
  const distanceFromGangnam = calculateDistanceKm(gangnam, shop);
  const distanceFromBusan = calculateDistanceKm(busan, shop);
  assert.ok(distanceFromGangnam > 5 && distanceFromGangnam < 20, `expected ~10km, got ${distanceFromGangnam}`);
  assert.ok(distanceFromBusan > 300, `expected >300km, got ${distanceFromBusan}`);
  assert.notEqual(distanceFromGangnam.toFixed(1), distanceFromBusan.toFixed(1));
});

// G. 기존 Shop Search 흐름(useDistanceOrigin, searchNearbyInstallers 정렬)은
// 변경되지 않았다 — regression guard.
test("searchNearbyInstallers still sorts by real distance and still reports 거리 정보 없음 for a shop with no coordinates — unchanged by this feature", () => {
  assert.match(installerSearchSource, /return earthRadius \* 2 \* Math\.atan2\(Math\.sqrt\(a\), Math\.sqrt\(1 - a\)\);/);
  assert.match(installerSearchSource, /shop\.lat == null \|\| shop\.lng == null\) return \{ shop, distanceKm: null, distanceLabel: "거리 정보 없음" \};/);
});

// 4. installer_shops에 이미 latitude/longitude가 있으므로 새 컬럼을 만들지
// 않는다 — migration이 실제로 새 컬럼을 추가하지 않는지 확인.
test("the written (not-applied) migration only widens admin_register_shop's INSERT to accept already-existing latitude/longitude columns — no new column, no RLS change, existing callers unaffected", () => {
  assert.doesNotMatch(migrationSource, /add column/i);
  assert.doesNotMatch(migrationSource, /create policy|alter policy|drop policy/i);
  assert.match(migrationSource, /create or replace function public\.admin_register_shop\(payload jsonb\)/);
  assert.match(
    migrationSource,
    /p_latitude double precision := nullif\(payload ->> 'latitude', ''\)::double precision;/,
  );
  // omitting latitude/longitude from payload must still work exactly as before (both stay NULL)
  assert.match(migrationSource, /p_latitude, p_longitude\s*\n\s*\) returning id into new_id;/);
});

test("naming convention: reuses the existing NEXT_PUBLIC_NAVER_MAP_CLIENT_ID / NAVER_MAP_CLIENT_SECRET pair already declared in .env.example, instead of inventing a second credential pair", () => {
  assert.match(envExampleSource, /NEXT_PUBLIC_NAVER_MAP_CLIENT_ID=/);
  assert.match(envExampleSource, /NAVER_MAP_CLIENT_SECRET=/);
  assert.match(configSource, /NEXT_PUBLIC_NAVER_MAP_CLIENT_ID/);
  assert.match(configSource, /NAVER_MAP_CLIENT_SECRET/);
});

// 1-3. Admin 시공점 등록 시 실제 Geocoding 결과가 payload에 포함된다.
test("QuickRegisterShopInput carries optional real latitude/longitude, and admin-shop-repository only includes them in the RPC payload when both are actually present (never sends a partial/fabricated pair)", () => {
  assert.match(adminShopTypesSource, /latitude\?: number;\s*\n\s*longitude\?: number;/);
  assert.match(
    adminShopRepoSource,
    /\.\.\.\(input\.latitude != null && input\.longitude != null\s*\n\s*\? \{ latitude: input\.latitude, longitude: input\.longitude \}\s*\n\s*: \{\}\),/,
  );
});

test("AdminQuickShopRegistrationModal geocodes the entered address via the same client-side geocoding service the Dealer search uses (not a direct NCP call from the browser), and never blocks registration if geocoding fails or is unconfigured", () => {
  assert.match(adminModalSource, /import \{ geocodeAddress \} from "\.\.\/\.\.\/services\/geocoding-service";/);
  assert.match(
    adminModalSource,
    /const geocoded = await geocodeAddress\(address\.trim\(\)\)\.catch\(\(\) => null\);/,
  );
  assert.match(adminModalSource, /latitude: geocoded\?\.latitude,\s*\n\s*longitude: geocoded\?\.longitude,/);
  // registration must not be gated on geocoded — canSubmit only checks shopName/address/phone
  assert.match(adminModalSource, /const canSubmit = shopName\.trim\(\) && address\.trim\(\) && phone\.trim\(\);/);
  assert.doesNotMatch(adminModalSource, /canSubmit.*geocoded|geocoded.*canSubmit/);
});

// 5. NULL 좌표 backfill — SQL migration 안에서 외부 HTTP 호출을 억지로 하지
// 않고, 사람이 실행하는 one-off 스크립트로 분리했다. 가짜 좌표를 채우지 않고,
// 실패한 주소는 NULL로 남겨 보고한다.
test("the backfill script is a human-run one-off (not a SQL migration, not a client-callable RPC), only ever writes real geocoded coordinates (never a fabricated fallback), and only targets shops still missing coordinates so it's safe to re-run", () => {
  assert.match(backfillScriptSource, /import \{ geocodeAddressViaNcp \} from "\.\.\/lib\/ncp-geocode\.ts";/);
  assert.match(backfillScriptSource, /\.or\("latitude\.is\.null,longitude\.is\.null"\)/);
  assert.match(backfillScriptSource, /if \(!outcome\.success\) \{/);
  assert.match(backfillScriptSource, /SKIP {2}\$\{shop\.shop_name\}/);
  assert.doesNotMatch(backfillScriptSource, /Math\.random|districtCenters|LocalDistrictSearchProvider/);
  // uses the service-role client (bypasses RLS) — never a NEXT_PUBLIC_-only key
  assert.match(backfillScriptSource, /SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(backfillScriptSource, /createClient\(supabaseUrl, serviceKey/);
  // supports a dry run so a human can preview before writing
  assert.match(backfillScriptSource, /const DRY_RUN = process\.argv\.includes\("--dry-run"\);/);
});

// 6. Shop 자체 주소 수정 경로(update_shop_operating_profile)도 좌표를 잊지
// 않는다 — 주소가 바뀌었는데 새 좌표가 같이 오지 않으면(geocoding 실패/미설정)
// 옛 주소를 가리키는 좌표를 그대로 남겨두지 않고 NULL로 비운다. 새 좌표가
// 오면 그 값을 그대로 저장한다. 주소가 안 바뀌었으면 좌표도 그대로 둔다.
test("update_shop_operating_profile clears latitude/longitude to NULL when the address changes without a fresh geocoded coordinate, stores fresh coordinates when provided, and leaves coordinates untouched when the address didn't change", () => {
  assert.match(
    addressCoordinateRefreshMigrationSource,
    /next_address := case when p_payload \? 'address'/,
  );
  assert.match(addressCoordinateRefreshMigrationSource, /address_changed := next_address is distinct from current_shop\.address;/);
  assert.match(
    addressCoordinateRefreshMigrationSource,
    /next_latitude := case\s*\n\s*when p_payload \? 'latitude' then nullif\(p_payload ->> 'latitude', ''\)::double precision\s*\n\s*when address_changed then null\s*\n\s*else current_shop\.latitude\s*\n\s*end;/,
  );
  assert.match(
    addressCoordinateRefreshMigrationSource,
    /next_longitude := case\s*\n\s*when p_payload \? 'longitude' then nullif\(p_payload ->> 'longitude', ''\)::double precision\s*\n\s*when address_changed then null\s*\n\s*else current_shop\.longitude\s*\n\s*end;/,
  );
  assert.match(addressCoordinateRefreshMigrationSource, /latitude = next_latitude,\s*\n\s*longitude = next_longitude,/);
  // no new column, no RLS change — same authorization checks copied verbatim
  assert.doesNotMatch(addressCoordinateRefreshMigrationSource, /add column|create policy|alter policy|drop policy/i);
  assert.match(addressCoordinateRefreshMigrationSource, /current_shop\.approval_status <> 'approved'/);
  assert.match(addressCoordinateRefreshMigrationSource, /membership\.membership_role in \('owner'.*'manager'/s);
});

test("shop-management-repository only forwards latitude/longitude to the RPC payload when a fresh coordinate was actually passed in", () => {
  assert.match(
    shopManagementRepoSource,
    /coordinates\?: \{ latitude: number; longitude: number \},/,
  );
  assert.match(
    shopManagementRepoSource,
    /\.\.\.\(coordinates \? \{ latitude: coordinates\.latitude, longitude: coordinates\.longitude \} : \{\}\),/,
  );
});

test("ShopManagementScreen re-geocodes the address via the same client-side geocoding service only when the address actually changed, never blocks saving when geocoding fails, and tells the Shop owner when the new coordinate couldn't be confirmed", () => {
  assert.match(
    shopManagementScreenSource,
    /import \{ geocodeAddress \} from "\.\.\/\.\.\/services\/geocoding-service";/,
  );
  assert.match(
    shopManagementScreenSource,
    /const addressChanged = draft\.address\.trim\(\) !== record\.address\.trim\(\);/,
  );
  assert.match(
    shopManagementScreenSource,
    /const geocoded = addressChanged \? await geocodeAddress\(draft\.address\.trim\(\)\)\.catch\(\(\) => null\) : null;/,
  );
  // save must not be gated on geocoding success
  assert.doesNotMatch(shopManagementScreenSource, /if \(!geocoded\)[\s\S]{0,40}return;/);
  assert.match(
    shopManagementScreenSource,
    /addressChanged && !geocoded\s*\n\s*\? "운영정보를 저장했습니다\. 새 주소의 위치 좌표를 확인하지 못해/,
  );
});
