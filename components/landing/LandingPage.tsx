/* eslint-disable @next/next/no-img-element */

const workflow = ["가격 확인", "시공 요청", "시공점 선택", "거래방", "채팅", "결제", "완료"];
const steps = [
  { number: "01", title: "가격 확인", description: "브랜드와 차량 등급에 맞는 가이드 가격을 먼저 확인합니다." },
  { number: "02", title: "시공점 선택", description: "거리, 평점, 응답속도를 비교해 적합한 시공점을 선택합니다." },
  { number: "03", title: "거래방 생성", description: "요청과 동시에 거래별 작업 정보와 채팅방이 만들어집니다." },
  { number: "04", title: "시공 완료", description: "입고부터 시공, 결제까지 하나의 흐름에서 마무리합니다." },
];

export function LandingPage({ onStart, onPriceGuide }: { onStart: () => void; onPriceGuide: () => void }) {
  return <main className="marketing-page">
    <nav className="marketing-nav"><div className="marketing-brand"><img src="/carmaster-logo-transparent.png" alt="Car-Master" /></div><div><button className="button button-ghost" onClick={onPriceGuide}>가격 가이드</button><button className="button button-primary" onClick={onStart}>로그인</button></div></nav>
    <section className="marketing-hero"><p className="eyebrow">DEALER INSTALLATION WORKSPACE</p><h1>차량 시공 업무를<br />하나의 거래 흐름으로.</h1><p className="page-subtitle">흩어진 연락과 파일 대신, 가격 확인부터 시공 완료까지.<br />카마스터가 딜러의 시공 업무를 선명하게 정리합니다.</p><div className="marketing-cta"><button className="button button-primary button-large" onClick={onStart}>카마스터 시작하기</button><button className="button button-secondary button-large" onClick={onPriceGuide}>가격 가이드 보기</button></div></section>
    <section className="workflow-story"><div className="workflow-story-copy"><p className="eyebrow">ONE TRANSACTION FLOW</p><h2>카카오톡, 전화, 엑셀로<br />흩어진 업무를 한곳으로.</h2><p>요청 내용이 사라지거나 일정과 금액을 다시 확인하는 반복을 줄입니다. 모든 기록은 거래방에 남고, 다음 할 일이 분명해집니다.</p></div><ol>{workflow.map((item, index) => <li key={item}><span>{String(index + 1).padStart(2, "0")}</span><b>{item}</b></li>)}</ol></section>
    <section className="trust-strip"><span>등록 시공점 100+</span><span>거래별 독립 작업 브리핑</span><span>행정구역 기준 거리 검색</span></section>
    <section className="service-steps"><div className="service-steps-heading"><p className="eyebrow">HOW IT WORKS</p><h2>시공 업무, 네 단계면 충분합니다.</h2><p>처음 사용하는 딜러도 다음 행동을 바로 이해할 수 있습니다.</p></div><div>{steps.map((step) => <article className="card" key={step.number}><span>STEP {step.number}</span><h3>{step.title}</h3><p>{step.description}</p></article>)}</div></section>
    <section className="marketing-final-cta"><p className="eyebrow">READY TO START</p><h2>첫 시공 요청부터 더 간결하게.</h2><button className="button button-primary button-large" onClick={onStart}>카마스터 시작하기</button></section>
  </main>;
}
