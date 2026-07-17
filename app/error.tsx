"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="system-state-page"><section><div className="system-state-icon error">!</div><p className="eyebrow">TEMPORARY ERROR</p><h1>화면을 불러오지 못했습니다.</h1><p>잠시 후 다시 시도해 주세요. 작성 중인 거래 정보는 브라우저에 유지됩니다.</p><div><button className="primary" onClick={reset}>다시 시도</button><button className="secondary" onClick={() => window.location.assign("/")}>홈으로 이동</button></div></section></main>;
}
