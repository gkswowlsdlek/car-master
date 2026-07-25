const SCRIPT_SRC = "https://oapi.map.naver.com/openapi/v3/maps.js";

let loaderPromise: Promise<typeof naver.maps> | null = null;

/**
 * Loads the NAVER Maps JavaScript API v3 SDK exactly once per page, using the
 * current ncpKeyId auth scheme (the older ncpClientId parameter is deprecated
 * by NAVER and intentionally not supported here).
 * https://navermaps.github.io/maps.js.en/docs/tutorial-2-Getting-Started.html
 */
export function loadNaverMaps(clientId: string): Promise<typeof naver.maps> {
  if (typeof window === "undefined") return Promise.reject(new Error("NAVER Maps는 브라우저에서만 로드할 수 있습니다."));
  if (window.naver?.maps) return Promise.resolve(window.naver.maps);
  if (loaderPromise) return loaderPromise;

  const promise = new Promise<typeof naver.maps>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-naver-maps-loader="true"]`);
    const script = existing ?? document.createElement("script");
    script.dataset.naverMapsLoader = "true";
    script.async = true;
    script.src = `${SCRIPT_SRC}?ncpKeyId=${encodeURIComponent(clientId)}`;
    script.addEventListener("load", () => {
      if (window.naver?.maps) resolve(window.naver.maps);
      else reject(new Error("NAVER Maps 스크립트를 불러왔지만 초기화하지 못했습니다."));
    });
    script.addEventListener("error", () => reject(new Error("NAVER Maps 스크립트를 불러오지 못했습니다.")));
    if (!existing) document.head.appendChild(script);
  });

  promise.catch(() => { loaderPromise = null; });
  loaderPromise = promise;
  return promise;
}
