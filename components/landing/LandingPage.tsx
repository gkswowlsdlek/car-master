/* eslint-disable @next/next/no-img-element */
import { ArrowRight, Building2, CalendarClock, MessageCircle, ShieldCheck, Sparkles, Timer, Wallet, Wrench } from "lucide-react";

const flow = [
  { label: "접수", note: "딜러가 요청" },
  { label: "견적", note: "패키지 확인" },
  { label: "예약", note: "일정 조율" },
  { label: "입고", note: "차량 도착" },
  { label: "시공", note: "작업 진행" },
  { label: "완료", note: "정산까지" },
];

const values = [
  { icon: Timer, title: "속도", body: "시공 요청부터 첫 응답까지, 기다리지 않아도 됩니다." },
  { icon: ShieldCheck, title: "신뢰", body: "관리자가 승인한 시공점만 연결됩니다." },
  { icon: Building2, title: "기록", body: "견적, 대화, 결제 — 거래별로 자동 정리됩니다." },
];

export function LandingPage({ onStart, onPriceGuide }: { onStart: () => void; onPriceGuide: () => void }) {
  return <main className="lp">
    <nav className="lp-nav">
      <span className="lp-nav-brand"><img src="/carmaster-logo-transparent.png" alt="Car-Master" /></span>
      <div className="lp-nav-links">
        <button className="button-ghost" onClick={onPriceGuide}>권장 패키지</button>
        <button className="primary" onClick={onStart}>로그인</button>
      </div>
    </nav>

    <section className="lp-hero">
      <p className="lp-kicker"><Sparkles size={14} /> DEALER × INSTALLER WORKSPACE</p>
      <h1>딜러와 시공점의 거래를,<br />하나의 흐름으로.</h1>
      <p className="lp-hero-sub">견적부터 시공 완료까지 — 흩어진 연락과 서류 대신, <br className="lp-only-desktop" />카마스터 안에서 한 번에 관리하세요.</p>
      <div className="lp-hero-cta">
        <button className="primary button-large" onClick={onStart}>무료로 시작하기 <ArrowRight size={18} /></button>
        <button className="button-secondary button-large" onClick={onPriceGuide}>권장 패키지 보기</button>
      </div>
    </section>

    <section className="lp-values">
      {values.map((item) => <div className="lp-value" key={item.title}>
        <item.icon size={22} strokeWidth={1.8} aria-hidden="true" />
        <div><b>{item.title}</b><p>{item.body}</p></div>
      </div>)}
    </section>

    <section className="lp-flow">
      <div className="lp-flow-head"><p className="eyebrow">ONE TRANSACTION FLOW</p><h2>요청 한 번으로, 완료까지 한 번에.</h2></div>
      <ol className="lp-flow-steps">
        {flow.map((step, index) => <li key={step.label}>
          <span className="lp-flow-index">{index + 1}</span>
          <b>{step.label}</b>
          <small>{step.note}</small>
        </li>)}
      </ol>
    </section>

    <section className="lp-benefits">
      <article className="lp-benefit">
        <p className="eyebrow">FOR DEALERS</p>
        <h2>가격 확인부터<br />거래 요청까지, 3분.</h2>
        <ul>
          <li>브랜드별 권장 시공 가격을 바로 확인</li>
          <li>가까운 시공점을 거리순으로 탐색</li>
          <li>요청 즉시 전용 거래방이 열립니다</li>
        </ul>
        <button className="secondary" onClick={onStart}>딜러로 시작하기 <ArrowRight size={16} /></button>
      </article>
      <article className="lp-benefit lp-benefit-alt">
        <p className="eyebrow">FOR INSTALLERS</p>
        <h2>오늘 처리할 작업만,<br />놓치지 않게.</h2>
        <ul>
          <li>새 요청과 지연 작업이 항상 먼저 보입니다</li>
          <li>일정·채팅·첨부파일을 거래방 하나로</li>
          <li>완료 처리와 정산까지 이어서 관리</li>
        </ul>
        <button className="secondary" onClick={onStart}>시공점으로 시작하기 <ArrowRight size={16} /></button>
      </article>
    </section>

    <section className="lp-preview">
      <div className="lp-preview-copy">
        <p className="eyebrow">REAL WORKSPACE</p>
        <h2>실제로 이렇게 씁니다.</h2>
        <p>지금 처리해야 할 일을 가장 먼저 보여주고, <br className="lp-only-desktop" />거래방 안에서 대화와 첨부파일까지 이어집니다.</p>
      </div>
      <div className="lp-preview-panel" aria-hidden="true">
        <div className="lp-preview-queue">
          <div className="lp-preview-queue-row urgent"><CalendarClock size={15} /><span>BMW X5 · PPF 패키지</span><em>응답 대기</em></div>
          <div className="lp-preview-queue-row"><Wrench size={15} /><span>Tesla Model Y · 썬팅</span><em>시공중</em></div>
          <div className="lp-preview-queue-row done"><Wallet size={15} /><span>Genesis GV80 · 정산완료</span><em>완료</em></div>
        </div>
        <div className="lp-preview-thread">
          <div className="lp-preview-bubble theirs"><MessageCircle size={13} /> 오늘 오후 2시 입고 가능할까요?</div>
          <div className="lp-preview-bubble mine">네, 2시로 확정할게요.</div>
        </div>
      </div>
    </section>

    <section className="lp-cta">
      <p className="eyebrow">READY TO START</p>
      <h2>첫 시공 요청, 지금 시작해 보세요.</h2>
      <button className="primary button-large" onClick={onStart}>카마스터 시작하기 <ArrowRight size={19} /></button>
    </section>

    <footer className="lp-footer">
      <img src="/carmaster-logo-transparent.png" alt="Car-Master" />
      <div><span>서비스</span>Car-Master</div>
      <div><span>문의</span>help@car-master.kr</div>
      <div><span>Copyright</span>© 2026 Car-Master</div>
    </footer>
  </main>;
}
