const SCRIPT_SRC = "https://oapi.map.naver.com/openapi/v3/maps.js";

let loaderPromise: Promise<typeof naver.maps> | null = null;

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
  if (isUsable(window.naver?.maps)) return Promise.resolve(window.naver!.maps);
  if (loaderPromise) return loaderPromise;

  const promise = new Promise<typeof naver.maps>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-naver-maps-loader="true"]`);
    const script = existing ?? document.createElement("script");
    script.dataset.naverMapsLoader = "true";
    script.async = true;
    script.src = `${SCRIPT_SRC}?ncpKeyId=${encodeURIComponent(clientId)}`;
    script.addEventListener("load", () => {
      if (isUsable(window.naver?.maps)) resolve(window.naver!.maps);
      else reject(new Error("NAVER 지도 인증에 실패했습니다. Client ID와 Web 서비스 URL 등록을 확인해 주세요."));
    });
    script.addEventListener("error", () => reject(new Error("NAVER Maps 스크립트를 불러오지 못했습니다.")));
    if (!existing) document.head.appendChild(script);
  });

  promise.catch(() => { loaderPromise = null; });
  loaderPromise = promise;
  return promise;
}
