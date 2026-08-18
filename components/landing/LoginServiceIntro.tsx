import { ArrowRight, ClipboardList, MapPin, ShieldCheck, SlidersHorizontal } from "lucide-react";

// 아이콘은 lucide 한 세트로 통일하고 size/strokeWidth를 고정한다 — 이전에는
// MapPin(26) / Wrench(26) / MessageCircle(26)이 기본 두께로 섞여 있어 선 굵기가
// 제각각으로 보였다.
const benefits = [
  {
    icon: MapPin,
    title: "가까운 용품점 찾기",
    description: "지도와 목록에서 거리·작업 조건으로 용품점을 비교합니다.",
  },
  {
    icon: SlidersHorizontal,
    title: "조건에 맞는 용품점 비교",
    description: "작업 종류와 취급 브랜드로 원하는 용품점을 찾습니다.",
  },
  {
    icon: ClipboardList,
    title: "거래별 업무 기록",
    description: "요청부터 완료까지 모든 기록을 거래방에 남깁니다.",
  },
];

export function LoginWorkspaceBenefits({ className = "" }: { className?: string }) {
  return (
    <ul className={`login-workspace-benefits ${className}`}>
      {benefits.map(({ icon: Icon, title, description }) => (
        <li key={title}>
          <i aria-hidden="true">
            <Icon size={26} strokeWidth={1.75} />
          </i>
          <span>
            <b>{title}</b>
            <small>{description}</small>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function LoginServiceIntro({ onExplore, onPriceGuide }: { onExplore: () => void; onPriceGuide: () => void }) {
  return (
    <section className="login-service-intro">
      <div className="login-intro-brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="brand-logo-clip" src="/carmaster-logo-transparent.png" alt="Car-Master" />
        <small>자동차 용품 시공, 더 스마트하게</small>
      </div>
      <h1>
        자동차 용품 작업,
        <br />
        카카오톡 대신
        <br />
        <span className="no-break">카마스터 하나로.</span>
      </h1>
      <p className="login-intro-description">
        가까운 차량용품점을 찾는 것부터
        <br />
        견적 요청, 업체별 대화, 작업 진행 관리까지
        <br />
        딜러의 용품 작업 업무를 한곳에서 관리합니다.
      </p>
      <LoginWorkspaceBenefits className="login-benefits-desktop" />
      <p className="login-trust">
        <ShieldCheck size={19} strokeWidth={1.75} /> 카마스터 파트너 전용 보안 업무공간
      </p>
      <div className="login-intro-actions">
        <button className="secondary" onClick={onExplore}>
          서비스 둘러보기
        </button>
        <button className="primary" onClick={onPriceGuide}>
          로그인하기 <ArrowRight size={18} />
        </button>
      </div>
    </section>
  );
}
