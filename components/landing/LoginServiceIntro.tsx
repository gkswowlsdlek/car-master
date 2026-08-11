import { ArrowRight, MapPin, MessageCircle, ShieldCheck, Wrench } from "lucide-react";

export function LoginWorkspaceBenefits({ className = "" }: { className?: string }) {
  return <ul className={`login-workspace-benefits ${className}`}>
    <li><i><MapPin size={26} /></i><span><b>가까운 시공점 찾기</b><small>지도와 목록에서 거리·작업 조건으로 시공점을 비교합니다.</small></span></li>
    <li><i><Wrench size={26} /></i><span><b>조건에 맞는 시공점 비교</b><small>시공 종류와 취급 브랜드로 원하는 시공점을 찾습니다.</small></span></li>
    <li><i><MessageCircle size={26} /></i><span><b>거래별 업무 기록</b><small>요청부터 완료까지 모든 기록을 거래방에 남깁니다.</small></span></li>
  </ul>;
}

export function LoginServiceIntro({ onExplore, onPriceGuide }: { onExplore: () => void; onPriceGuide: () => void }) {
  return (
    <section className="login-service-intro">
      <div className="login-intro-brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/carmaster-logo-transparent.png" alt="Car-Master" />
      </div>
      <p className="eyebrow">DEALER INSTALLATION WORKSPACE</p>
      <h1>자동차 용품 시공,<br />카카오톡 대신<br /><span className="no-break">카마스터 하나로.</span></h1>
      <p className="login-intro-description">가까운 시공점을 찾는 것부터<br />견적 요청, 거래방 생성, 작업 진행 관리까지<br />딜러의 용품 시공 업무를 한곳에서 관리합니다.</p>
      <LoginWorkspaceBenefits className="login-benefits-desktop" />
      <p className="login-trust"><ShieldCheck size={17} /> 카마스터 파트너 전용 보안 업무공간</p>
      <div className="login-intro-actions">
        <button className="secondary" onClick={onExplore}>서비스 둘러보기</button>
        <button className="primary" onClick={onPriceGuide}>로그인하기 <ArrowRight size={17} /></button>
      </div>
    </section>
  );
}
