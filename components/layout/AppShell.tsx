/* eslint-disable @next/next/no-img-element */
import type { ReactNode } from "react";
import type { DemoAccount, Role, Screen } from "../../types/dealer";

const navigation: Record<Role, { screen: Screen; label: string; icon: string }[]> = {
  dealer: [
    { screen: "dealerDashboard", label: "대시보드", icon: "⌂" },
    { screen: "priceGuide", label: "가격 가이드", icon: "₩" },
    { screen: "request", label: "시공 요청", icon: "+" },
    { screen: "dealerMap", label: "시공점 찾기", icon: "⌖" },
    { screen: "deals", label: "거래 관리", icon: "▤" },
    { screen: "dealerProfile", label: "마이페이지", icon: "○" },
  ],
  shop: [
    { screen: "shopDashboard", label: "대시보드", icon: "⌂" },
    { screen: "shopRequests", label: "거래 관리", icon: "▤" },
    { screen: "dealerProfile", label: "시공점 정보", icon: "○" },
  ],
  admin: [{ screen: "ops", label: "운영 현황", icon: "▦" }],
};

const screenTitles: Partial<Record<Screen, string>> = {
  dealerDashboard: "대시보드", shopDashboard: "시공점 대시보드", priceGuide: "시공 가격 가이드", request: "새 시공 요청",
  requestSummary: "요청 최종 확인", dealerMap: "시공점 찾기", deals: "거래 관리", shopRequests: "거래 관리", dealerProfile: "마이페이지", ops: "운영 현황",
};

function isActive(screen: Screen, target: Screen) {
  return screen === target || target === "request" && screen === "requestSummary";
}

export function AppShell({ role, account, screen, onNavigate, onLogout, children }: { role: Role; account: DemoAccount; screen: Screen; onNavigate: (screen: Screen) => void; onLogout: () => void; children: ReactNode }) {
  const roleLabel = role === "dealer" ? "딜러" : role === "shop" ? "시공점" : "관리자";
  return <div className="app-frame">
    <aside className="app-sidebar">
      <button className="app-logo" onClick={() => onNavigate(navigation[role][0].screen)}><img src="/carmaster-logo-transparent.png" alt="Car-Master" /><small>{roleLabel} 워크스페이스</small></button>
      <div className="sidebar-section-label">업무 메뉴</div>
      <nav>{navigation[role].map((item) => <button key={item.screen} className={isActive(screen, item.screen) ? "active" : ""} onClick={() => onNavigate(item.screen)}><i aria-hidden="true">{item.icon}</i><span>{item.label}</span>{item.screen === "request" && <em>빠른 실행</em>}</button>)}</nav>
      <div className="sidebar-support"><b>도움이 필요하신가요?</b><span>베타 운영팀이 도와드립니다.</span><button onClick={() => alert("카마스터 베타 운영 문의: help@car-master.kr")}>운영팀 문의</button></div>
      <div className="sidebar-profile"><span>{account.name.slice(0, 1)}</span><div><b>{account.name}</b><small>{roleLabel} 계정</small></div><button onClick={onLogout}>로그아웃</button></div>
    </aside>
    <main className="app-main">
      <header className="app-topbar"><div className="topbar-title"><small>Car-Master</small><b>{screenTitles[screen] ?? "워크스페이스"}</b></div><div className="topbar-actions"><span className="service-status"><i /> 서비스 정상</span>{role === "dealer" && <button className="primary" onClick={() => onNavigate("request")}>+ 새 시공 요청</button>}<div className="topbar-account"><span>{account.name.slice(0, 1)}</span><div><b>{account.name}</b><small>v0.3.1 Beta</small></div></div></div></header>
      <div className="beta-environment-bar"><span>V0.3.1 BETA</span><p>현재 베타 운영 환경입니다. 거래 기록은 브라우저에 안전하게 저장됩니다.</p></div>
      {children}
    </main>
  </div>;
}
