"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { calculateSettlement, formatWon } from "../lib/fees";
import { packages, shops, transactions } from "../lib/mock-data";

type Role = "dealer" | "shop" | "admin";
type Screen =
  | "landing" | "login" | "signup" | "dashboard" | "vehicle" | "search"
  | "shopDetail" | "packageDetail" | "request" | "transaction" | "payment"
  | "shopProfile" | "approval" | "participation" | "requests" | "settlement"
  | "shopApprovals" | "packages" | "fees" | "operations";

const roleLabel: Record<Role, string> = { dealer: "딜러", shop: "시공점", admin: "관리자" };
const statusSteps = ["요청 수락", "일정 합의", "결제 완료", "입고 완료", "시공 중", "시공 완료"];

export default function Home() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [role, setRole] = useState<Role>("dealer");
  const [selectedShop, setSelectedShop] = useState(shops[0]);
  const [selectedPackage, setSelectedPackage] = useState(packages[0]);
  const [requestSent, setRequestSent] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [scheduleAgreed, setScheduleAgreed] = useState(false);
  const [paid, setPaid] = useState(false);
  const [progress, setProgress] = useState(0);
  const [platformRate, setPlatformRate] = useState(3);
  const [pgRate, setPgRate] = useState(2.9);
  const [messages, setMessages] = useState([
    { who: "시스템", text: "거래 전용 메시지 공간이 열렸습니다." },
    { who: "부산 오토랩", text: "차량 입고 예상 범위를 확인했습니다. 7월 22일 오전 입고가 가능합니다." },
  ]);
  const [message, setMessage] = useState("");

  const fee = useMemo(
    () => calculateSettlement(selectedPackage.price, platformRate, pgRate),
    [selectedPackage, platformRate, pgRate],
  );

  const goDashboard = (nextRole = role) => { setRole(nextRole); setScreen("dashboard"); };
  const sendMessage = () => {
    if (!message.trim()) return;
    setMessages([...messages, { who: roleLabel[role], text: message.trim() }]);
    setMessage("");
  };

  if (screen === "landing") return <Landing onLogin={() => setScreen("login")} onSignup={() => setScreen("signup")} />;
  if (screen === "login") return <Auth mode="login" onBack={() => setScreen("landing")} onSubmit={goDashboard} />;
  if (screen === "signup") return <Auth mode="signup" onBack={() => setScreen("landing")} onSubmit={goDashboard} />;

  const nav = role === "dealer"
    ? [["dashboard", "대시보드"], ["vehicle", "차량 관리"], ["search", "시공점 찾기"], ["transaction", "거래 내역"]]
    : role === "shop"
      ? [["dashboard", "대시보드"], ["shopProfile", "시공점 정보"], ["participation", "패키지 참여"], ["requests", "시공 요청"], ["settlement", "정산"]]
      : [["dashboard", "대시보드"], ["shopApprovals", "시공점 승인"], ["packages", "패키지 관리"], ["fees", "이용료 설정"], ["operations", "거래·정산"]];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand brand-side" onClick={() => setScreen("landing")}><span>CM</span><b>Car-Master</b></button>
        <div className="workspace-label">{roleLabel[role]} 워크스페이스</div>
        <nav>{nav.map(([id, label]) => <button key={id} className={screen === id ? "active" : ""} onClick={() => setScreen(id as Screen)}><i />{label}</button>)}</nav>
        <div className="role-switch">
          <small>시연 역할 전환</small>
          <div>{(["dealer", "shop", "admin"] as Role[]).map(r => <button key={r} className={role === r ? "selected" : ""} onClick={() => goDashboard(r)}>{roleLabel[r]}</button>)}</div>
        </div>
        <button className="logout" onClick={() => setScreen("landing")}>로그아웃</button>
      </aside>
      <main className="main">
        <header className="topbar"><div><span className="mobile-brand">Car-Master</span></div><div className="user-chip"><span>{role === "dealer" ? "김도윤" : role === "shop" ? "부산 오토랩" : "운영 관리자"}</span><b>{roleLabel[role]}</b><i>{role === "dealer" ? "김" : role === "shop" ? "부" : "관"}</i></div></header>
        <div className="content">
          {screen === "dashboard" && <Dashboard role={role} onNavigate={setScreen} requestSent={requestSent} accepted={accepted} paid={paid} />}
          {screen === "vehicle" && <Vehicle />}
          {screen === "search" && <Search onSelect={(shop) => { setSelectedShop(shop); setScreen("shopDetail"); }} />}
          {screen === "shopDetail" && <ShopDetail shop={selectedShop} onPackage={(p) => { setSelectedPackage(p); setScreen("packageDetail"); }} />}
          {screen === "packageDetail" && <PackageDetail item={selectedPackage} shop={selectedShop} onRequest={() => setScreen("request")} />}
          {screen === "request" && <RequestForm item={selectedPackage} shop={selectedShop} onSend={() => { setRequestSent(true); setScreen("transaction"); }} />}
          {screen === "transaction" && <Transaction role={role} shop={selectedShop} item={selectedPackage} requestSent={requestSent} accepted={accepted} setAccepted={setAccepted} scheduleAgreed={scheduleAgreed} setScheduleAgreed={setScheduleAgreed} paid={paid} progress={progress} setProgress={setProgress} messages={messages} setMessages={setMessages} message={message} setMessage={setMessage} sendMessage={sendMessage} onPay={() => setScreen("payment")} fee={fee} />}
          {screen === "payment" && <Payment item={selectedPackage} onSuccess={() => { setPaid(true); setProgress(2); setScreen("transaction"); }} />}
          {screen === "shopProfile" && <ShopProfile />}
          {screen === "approval" && <Approval />}
          {screen === "participation" && <Participation />}
          {screen === "requests" && <Requests accepted={accepted} onOpen={() => setScreen("transaction")} />}
          {screen === "settlement" && <Settlement fee={fee} />}
          {screen === "shopApprovals" && <ShopApprovals />}
          {screen === "packages" && <PackageAdmin />}
          {screen === "fees" && <Fees platformRate={platformRate} pgRate={pgRate} setPlatformRate={setPlatformRate} setPgRate={setPgRate} fee={fee} />}
          {screen === "operations" && <Operations platformRate={platformRate} fee={fee} />}
        </div>
      </main>
    </div>
  );
}

