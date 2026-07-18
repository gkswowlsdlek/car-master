import { ArrowRight, CircleDollarSign, MapPin, MessageCircle, ShieldCheck } from "lucide-react";

export function LoginServiceIntro({ onExplore, onPriceGuide }: { onExplore: () => void; onPriceGuide: () => void }) {
  return (
    <section className="login-service-intro">
      <div className="login-intro-brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/carmaster-logo-transparent.png" alt="Car-Master" />
      </div>
      <p className="eyebrow">DEALER INSTALLATION WORKSPACE</p>
      <h1>자동차 용품 시공,<br />카카오톡 대신<br /><span className="no-break">카마스터 하나로.</span></h1>
      <p>시공 가격 확인부터 시공점 선택, 거래방 생성, 작업 진행 관리까지 딜러의 시공 업무를 한곳에서 관리합니다.</p>
      <ul>
        <li><CircleDollarSign size={20} /><span><b>투명한 가격 가이드</b><small>주요 브랜드와 차량 등급별 기준가를 확인합니다.</small></span></li>
        <li><MapPin size={20} /><span><b>검증된 시공점 연결</b><small>거리와 응답 정보를 한눈에 비교합니다.</small></span></li>
        <li><MessageCircle size={20} /><span><b>거래별 업무 기록</b><small>요청부터 완료까지 하나의 거래방에 남깁니다.</small></span></li>
      </ul>
      <p className="login-trust"><ShieldCheck size={16} /> 카마스터 베타 파트너 전용 보안 워크스페이스</p>
      <div className="login-intro-actions">
        <button className="secondary" onClick={onExplore}>서비스 둘러보기</button>
        <button className="primary" onClick={onPriceGuide}>시공 가격 가이드 보기 <ArrowRight size={17} /></button>
      </div>
    </section>
  );
}
