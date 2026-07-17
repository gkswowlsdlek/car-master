import Link from "next/link";

export default function NotFound() {
  return <main className="system-state-page"><section><div className="system-state-icon">404</div><p className="eyebrow">PAGE NOT FOUND</p><h1>요청하신 화면을 찾을 수 없습니다.</h1><p>주소가 변경됐거나 접근할 수 없는 업무 화면입니다.</p><Link className="button button-primary" href="/">카마스터 홈으로</Link></section></main>;
}