function Landing({ onLogin, onSignup }: { onLogin: () => void; onSignup: () => void }) {
  return <div className="landing">
    <header className="landing-nav"><button className="brand"><span>CM</span><b>Car-Master</b></button><nav><a href="#service">서비스 소개</a><a href="#flow">이용 방법</a><a href="#partners">파트너 안내</a></nav><div><button className="text-btn" onClick={onLogin}>로그인</button><button className="primary small" onClick={onSignup}>무료로 시작하기</button></div></header>
    <main>
      <section className="hero"><div className="hero-copy"><p className="eyebrow">리스·렌트 딜러와 지역 시공점을 잇는 B2B 플랫폼</p><h1>전국 어디서든,<br/><em>믿을 수 있는 시공</em>을<br/>한 번에 연결하세요.</h1><p className="hero-desc">지역 시공점 검색부터 일정 조율, 결제와 정산까지.<br/>반복적인 중개 업무를 하나의 거래 흐름으로 바꿉니다.</p><div className="hero-actions"><button className="primary" onClick={onLogin}>딜러로 시연하기 <span>→</span></button><button className="secondary" onClick={onSignup}>파트너 시공점 등록</button></div><div className="trust"><b>10</b><span>등록 시공점</span><i/><b>3</b><span>표준 패키지</span><i/><b>48h</b><span>요청 응답 기준</span></div></div>
      <div className="hero-panel"><div className="panel-top"><span>부산광역시 해운대구</span><b>거리순</b></div><div className="map"><div className="road r1"/><div className="road r2"/><div className="road r3"/><span className="map-label l1">해운대구</span><span className="map-label l2">수영구</span><span className="map-label l3">동래구</span>{["1","2","3","4"].map((n,i)=><i key={n} className={`pin p${i+1}`}>{n}</i>)}</div><div className="floating-shop"><div className="shop-thumb">AUTO<br/>LAB</div><div><small>1.2km</small><b>부산 오토랩</b><span>버텍스 500 · 레이노 S9</span><strong>★ 4.9</strong></div><button>보기</button></div></div></section>
      <section className="metrics" id="service"><article><span>01</span><h3>지역 기반 시공점 검색</h3><p>고객의 차량 인도 지역을 기준으로 가까운 승인 시공점을 빠르게 찾습니다.</p></article><article><span>02</span><h3>표준 패키지로 간편 요청</h3><p>구성과 가격이 명확한 신차 패키지로 견적 확인과 요청을 단순화합니다.</p></article><article><span>03</span><h3>거래별 일정·상태 관리</h3><p>예상 입고 범위부터 시공 완료와 정산까지 한 화면에서 확인합니다.</p></article></section>
      <section className="flow-section" id="flow"><p className="eyebrow">CAR-MASTER WORKFLOW</p><h2>복잡했던 중개 업무를<br/>명확한 6단계로</h2><div className="flow-grid">{["지역 검색","패키지 선택","시공 요청","일정 조율","테스트 결제","시공·정산"].map((x,i)=><div key={x}><span>{String(i+1).padStart(2,"0")}</span><i>{["⌖","□","↗","◷","₩","✓"][i]}</i><b>{x}</b></div>)}</div></section>
      <section className="partner" id="partners"><div><p className="eyebrow">PARTNER NETWORK</p><h2>전국의 좋은 시공점과<br/>더 많은 거래 기회를 만듭니다.</h2><button className="primary" onClick={onSignup}>파트너 참여 알아보기 →</button></div><div className="partner-card"><span>이번 달 신규 요청</span><b>24건</b><small>전월 대비 +18%</small><div className="bar-chart">{[42,58,47,72,66,88,76].map((h,i)=><i key={i} style={{height:`${h}%`}} />)}</div></div></section>
    </main><footer><b>Car-Master</b><span>자동차 시공 거래를 더 단순하고 투명하게.</span><small>© 2026 Car-Master Prototype</small></footer>
  </div>;
}

