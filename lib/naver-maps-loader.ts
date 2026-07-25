const SCRIPT_SRC = "https://oapi.map.naver.com/openapi/v3/maps.js";

let loaderPromise: Promise<typeof naver.maps> | null = null;
let authFailureRegistered = false;

// ---- TEMP DEBUG: remove once the NAVER Maps auth-failure root cause is
// confirmed and fixed. Logs to console AND an in-memory buffer so the UI can
// render it directly (Preview is behind Vercel SSO, so DevTools may not be
// reachable for whoever is checking it).
export type NaverDebugEntry = { t: number; instance: string; event: string; data?: Record<string, unknown> };
const debugBuffer: NaverDebugEntry[] = [];
export function naverDebug(instance: string, event: string, data?: Record<string, unknown>) {
  const entry: NaverDebugEntry = { t: Math.round(typeof performance !== "undefined" ? performance.now() : Date.now()), instance, event, data };
  debugBuffer.push(entry);
  console.log(`[NAVER-DEBUG][${instance}] ${event}`, data ?? "");
}
export function getNaverDebugLog() {
  return debugBuffer;
}
function registerAuthFailureHandler() {
  if (typeof window === "undefined" || authFailureRegistered) return;
  authFailureRegistered = true;
  window.navermap_authFailure = () => {
    naverDebug("global", "navermap_authFailure fired", {
      windowNaverExists: typeof window.naver !== "undefined",
      windowNaverMapsExists: typeof window.naver?.maps !== "undefined",
      windowNaverMapsIsNull: window.naver?.maps === null,
    });
  };
}
// ---- END TEMP DEBUG ----

// A truthy `window.naver.maps` is not proof the SDK actually initialized —
// on an auth failure (wrong Client ID, unregistered Web Service URL) NAVER
// can still leave a non-null but incomplete `maps` object in place, and the
// script's `load` event fires either way since the file itself downloaded
// fine. Requiring the `Map` constructor to exist confirms the SDK is really
// usable, not just present.
function isUsable(maps: unknown): maps is typeof naver.maps {
  return typeof maps === "object" && maps !== null && typeof (maps as { Map?: unknown }).Map === "function";
}

/**
 * Loads the NAVER Maps JavaScript API v3 SDK exactly once per page, using the
 * current ncpKeyId auth scheme (the older ncpClientId parameter is deprecated
 * by NAVER and intentionally not supported here).
 * https://navermaps.github.io/maps.js.en/docs/tutorial-2-Getting-Started.html
 */
export function loadNaverMaps(clientId: string): Promise<typeof naver.maps> {
  if (typeof window === "undefined") return Promise.reject(new Error("NAVER Maps는 브라우저에서만 로드할 수 있습니다."));
  registerAuthFailureHandler();

  if (isUsable(window.naver?.maps)) {
    naverDebug("loader", "loadNaverMaps: already usable, resolving immediately", { hasMap: true });
    return Promise.resolve(window.naver!.maps);
  }
  if (loaderPromise) {
    naverDebug("loader", "loadNaverMaps: reusing in-flight loaderPromise");
    return loaderPromise;
  }

  const promise = new Promise<typeof naver.maps>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-naver-maps-loader="true"]`);
    const script = existing ?? document.createElement("script");
    script.dataset.naverMapsLoader = "true";
    script.async = true;
    script.src = `${SCRIPT_SRC}?ncpKeyId=${encodeURIComponent(clientId)}`;

    naverDebug("loader", "script tag prepared", {
      scriptSrc: script.src,
      containsNcpKeyId: script.src.includes("ncpKeyId="),
      clientIdRaw: JSON.stringify(clientId),
      clientIdLength: clientId.length,
      reusedExistingTag: Boolean(existing),
    });

    script.addEventListener("load", () => {
      naverDebug("loader", "script 'load' event fired", {
        windowNaverType: typeof window.naver,
        windowNaverMapsType: typeof window.naver?.maps,
        windowNaverMapsIsNull: window.naver?.maps === null,
        typeofMap: typeof window.naver?.maps?.Map,
        typeofLatLng: typeof window.naver?.maps?.LatLng,
      });
      // authFailure can fire slightly after 'load' — re-check a moment later
      // instead of judging usability from this single synchronous snapshot.
      setTimeout(() => {
        naverDebug("loader", "re-check +300ms after load", {
          windowNaverMapsType: typeof window.naver?.maps,
          windowNaverMapsIsNull: window.naver?.maps === null,
          typeofMap: typeof window.naver?.maps?.Map,
          typeofLatLng: typeof window.naver?.maps?.LatLng,
        });
        if (isUsable(window.naver?.maps)) resolve(window.naver!.maps);
        else reject(new Error("NAVER 지도 인증에 실패했습니다. Client ID와 Web 서비스 URL 등록을 확인해 주세요."));
      }, 300);
    });
    script.addEventListener("error", (event) => {
      naverDebug("loader", "script 'error' event fired", { event: String(event) });
      reject(new Error("NAVER Maps 스크립트를 불러오지 못했습니다."));
    });
    if (!existing) document.head.appendChild(script);
  });

  promise.catch(() => { loaderPromise = null; });
  loaderPromise = promise;
  return promise;
}
