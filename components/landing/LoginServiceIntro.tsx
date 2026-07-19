import { ArrowRight, CircleDollarSign, MapPin, MessageCircle, ShieldCheck } from "lucide-react";

export function LoginWorkspaceBenefits({ className = "" }: { className?: string }) {
  return <ul className={`login-workspace-benefits ${className}`}>
    <li><i><CircleDollarSign size={26} /></i><span><b>투명한 가격 가이드</b><small>주요 브랜드와 차량 등급별 기준가를 한눈에 확인합니다.</small></span></li>
    <li><i><MapPin size={26} /></i><span><b>검증된 시공점 연결</b><small>거리와 응답 정보를 비교해 적합한 파트너를 찾습니다.</small></span></li>
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
      <p className="login-intro-description">용품 및 시공 가격 확인부터<br />시공점 선택, 거래방 생성, 작업 진행 관리까지<br />딜러의 용품 시공 업무를 한곳에서 관리합니다.</p>
      <LoginWorkspaceBenefits className="login-benefits-desktop" />
      <p className="login-trust"><ShieldCheck size={17} /> 카마스터 파트너 전용 보안 업무공간</p>
      <div className="login-intro-actions">
        <button className="secondary" onClick={onExplore}>서비스 둘러보기</button>
        <button className="primary" onClick={onPriceGuide}>시공 가격 가이드 보기 <ArrowRight size={17} /></button>
      </div>
    </section>
  );
}
