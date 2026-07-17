export function LoginServiceIntro({ onExplore, onPriceGuide }: { onExplore: () => void; onPriceGuide: () => void }) {
  return (
    <section className="login-service-intro">
      <div className="login-intro-brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/carmaster-logo-transparent.png" alt="Car-Master" />
      </div>
      <p className="eyebrow">DEALER INSTALLATION WORKSPACE</p>
      <h1>자동차 용품 시공,<br />카카오톡 대신 카마스터 하나로.</h1>
      <p>시공 가격 확인부터 시공점 선택, 거래방 생성, 작업 진행 관리까지 딜러의 시공 업무를 한곳에서 관리합니다.</p>
      <ul>
        <li>주요 브랜드 시공 가격 가이드</li>
        <li>가까운 등록 시공점 검색</li>
        <li>거래별 자동 작업 브리핑</li>
      </ul>
      <div className="login-intro-actions">
        <button className="secondary" onClick={onExplore}>서비스 둘러보기</button>
        <button className="primary" onClick={onPriceGuide}>시공 가격 가이드 보기</button>
      </div>
    </section>
  );
}
