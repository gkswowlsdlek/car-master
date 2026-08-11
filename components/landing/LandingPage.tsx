/* eslint-disable @next/next/no-img-element */
import { ArrowRight, Building2, Clock3, MapPin, MessageCircle, Truck, Wrench } from "lucide-react";

const workflow = ["지역 검색", "시공점 비교", "견적 요청", "전화·메시지 협의", "거래 확정"];

export function LandingPage({ onStart }: { onStart: () => void }) {
  return <main className="marketing-page">
    <nav className="marketing-nav"><div className="marketing-brand"><span className="marketing-brand-logo"><img src="/carmaster-logo-transparent.png" alt="Car-Master" /></span><small>자동차 용품 시공, 더 스마트하게</small></div><div><button className="button button-primary" onClick={onStart}>로그인</button></div></nav>
    <section className="marketing-hero">
      <div className="marketing-hero-copy"><div className="hero-kicker">딜러와 시공점을 연결하는 업무공간</div><h1>전국 어디로 출고해도,<br /><span>가까운 시공점을 바로 찾으세요.</span></h1><p className="page-subtitle hero-message">지역과 필요한 작업 조건으로 시공점을 찾고,<br />견적 요청부터 거래까지 이어가세요.</p><div className="marketing-cta"><button className="button button-primary button-large" onClick={onStart}>카마스터 시작하기 <ArrowRight size={18} /></button></div><div className="hero-assurance"><span><MapPin size={16} /> 가까운 시공점 우선 탐색</span><span><Clock3 size={16} /> 거래별 기록 관리</span></div></div>
      <div className="hero-product-stack">
        <div className="product-preview" aria-label="카마스터 시공점 찾기 화면 미리보기"><div className="preview-window-bar"><span /><span /><span /><b>Car-Master Workspace</b></div><div className="preview-app"><aside><div className="preview-logo-mark">CM</div>{["시공점 찾기", "시공 요청", "거래 관리", "메시지"].map((item, index) => <i className={index === 0 ? "active" : ""} key={item}>{item}</i>)}</aside><section><header><div><small>SHOP DISCOVERY</small><strong>가까운 시공점을 확인하세요</strong></div><span>지역 검색</span></header><div className="preview-metrics"><article><small>탐색 방식</small><b>지도 + 목록</b><em>실시간 위치 기준</em></article><article><small>비교</small><b>거리·작업 조건</b><em>바로 비교</em></article><article><small>연결</small><b>전화·메시지</b><em>바로 문의</em></article></div><div className="preview-table"><div><b>가까운 시공점</b><span>지도에서 보기</span></div><p><i><Building2 size={14} /></i><span><b>서울 강남권 시공점</b><small>썬팅 · PPF · 블랙박스</small></span><em>2.1km</em></p><p><i><Wrench size={14} /></i><span><b>경기 남부권 시공점</b><small>PPF 전문</small></span><em className="waiting">요청 가능</em></p><p><i><Truck size={14} /></i><span><b>인천·부천권 시공점</b><small>블랙박스 · 썬팅</small></span><em className="done">요청 가능</em></p></div></section></div></div>
        <div className="hero-workflow" aria-label="카마스터 이용 흐름"><div><span>NEARBY SHOP FIRST</span><b>가까운 시공점을 찾고, 요청하고, 연결하세요</b></div><ol>{workflow.map((item, index) => <li key={item}><i>{index + 1}</i><span>{item}</span></li>)}</ol></div>
      </div>
    </section>
    <section className="trust-strip"><span className="primary-benefit"><Building2 size={24} /> 전국 시공점 네트워크</span><span className="primary-benefit"><MapPin size={24} /> 지역·조건으로 검색</span><span><MessageCircle size={24} /> 거래방 자동 생성</span><span><Clock3 size={24} /> 실시간 진행 관리</span></section>
    <section className="marketing-final-cta"><p className="eyebrow">READY TO START</p><h2>다음 출고 지역의 시공점부터 찾아보세요.</h2><p className="final-cta-description">지역과 작업 조건에 맞는 시공점을 찾고, 견적 요청부터 거래까지 카마스터에서 이어가세요.</p><button className="button button-primary button-large" onClick={onStart}>카마스터 시작하기 <ArrowRight size={19} /></button></section>
    <footer className="marketing-footer"><div className="footer-brand"><img src="/carmaster-logo-transparent.png" alt="Car-Master" /><p>딜러와 시공점을 하나의 거래 흐름으로 연결합니다.</p><div className="footer-links"><a href="/terms">이용약관</a><span aria-hidden="true">|</span><a href="/privacy">개인정보처리방침</a></div></div><div className="footer-meta"><span><small>서비스</small>Car-Master Beta</span><span><small>문의</small>help@car-master.kr</span><span><small>Copyright</small>© 2026 Car-Master</span></div></footer>
  </main>;
}
