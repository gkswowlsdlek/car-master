"use client";

import { useEffect, useState } from "react";

/**
 * public/images/korea-region-map.svg는 지역별 fill/stroke·전국 분포 점이
 * 이미 구워진 정적 SVG다(가공 스크립트: id별 톤 통일 + point-in-polygon
 * 샘플링). 인라인 DOM으로 넣어야 CSS 커스텀 프로퍼티(--color-primary 등)가
 * 상속되므로 <img>가 아니라 fetch 후 주입한다.
 */
export function RegionMap() {
  const [markup, setMarkup] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/images/korea-region-map.svg", { cache: "no-store" })
      .then((res) => res.text())
      .then((svg) => {
        if (!cancelled) setMarkup(svg);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="region-map-frame">
      {markup && <div className="region-map-svg" dangerouslySetInnerHTML={{ __html: markup }} />}
    </div>
  );
}
