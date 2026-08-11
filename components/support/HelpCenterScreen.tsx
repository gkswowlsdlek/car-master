import Link from "next/link";
import { ArrowLeft, BookOpen, ChevronRight, CircleHelp, MessageCircle, ShieldCheck } from "lucide-react";

const dealerFaq = [
  ["작업 등록은 어떻게 하나요?", "시공점을 찾은 뒤 견적 요청을 작성하면 거래방이 바로 열립니다."],
  ["가까운 시공점을 찾고 싶어요.", "시공점 찾기에서 지역과 작업 정보를 입력해 조건에 맞는 업체를 확인하세요."],
  ["거래 진행 상황은 어디서 보나요?", "거래 관리와 메시지에서 요청, 상담, 진행 상태를 한 번에 확인할 수 있습니다."],
  ["작업을 취소할 수 있나요?", "상담 중인 거래방에서 시공점과 먼저 일정을 조율해 주세요."],
  ["로그인이 되지 않아요.", "가입한 이메일을 확인하고 비밀번호 재설정을 이용해 주세요."],
];
const shopFaq = [
  ["시공점 승인은 얼마나 걸리나요?", "가입 신청 후 운영팀 확인이 끝나면 이용할 수 있습니다."],
  ["새 요청은 어디서 확인하나요?", "거래 관리와 메시지에서 들어온 요청과 상담 내용을 확인하세요."],
  ["진행 상태를 바꾸고 싶어요.", "거래 상세 화면에서 현재 작업 단계에 맞는 다음 상태를 선택할 수 있습니다."],
  ["Shop Claim이 무엇인가요?", "운영팀의 확인을 거쳐 기존 업체 정보를 내 계정과 연결하는 절차입니다."],
  ["계정 정보를 수정할 수 있나요?", "시공점 관리에서 고객에게 보이는 업체 정보와 요청 수신 설정을 관리하세요."],
];

export function HelpCenterScreen({ role = "dealer" }: { role?: "dealer" | "shop" }) {
  const items = role === "shop" ? shopFaq : dealerFaq;
  return <main className="help-page"><div className="help-shell">
    <Link className="help-back" href="/"><ArrowLeft size={16} /> 워크스페이스로 돌아가기</Link>
    <header className="help-hero"><div className="help-hero-icon"><CircleHelp size={28} /></div><p className="eyebrow">CAR-MASTER HELP CENTER</p><h1>무엇을 도와드릴까요?</h1><p>거래와 시공 업무를 더 쉽게 시작할 수 있도록 필요한 안내를 모았습니다.</p></header>
    <section className="help-quick-grid"><Link href="/help?section=faq"><BookOpen size={20} /><span><b>자주 찾는 도움말</b><small>처음 이용할 때 필요한 안내</small></span><ChevronRight size={17} /></Link><div className="help-quick-disabled"><MessageCircle size={20} /><span><b>문의 채널 준비 중</b><small>문의 접수 채널을 준비하고 있습니다.</small></span></div><Link href="/terms"><ShieldCheck size={20} /><span><b>서비스 이용 안내</b><small>약관과 개인정보처리방침</small></span><ChevronRight size={17} /></Link></section>
    <section className="help-section"><div className="help-section-head"><div><p className="eyebrow">FAQ</p><h2>{role === "shop" ? "시공점 이용 안내" : "딜러 이용 안내"}</h2></div><span className="help-role-badge">{role === "shop" ? "시공점" : "딜러"}</span></div><div className="help-faq-list">{items.map(([question, answer]) => <details key={question}><summary>{question}<ChevronRight size={17} /></summary><p>{answer}</p></details>)}</div></section>
    <section className="help-contact"><div><b>원하는 답을 찾지 못하셨나요?</b><p>문의 접수 채널을 준비하고 있습니다. 서비스 이용 안내를 먼저 확인해 주세요.</p></div><Link className="secondary" href="/terms">이용 안내 보기</Link></section>
  </div></main>;
}
