"use client";
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import type { ReactNode } from "react";
import { Bell, Building2, CircleDollarSign, Gauge, HelpCircle, LogOut, MapPin, MoreHorizontal, Plus, Settings2, UserRound, UsersRound, X, type LucideIcon } from "lucide-react";
import type { DemoAccount, Role, Screen } from "../../types/dealer";

const navigation: Record<Role, { screen: Screen; label: string; icon: LucideIcon }[]> = {
  dealer: [
    { screen: "dealerDashboard", label: "대시보드", icon: Gauge },
    { screen: "priceGuide", label: "권장 시공 패키지", icon: CircleDollarSign },
    { screen: "request", label: "시공 요청", icon: Plus },
    { screen: "dealerMap", label: "시공점 찾기", icon: MapPin },
    { screen: "deals", label: "거래 관리", icon: Building2 },
    { screen: "dealerProfile", label: "마이페이지", icon: UserRound },
  ],
  shop: [
    { screen: "shopDashboard", label: "홈", icon: Gauge },
    { screen: "shopRequests", label: "거래방", icon: Building2 },
    { screen: "dealerProfile", label: "시공점 관리", icon: Settings2 },
  ],
  admin: [{ screen: "ops", label: "운영 현황", icon: UsersRound }],
};

const screenTitles: Partial<Record<Screen, string>> = {
  dealerDashboard: "대시보드", shopDashboard: "시공점 대시보드", priceGuide: "권장 시공 패키지 가이드", request: "새 시공 요청",
  requestSummary: "요청 최종 확인", dealerMap: "시공점 찾기", deals: "거래 관리", shopRequests: "거래 관리", dealerProfile: "마이페이지", ops: "운영 현황",
};

const MOBILE_PRIMARY_COUNT = 4;

function isActive(screen: Screen, target: Screen) {
  return screen === target || target === "request" && screen === "requestSummary";
}

export function AppShell({ role, account, screen, onNavigate, onLogout, children }: { role: Role; account: DemoAccount; screen: Screen; onNavigate: (screen: Screen) => void; onLogout: () => void; children: ReactNode }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const roleLabel = role === "dealer" ? "딜러" : role === "shop" ? "시공점" : "관리자";
  const items = navigation[role];
  const overflow = items.length > MOBILE_PRIMARY_COUNT ? items.slice(MOBILE_PRIMARY_COUNT) : [];
  const primary = overflow.length > 0 ? items.slice(0, MOBILE_PRIMARY_COUNT) : items;
  const overflowActive = overflow.some((item) => isActive(screen, item.screen));
  const go = (target: Screen) => { setMoreOpen(false); onNavigate(target); };

  return <div className="app-frame">
    <aside className="app-sidebar">
      <button className="app-logo" onClick={() => onNavigate(navigation[role][0].screen)}><img src="/carmaster-logo-transparent.png" alt="Car-Master" /><small>{roleLabel} 워크스페이스</small></button>
      <div className="sidebar-section-label">업무 메뉴</div>
      <nav>{items.map((item) => <button key={item.screen} className={isActive(screen, item.screen) ? "active" : ""} onClick={() => onNavigate(item.screen)}><i aria-hidden="true"><item.icon size={18} strokeWidth={2} /></i><span>{item.label}</span>{item.screen === "request" && <em>빠른 실행</em>}</button>)}</nav>
      <div className="sidebar-support"><HelpCircle size={19} /><b>도움이 필요하신가요?</b><span>베타 운영팀이 도와드립니다.</span><button onClick={() => alert("카마스터 베타 운영 문의: help@car-master.kr")}>운영팀 문의</button></div>
      <div className="sidebar-profile"><span>{account.name.slice(0, 1)}</span><div><b>{account.name}</b><small>{roleLabel} 계정</small></div><button onClick={onLogout} aria-label="로그아웃"><LogOut size={16} /></button></div>
    </aside>
    <main className="app-main">
      <header className="app-topbar"><div className="topbar-title"><small>Car-Master</small><b>{screenTitles[screen] ?? "워크스페이스"}</b></div><div className="topbar-actions"><span className="service-status"><i /> 서비스 정상</span><button className="topbar-icon-button" aria-label="알림"><Bell size={18} /></button>{role === "dealer" && <button className="primary" onClick={() => onNavigate("request")}><Plus size={17} /> 새 시공 요청</button>}<button className="mobile-logout-button" onClick={onLogout} aria-label="로그아웃"><LogOut size={18} /><span>로그아웃</span></button><div className="topbar-account"><span>{account.name.slice(0, 1)}</span><div><b>{account.name}</b><small>v0.3.5</small></div></div></div></header>
      <div className="beta-environment-bar"><span>WORKSPACE</span><p>회원과 거래를 안전하게 연결하는 카마스터 업무공간입니다.</p></div>
      {children}
    </main>

    <nav className="app-mobile-nav" aria-label="주요 메뉴">
      {primary.map((item) => <button key={item.screen} className={isActive(screen, item.screen) ? "active" : ""} onClick={() => go(item.screen)}><item.icon size={20} strokeWidth={2} aria-hidden="true" /><span>{item.label}</span></button>)}
      {overflow.length > 0 && <button className={overflowActive ? "active" : ""} onClick={() => setMoreOpen(true)} aria-haspopup="true" aria-expanded={moreOpen}><MoreHorizontal size={20} aria-hidden="true" /><span>더보기</span></button>}
    </nav>
    {moreOpen && <div className="app-mobile-more" role="dialog" aria-modal="true" aria-label="더보기 메뉴">
      <button className="app-mobile-more-backdrop" onClick={() => setMoreOpen(false)} aria-label="닫기" />
      <div className="app-mobile-more-sheet">
        <div className="app-mobile-more-head"><b>더보기</b><button onClick={() => setMoreOpen(false)} aria-label="닫기"><X size={18} /></button></div>
        <div className="app-mobile-more-grid">
          {overflow.map((item) => <button key={item.screen} className={isActive(screen, item.screen) ? "active" : ""} onClick={() => go(item.screen)}><item.icon size={20} strokeWidth={2} aria-hidden="true" /><span>{item.label}</span></button>)}
          <button onClick={() => { setMoreOpen(false); onLogout(); }}><LogOut size={20} aria-hidden="true" /><span>로그아웃</span></button>
        </div>
      </div>
    </div>}
  </div>;
}
