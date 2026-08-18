/* eslint-disable @next/next/no-img-element */
import { ArrowRight, Building2, Clock3, MapPin, MessageCircle } from "lucide-react";

// Product Rule sanity (Phase 8 §20): 견적 요청→협의→거래 확정 순서는 실제
// Flow와 다르다 — Shop 선택 즉시 거래/거래방이 생성되고(Installer 수락 대기
// 없음), 전화 확인은 그 이후 정상 절차다. "확정"이라는 별도 후행 단계는 없다.
const workflow = ["지역 검색", "용품점 비교", "시공 요청", "전화 확인", "작업 관리"];

// 검색 가능한 권역과 그 안의 주요 출고 지역. "우리 업체가 이 도시에 다 있다"는
// 주장이 아니라 딜러가 어느 지역명으로 찾게 되는지를 보여주는 것이고, 실제 업체
// 노출 기준은 아래 hero-coverage-note에 그대로 적는다.
const coverage = [
  { region: "수도권", cities: "서울 · 인천 · 수원 · 성남 · 고양 · 용인" },
  { region: "강원권", cities: "춘천 · 원주 · 강릉 · 속초" },
  { region: "충청권", cities: "대전 · 세종 · 청주 · 천안 · 아산" },
  { region: "호남권", cities: "광주 · 전주 · 익산 · 순천 · 목포" },
  { region: "영남권", cities: "부산 · 대구 · 울산 · 창원 · 포항 · 진주" },
  { region: "제주권", cities: "제주 · 서귀포" },
];

const benefits = [
  {
    icon: Building2,
    title: "전국 차량용품점 네트워크",
    description: "썬팅·PPF·블랙박스까지, 지역별 등록 업체를 한곳에서 봅니다",
  },
  {
    icon: MapPin,
    title: "지역·조건으로 검색",
    description: "출고 지역, 작업 종류, 취급 브랜드로 원하는 곳만 추립니다",
  },
  {
    icon: MessageCircle,
    title: "업체별 대화 채널 자동 개설",
    description: "업체를 고르면 견적·일정을 주고받을 채팅방이 바로 열립니다",
  },
  {
    icon: Clock3,
    title: "작업 진행 상황 확인",
    description: "입고부터 출고까지 지금 어디까지 됐는지 한눈에 봅니다",
  },
];

export function LandingPage({ onStart }: { onStart: () => void }) {
  return (
    <main className="marketing-page">
      <nav className="marketing-nav">
        <div className="marketing-brand">
          <span className="marketing-brand-logo">
            <img className="brand-logo-clip" src="/carmaster-logo-transparent.png" alt="Car-Master" />
          </span>
          <small>자동차 용품 시공, 더 스마트하게</small>
        </div>
        <div>
          <button className="button button-primary" onClick={onStart}>
            로그인
          </button>
        </div>
      </nav>
      <section className="marketing-hero">
        <div className="marketing-hero-copy">
          <div className="hero-kicker">자동차 딜러를 위한 용품 작업 플랫폼</div>
          <h1>
            전국 어디로 출고해도,
            <br />
            <span>가까운 차량용품점을 바로 찾으세요.</span>
          </h1>
          <p className="page-subtitle hero-message">
            지역과 필요한 작업 조건으로 용품점을 찾고,{" "}
            <br />
            시공 요청부터 작업 관리까지 이어가세요.
          </p>
          <div className="marketing-cta">
            <button className="button button-primary button-large" onClick={onStart}>
              카마스터 시작하기 <ArrowRight size={18} />
            </button>
          </div>
          <div className="hero-assurance">
            <span>
              <MapPin size={16} /> 가까운 용품점 우선 탐색
            </span>
            <span>
              <Clock3 size={16} /> 거래별 기록 관리
            </span>
          </div>
        </div>
        <div className="hero-product-stack">
          <div className="hero-coverage">
            <div className="hero-coverage-head">
              <span>NATIONWIDE COVERAGE</span>
              <b>전국 어디로 출고해도 그 지역부터 찾습니다</b>
            </div>
            <ul className="hero-coverage-grid">
              {coverage.map(({ region, cities }) => (
                <li key={region}>
                  <b>{region}</b>
                  <small>{cities}</small>
                </li>
              ))}
            </ul>
            <p className="hero-coverage-note">
              업체는 등록 지역 기준으로 표시되며, 거리도 같은 기준으로 계산합니다.
            </p>
          </div>
          <div className="hero-workflow" aria-label="카마스터 이용 흐름">
            <div>
              <span>NEARBY SHOP FIRST</span>
              <b>가까운 용품점을 찾고, 요청하고, 연결하세요</b>
            </div>
            <ol>
              {workflow.map((item, index) => (
                <li key={item}>
                  <i>{index + 1}</i>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>
      <section className="trust-strip">
        {benefits.map(({ icon: Icon, title, description }) => (
          <article key={title}>
            <i aria-hidden="true">
              <Icon size={22} strokeWidth={1.75} />
            </i>
            <b>{title}</b>
            <small>{description}</small>
          </article>
        ))}
      </section>
      <section className="marketing-final-cta">
        <p className="eyebrow">READY TO START</p>
        <h2>다음 출고 지역의 용품점부터 찾아보세요.</h2>
        <p className="final-cta-description">
          지역과 작업 조건에 맞는 용품점을 찾고, 시공 요청부터 작업 관리까지 카마스터에서 이어가세요.
        </p>
        <button className="button button-primary button-large" onClick={onStart}>
          카마스터 시작하기 <ArrowRight size={19} />
        </button>
      </section>
      <footer className="marketing-footer">
        <div className="footer-brand">
          <span className="footer-brand-logo">
            <img className="brand-logo-clip" src="/carmaster-logo-transparent.png" alt="Car-Master" />
          </span>
          <p>딜러와 차량용품점을 하나의 거래 흐름으로 연결합니다.</p>
          <div className="footer-links">
            <a href="/terms">이용약관</a>
            <span aria-hidden="true">|</span>
            <a href="/privacy">개인정보처리방침</a>
          </div>
        </div>
        <div className="footer-meta">
          <span>
            <small>서비스</small>Car-Master Beta
          </span>
          <span>
            <small>문의</small>채널 준비 중
          </span>
          <span>
            <small>Copyright</small>© 2026 Car-Master
          </span>
        </div>
      </footer>
    </main>
  );
}
