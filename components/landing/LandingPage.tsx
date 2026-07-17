/* eslint-disable @next/next/no-img-element */
export function LandingPage({ onStart, onPriceGuide }: { onStart: () => void; onPriceGuide: () => void }) {
  return <main className="marketing-page">
    <nav className="marketing-nav"><div className="marketing-brand"><img src="/carmaster-logo-transparent.png" alt="Car-Master" /></div><div><button className="button button-ghost" onClick={onPriceGuide}>가격 가이드</button><button className="button button-primary" onClick={onStart}>로그인</button></div></nav>
    <section className="marketing-hero"><p className="eyebrow">DEALER INSTALLATION WORKSPACE</p><h1>차량 시공 업무를<br />하나의 거래 흐름으로.</h1><p className="page-subtitle">가격 확인, 시공점 선택, 작업 요청, 일정과 채팅까지.<br />카마스터가 딜러의 시공 업무를 선명하게 정리합니다.</p><div className="marketing-cta"><button className="button button-primary button-large" onClick={onStart}>카마스터 시작하기</button><button className="button button-secondary button-large" onClick={onPriceGuide}>가격 가이드 보기</button></div></section>
    <section className="trust-strip"><span>등록 시공점 100+</span><span>거래별 독립 작업 브리핑</span><span>행정구역 기준 거리 검색</span></section>
    <section className="marketing-features"><article className="card"><span>01</span><h2>가격을 먼저 확인</h2><p>주요 썬팅 브랜드의 가이드 가격을 차량 등급별로 비교합니다.</p></article><article className="card"><span>02</span><h2>가까운 시공점 선택</h2><p>구청·시청 기준 직선거리와 응답속도를 함께 확인합니다.</p></article><article className="card"><span>03</span><h2>거래방에서 끝까지</h2><p>작업내용, 일정, 금액, 채팅을 거래 단위로 안전하게 관리합니다.</p></article></section>
  </main>;
}