function Auth({ mode, onBack, onSubmit }: { mode: "login"|"signup"; onBack:()=>void; onSubmit:(role:Role)=>void }) {
  const [picked, setPicked] = useState<Role>("dealer");
  return <div className="auth-page"><button className="brand auth-brand" onClick={onBack}><span>CM</span><b>Car-Master</b></button><div className="auth-card"><p className="eyebrow">CAR-MASTER</p><h1>{mode === "login" ? "다시 만나 반갑습니다" : "어떤 역할로 시작하시나요?"}</h1><p>{mode === "login" ? "시연할 역할을 선택하고 로그인하세요." : "가입 유형에 따라 필요한 정보를 안내해 드립니다."}</p><div className="role-cards">{(["dealer","shop","admin"] as Role[]).map(r=><button key={r} className={picked===r?"picked":""} onClick={()=>setPicked(r)}><i>{r==="dealer"?"D":r==="shop"?"S":"A"}</i><b>{roleLabel[r]}</b><span>{r==="dealer"?"시공점을 찾고 요청합니다":r==="shop"?"요청을 받고 시공합니다":"플랫폼을 운영합니다"}</span></button>)}</div><label>이메일<input defaultValue={picked === "admin" ? "admin@carmaster.kr" : picked === "shop" ? "shop@carmaster.kr" : "dealer@carmaster.kr"} /></label><label>비밀번호<input type="password" defaultValue="12345678" /></label><button className="primary full" onClick={()=>onSubmit(picked)}>{mode === "login" ? `${roleLabel[picked]}로 로그인` : "이메일 인증 후 시작"}</button><small className="demo-note">프로토타입에서는 입력값과 관계없이 바로 시연됩니다.</small></div></div>;
}

function PageHead({ eyebrow, title, desc, action }: { eyebrow?:string; title:string; desc?:string; action?:React.ReactNode }) { return <div className="page-head"><div>{eyebrow&&<p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{desc&&<p>{desc}</p>}</div>{action}</div>; }
function Stat({ label, value, note, tone="" }: {label:string;value:string;note:string;tone?:string}) { return <article className={`stat ${tone}`}><span>{label}</span><b>{value}</b><small>{note}</small></article>; }

function Dashboard({role,onNavigate,requestSent,accepted,paid}:{role:Role;onNavigate:(s:Screen)=>void;requestSent:boolean;accepted:boolean;paid:boolean}) {
  if(role==="dealer") return <><PageHead eyebrow="DEALER DASHBOARD" title="안녕하세요, 김도윤 딜러님" desc="진행 중인 거래와 필요한 다음 작업을 확인하세요." action={<button className="primary" onClick={()=>onNavigate("search")}>+ 새 시공 요청</button>}/><div className="stats"><Stat label="진행 중 거래" value={requestSent?"4":"3"} note="일정 조율 1건"/><Stat label="결제 대기" value={paid?"0":"1"} note="오늘 확인 필요" tone="accent"/><Stat label="이번 달 완료" value="8" note="총 4,820,000원"/><Stat label="평균 응답 시간" value="3.2h" note="최근 30일 기준"/></div><DemoBanner onClick={()=>onNavigate(requestSent?"transaction":"search")} text={requestSent?"부산 오토랩 거래의 다음 단계를 진행하세요":"부산 지역 시공점을 검색해 핵심 시연을 시작하세요"}/><TransactionTable rows={transactions.slice(0,5)} onOpen={()=>onNavigate("transaction")}/></>;
  if(role==="shop") return <><PageHead eyebrow="SHOP DASHBOARD" title="부산 오토랩 운영 현황" desc="신규 요청과 오늘의 시공 일정을 확인하세요." action={<button className="secondary" onClick={()=>onNavigate("approval")}>승인 상태: 승인</button>}/><div className="stats"><Stat label="신규 요청" value={requestSent&&!accepted?"2":"1"} note="48시간 내 응답" tone="accent"/><Stat label="오늘 입고" value="2" note="오전 1 · 오후 1"/><Stat label="시공 중" value="1" note="GV80 · 버텍스 500"/><Stat label="정산 예정" value="2,714,820원" note="완료 거래 5건"/></div><DemoBanner onClick={()=>onNavigate(requestSent?"requests":"participation")} text={requestSent?"김도윤 딜러의 신규 요청을 확인하세요":"표준 패키지 참여 현황을 확인하세요"}/><TransactionTable rows={transactions.slice(0,5)} onOpen={()=>onNavigate("transaction")}/></>;
  return <><PageHead eyebrow="ADMIN DASHBOARD" title="Car-Master 운영 센터" desc="승인 대기와 거래·결제·정산 현황을 한눈에 확인하세요."/><div className="stats"><Stat label="시공점 승인 대기" value="3" note="오늘 1건 신규" tone="accent"/><Stat label="진행 거래" value="18" note="분쟁 0건"/><Stat label="결제 완료" value="12" note="7,320,000원"/><Stat label="정산 대기" value="5" note="2,714,820원"/></div><div className="two-col"><section className="card"><h3>운영 바로가기</h3><div className="quick-grid"><button onClick={()=>onNavigate("shopApprovals")}><b>3</b><span>시공점 승인</span></button><button onClick={()=>onNavigate("packages")}><b>3</b><span>활성 패키지</span></button><button onClick={()=>onNavigate("fees")}><b>3%</b><span>테스트 이용료</span></button><button onClick={()=>onNavigate("operations")}><b>5</b><span>정산 대기</span></button></div></section><section className="card"><h3>거래 상태 분포</h3><div className="distribution">{[["요청·조율",30],["예약 확정",22],["시공 진행",28],["완료",20]].map(([x,v])=><div key={x}><span>{x}</span><i><b style={{width:`${v}%`}}/></i><strong>{v}%</strong></div>)}</div></section></div></>;
}

function DemoBanner({text,onClick}:{text:string;onClick:()=>void}) { return <button className="demo-banner" onClick={onClick}><span><b>핵심 시연 시나리오</b>{text}</span><strong>계속 진행 →</strong></button>; }
function TransactionTable({rows,onOpen}:{rows:typeof transactions;onOpen:()=>void}) { return <section className="card table-card"><div className="card-head"><h3>최근 거래</h3><button>전체 보기</button></div><div className="table"><div className="tr th"><span>거래번호</span><span>차량</span><span>시공점</span><span>패키지</span><span>상태</span><span>금액</span></div>{rows.map((t,i)=><button className="tr" key={t.id} onClick={i===0?onOpen:undefined}><span>{t.id}</span><span><b>{t.car}</b><small>{t.area}</small></span><span>{t.shop}</span><span>{t.package}</span><span><em className={`badge b${i%4}`}>{t.status}</em></span><span>{formatWon(t.price)}</span></button>)}</div></section>; }

function Vehicle(){return <><PageHead eyebrow="VEHICLE" title="차량 관리" desc="고객 개인정보 없이 시공에 필요한 차량 정보만 등록합니다." action={<button className="primary">+ 차량 등록</button>}/><div className="two-col"><section className="card form-card"><h3>새 차량 등록</h3><div className="form-grid"><label>제조사<select defaultValue="현대"><option>현대</option><option>기아</option><option>제네시스</option></select></label><label>모델<input defaultValue="그랜저 GN7"/></label><label>연식<select><option>2026</option><option>2025</option></select></label><label>차량번호 (선택)<input placeholder="예: 123가 4567"/></label><label className="wide">색상<input defaultValue="어비스 블랙 펄"/></label></div><button className="primary">저장하기</button></section><section className="card"><h3>최근 등록 차량</h3>{["제네시스 GV80","기아 카니발","현대 그랜저 GN7"].map((x,i)=><div className="vehicle-row" key={x}><i>{i+1}</i><span><b>{x}</b><small>{2026-i}년식 · 차량번호 {i?"미입력":"123가 4567"}</small></span><button>수정</button></div>)}</section></div></>}

function Search({onSelect}:{onSelect:(s:typeof shops[0])=>void}){return <><PageHead eyebrow="SHOP SEARCH" title="시공점 찾기" desc="고객 차량이 인도될 지역과 가까운 승인 시공점을 찾습니다."/><div className="searchbar"><input defaultValue="부산광역시"/><button className="primary">지역 검색</button><button className="filter">거리순⌄</button></div><div className="search-layout"><div className="shop-list"><p><b>부산광역시</b> 시공점 4곳</p>{shops.slice(0,4).map((s,i)=><button className={`shop-result ${i===0?"featured":""}`} key={s.id} onClick={()=>onSelect(s)}><div className="result-img">{s.initials}</div><div><small>{s.distance} · 관리자 승인</small><h3>{s.name}</h3><p>{s.address}</p><span>{s.services.slice(0,3).map(x=><em key={x}>{x}</em>)}</span></div><strong>★ {s.rating}</strong></button>)}</div><div className="mock-map"><span className="map-label l1">해운대구</span><span className="map-label l2">수영구</span><span className="map-label l3">동래구</span><div className="road r1"/><div className="road r2"/><div className="road r3"/>{[1,2,3,4].map((n,i)=><button key={n} className={`pin p${i+1}`}>{n}</button>)}</div></div></>}

function ShopDetail({shop,onPackage}:{shop:typeof shops[0];onPackage:(p:typeof packages[0])=>void}){return <><button className="back" onClick={()=>history.back()}>← 검색 결과</button><section className="shop-hero"><div className="result-img large">{shop.initials}</div><div><span className="verified">✓ 관리자 승인 시공점</span><h1>{shop.name}</h1><p>{shop.address} · {shop.distance}</p><div>{shop.services.map(x=><em key={x}>{x}</em>)}</div></div><div className="rating"><b>★ {shop.rating}</b><span>파트너 만족도</span></div></section><div className="two-col detail-cols"><section><div className="card"><h3>시공점 정보</h3><dl><div><dt>영업시간</dt><dd>평일 09:00~19:00 · 토요일 09:00~17:00</dd></div><div><dt>취급 필름</dt><dd>루마 버텍스, 레이노, 솔라가드</dd></div><div><dt>제공 서비스</dt><dd>신차검수, 틴팅, PPF, 유리막 코팅</dd></div></dl></div><div className="card"><h3>찾아오는 길</h3><div className="mini-map">부산광역시 해운대구 센텀중앙로 97 <i>CM</i></div></div></section><section className="card"><h3>참여 중인 표준 패키지</h3>{packages.map(p=><button className="package-row" key={p.id} onClick={()=>onPackage(p)}><span><small>표준 신차 패키지</small><b>{p.name}</b><em>{p.items.length}개 구성</em></span><strong>{formatWon(p.price)}<i>→</i></strong></button>)}</section></div></>}

function PackageDetail({item,shop,onRequest}:{item:typeof packages[0];shop:typeof shops[0];onRequest:()=>void}){return <><button className="back" onClick={()=>history.back()}>← {shop.name}</button><PageHead eyebrow="STANDARD PACKAGE" title={item.name} desc="관리자가 승인한 전국 공통 구성·단일 가격 패키지입니다."/><div className="package-detail"><section className="card"><span className="verified">✓ Car-Master 표준 패키지</span><h3>패키지 구성</h3>{item.items.map((x,i)=><div className="check-row" key={x}><i>✓</i><span><b>{x}</b><small>{i===0?"전면 및 측후면 기본 시공":"신차 인도 전 꼼꼼하게 진행"}</small></span></div>)}<div className="notice">표시 가격은 부가세가 포함된 금액이며, 시공점별 추가 금액이 없는 표준 가격입니다.</div></section><aside className="summary-card"><small>선택 시공점</small><b>{shop.name}</b><span>{shop.address}</span><hr/><small>패키지 금액</small><strong>{formatWon(item.price)}</strong><p>부가세 포함</p><button className="primary full" onClick={onRequest}>이 패키지로 요청하기</button></aside></div></>}

function RequestForm({item,shop,onSend}:{item:typeof packages[0];shop:typeof shops[0];onSend:()=>void}){return <><PageHead eyebrow="SERVICE REQUEST" title="시공 요청 정보 확인" desc="정확한 예약 시간이 아닌 예상 입고 범위를 먼저 전달합니다."/><div className="package-detail"><section className="card form-card"><h3>차량 및 일정</h3><label>차량<select><option>현대 그랜저 GN7 · 2026년식</option></select></label><div className="form-grid"><label>예상 입고 시작<input type="datetime-local" defaultValue="2026-07-21T09:00"/></label><label>예상 입고 종료<input type="datetime-local" defaultValue="2026-07-23T18:00"/></label></div><label>요청 메모<textarea defaultValue="부산 출고 예정 차량입니다. 정확한 일정은 출고 확정 후 조율 부탁드립니다."/></label><div className="notice">한 차량과 패키지는 한 시공점에만 순차 요청됩니다. 시공점 응답 기한은 48시간입니다.</div></section><aside className="summary-card"><small>시공점</small><b>{shop.name}</b><span>{shop.address}</span><hr/><small>패키지</small><b>{item.name}</b><strong>{formatWon(item.price)}</strong><button className="primary full" onClick={onSend}>시공 요청 보내기</button></aside></div></>}

function Transaction({role,shop,item,requestSent,accepted,setAccepted,scheduleAgreed,setScheduleAgreed,paid,progress,setProgress,messages,setMessages,message,setMessage,sendMessage,onPay,fee}:{role:Role;shop:typeof shops[0];item:typeof packages[0];requestSent:boolean;accepted:boolean;setAccepted:(x:boolean)=>void;scheduleAgreed:boolean;setScheduleAgreed:(x:boolean)=>void;paid:boolean;progress:number;setProgress:(x:number)=>void;messages:{who:string;text:string}[];setMessages:Dispatch<SetStateAction<{who:string;text:string}[]>>;message:string;setMessage:(x:string)=>void;sendMessage:()=>void;onPay:()=>void;fee:ReturnType<typeof calculateSettlement>}){
  const active = paid ? Math.max(progress,2) : scheduleAgreed ? 1 : accepted ? 0 : -1;
  return <><PageHead eyebrow="TRANSACTION CM-260713-001" title={requestSent?`${shop.name} 시공 거래`:"진행 중 거래"} desc={`${item.name} · 현대 그랜저 GN7`} action={<em className="badge b1">{paid?statusSteps[Math.min(progress,5)]:scheduleAgreed?"결제 대기":accepted?"일정 조율":"응답 대기"}</em>}/><div className="progress-track">{statusSteps.map((x,i)=><div className={i<=active?"done":""} key={x}><i>{i<active?"✓":i+1}</i><span>{x}</span></div>)}</div><div className="transaction-grid"><section className="card chat"><div className="card-head"><h3>거래 메시지</h3><span>텍스트 메시지 시연</span></div><div className="messages">{messages.map((m,i)=><div className={m.who===roleLabel[role]?"mine":m.who==="시스템"?"system":""} key={i}><small>{m.who}</small><p>{m.text}</p></div>)}{accepted&&<div className="schedule-proposal"><span>일정 제안</span><b>입고 2026.07.22 (수) 10:00</b><b>출고 2026.07.22 (수) 18:00</b>{role==="dealer"&&!scheduleAgreed&&<button className="primary" onClick={()=>setScheduleAgreed(true)}>이 일정에 동의</button>}{scheduleAgreed&&<em>✓ 딜러 일정 동의 완료</em>}</div>}</div><div className="message-input"><input value={message} onChange={e=>setMessage(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendMessage()} placeholder="메시지를 입력하세요"/><button onClick={sendMessage}>전송</button></div></section><aside><section className="card action-card"><h3>다음 작업</h3>{!accepted&&role==="shop"?<><p>요청 내용을 확인하고 응답해 주세요.</p><div><button className="secondary">거절</button><button className="primary" onClick={()=>setAccepted(true)}>요청 수락</button></div></>:!accepted?<p>시공점의 응답을 기다리고 있습니다.<br/><b>남은 시간 47:32:18</b></p>:accepted&&!scheduleAgreed&&role==="shop"?<><p>딜러에게 정확한 일정을 제안합니다.</p><input type="datetime-local" defaultValue="2026-07-22T10:00"/><button className="primary full" onClick={()=>setMessages([...messages,{who:"시스템",text:"시공점이 정확한 입고·출고 일정을 제안했습니다."}])}>일정 제안 보내기</button></>:scheduleAgreed&&!paid&&role==="dealer"?<><p>일정 동의가 완료되었습니다. 테스트 결제 후 예약이 확정됩니다.</p><button className="primary full" onClick={onPay}>테스트 결제 진행</button></>:paid&&role==="shop"&&progress<5?<><p>차량 진행 상태를 다음 단계로 변경합니다.</p><button className="primary full" onClick={()=>setProgress(Math.min(5,progress+1))}>{statusSteps[Math.min(5,progress+1)]}(으)로 변경</button></>:<p>{paid?"예약과 진행 상태를 실시간으로 확인하고 있습니다.":"일정 조율을 진행하세요."}</p>}</section><section className="card amount-card"><h3>거래 금액</h3><div><span>결제금액</span><b>{formatWon(fee.gross)}</b></div>{role!=="dealer"&&<><div><span>플랫폼 이용료</span><em>- {formatWon(fee.platformFee)}</em></div><div><span>테스트 PG 수수료</span><em>- {formatWon(fee.pgFee)}</em></div><hr/><div><strong>정산 예정액</strong><strong>{formatWon(fee.net)}</strong></div></>}</section></aside></div></>}

function Payment({item,onSuccess}:{item:typeof packages[0];onSuccess:()=>void}){const[failed,setFailed]=useState(false);return <><PageHead eyebrow="TEST PAYMENT" title="테스트 결제" desc="실제 카드정보나 결제는 사용되지 않습니다."/><div className="payment-card"><div className="test-label">TEST MODE</div><h3>{item.name}</h3><strong>{formatWon(item.price)}</strong><div className="fake-card"><span>CAR-MASTER TEST CARD</span><b>4242 4242 4242 4242</b><small>VALID 12/30</small></div>{failed&&<p className="error">테스트 결제에 실패했습니다. 성공 시나리오로 다시 시도해 주세요.</p>}<button className="primary full" onClick={onSuccess}>결제 성공 시뮬레이션</button><button className="secondary full" onClick={()=>setFailed(true)}>결제 실패 시뮬레이션</button></div></>}

function ShopProfile(){return <><PageHead eyebrow="SHOP PROFILE" title="시공점 정보 등록" desc="관리자 승인에 필요한 사업자·영업 정보를 입력합니다."/><section className="card form-card wide-card"><div className="form-grid"><label>상호명<input defaultValue="부산 오토랩"/></label><label>사업자등록번호<input defaultValue="123-45-67890"/></label><label>대표자명<input defaultValue="박정우"/></label><label>연락처<input defaultValue="051-123-4567"/></label><label className="wide">주소<input defaultValue="부산광역시 해운대구 센텀중앙로 97"/></label><label>영업 시작<input type="time" defaultValue="09:00"/></label><label>영업 종료<input type="time" defaultValue="19:00"/></label><label className="wide">취급 필름 및 서비스<input defaultValue="루마 버텍스, 레이노, 신차검수, PPF, 코팅"/></label></div><div className="fake-upload">사업자등록증.pdf <span>샘플 파일 · 실제 업로드 제외</span></div><button className="primary">승인 요청 정보 저장</button></section></>}
function Approval(){return <><PageHead eyebrow="APPROVAL" title="가입 승인 상태"/><section className="approval-card"><i>✓</i><h2>관리자 승인이 완료되었습니다</h2><p>부산 오토랩은 Car-Master 승인 파트너로 활동 중입니다.</p><div><span>승인일</span><b>2026.07.10</b></div><div><span>노출 상태</span><b>검색 결과 노출 중</b></div></section></>}
function Participation(){return <><PageHead eyebrow="PACKAGE PARTICIPATION" title="표준 패키지 참여" desc="수행 가능한 전국 공통 패키지에 참여 신청하세요."/ ><div className="package-admin-grid">{packages.map((p,i)=><section className="card" key={p.id}><span className={`badge b${i}`}>{i<2?"참여 승인":"신청 가능"}</span><h3>{p.name}</h3><strong>{formatWon(p.price)}</strong><ul>{p.items.slice(0,3).map(x=><li key={x}>✓ {x}</li>)}</ul><button className={i<2?"secondary full":"primary full"}>{i<2?"참여 중":"참여 신청"}</button></section>)}</div></>}
function Requests({accepted,onOpen}:{accepted:boolean;onOpen:()=>void}){return <><PageHead eyebrow="SERVICE REQUESTS" title="시공 요청" desc="48시간 내 수락 또는 거절해 주세요."/><section className="card request-card"><div><em className="badge b1">{accepted?"수락 완료":"신규 요청"}</em><h3>현대 그랜저 GN7 · {packages[0].name}</h3><p>부산광역시 · 예상 입고 2026.07.21 09:00 ~ 07.23 18:00</p></div><span><small>패키지 금액</small><b>{formatWon(packages[0].price)}</b></span><button className="primary" onClick={onOpen}>{accepted?"거래 보기":"요청 확인"}</button></section></>}
function Settlement({fee}:{fee:ReturnType<typeof calculateSettlement>}){return <><PageHead eyebrow="SETTLEMENT" title="정산 예정 내역" desc="실제 송금은 플랫폼 밖에서 처리되며 관리자가 지급 상태만 기록합니다."/><div className="stats"><Stat label="정산 예정" value={formatWon(fee.net)} note="1건" tone="accent"/><Stat label="정산 대기" value="1,822,140원" note="3건"/><Stat label="이번 달 지급 완료" value="4,280,000원" note="8건"/></div><section className="card"><div className="settlement-row head"><span>거래</span><span>결제금액</span><span>플랫폼 이용료</span><span>PG 수수료</span><span>정산 예정액</span><span>상태</span></div><div className="settlement-row"><span>CM-260713-001</span><span>{formatWon(fee.gross)}</span><span>- {formatWon(fee.platformFee)}</span><span>- {formatWon(fee.pgFee)}</span><strong>{formatWon(fee.net)}</strong><em className="badge b1">정산 예정</em></div></section></>}
function ShopApprovals(){const[done,setDone]=useState<number[]>([]);return <><PageHead eyebrow="SHOP APPROVAL" title="시공점 가입 승인" desc="사업자 정보와 서비스를 확인하고 승인합니다."/><section className="card">{shops.slice(4,7).map((s,i)=><div className="approval-row" key={s.id}><div className="result-img">{s.initials}</div><span><b>{s.name}</b><small>{s.address} · 사업자등록증 확인</small></span>{done.includes(i)?<em className="badge b2">승인 완료</em>:<div><button className="secondary">반려</button><button className="primary" onClick={()=>setDone([...done,i])}>승인</button></div>}</div>)}</section></>}
function PackageAdmin(){return <><PageHead eyebrow="PACKAGE ADMIN" title="표준 패키지 관리" desc="전국 공통 구성과 부가세 포함 단일 가격을 관리합니다." action={<button className="primary">+ 패키지 등록</button>}/><div className="package-admin-grid">{packages.map(p=><section className="card" key={p.id}><span className="verified">활성</span><h3>{p.name}</h3><strong>{formatWon(p.price)}</strong><p>{p.items.join(" · ")}</p><button className="secondary full">구성·가격 수정</button></section>)}</div></>}
function Fees({platformRate,pgRate,setPlatformRate,setPgRate,fee}:{platformRate:number;pgRate:number;setPlatformRate:(n:number)=>void;setPgRate:(n:number)=>void;fee:ReturnType<typeof calculateSettlement>}){return <><PageHead eyebrow="FEE SETTINGS" title="이용료 설정" desc="변경값은 이 프로토타입의 정산 예정액에 즉시 반영됩니다."/><div className="two-col"><section className="card form-card"><h3>테스트 수수료 정책</h3><label>플랫폼 이용료율 (%)<input type="number" step="0.1" value={platformRate} onChange={e=>setPlatformRate(Number(e.target.value))}/><small>기본 3%는 사업 확정 요율이 아닌 테스트 값입니다.</small></label><label>테스트 PG 수수료율 (%)<input type="number" step="0.1" value={pgRate} onChange={e=>setPgRate(Number(e.target.value))}/></label><button className="primary">설정 저장</button></section><section className="card fee-preview"><h3>정산 계산 미리보기</h3><div><span>결제금액</span><b>{formatWon(fee.gross)}</b></div><div><span>플랫폼 이용료 ({platformRate}%)</span><em>- {formatWon(fee.platformFee)}</em></div><div><span>PG 수수료 ({pgRate}%)</span><em>- {formatWon(fee.pgFee)}</em></div><hr/><div><strong>시공점 정산 예정액</strong><strong>{formatWon(fee.net)}</strong></div><small>모든 수수료는 원 단위 반올림합니다.</small></section></div></>}
function Operations({platformRate,fee}:{platformRate:number;fee:ReturnType<typeof calculateSettlement>}){return <><PageHead eyebrow="OPERATIONS" title="거래·결제·정산" desc="프로토타입 전체 운영 현황입니다."/><div className="tabbar"><button className="active">전체 거래 10</button><button>결제 완료 6</button><button>정산 대기 5</button></div><TransactionTable rows={transactions} onOpen={()=>{}}/><section className="card operation-summary"><span>현재 테스트 이용료율 <b>{platformRate}%</b></span><span>대표 거래 정산 예정액 <b>{formatWon(fee.net)}</b></span><button className="primary">지급 완료로 표시</button></section></>}
