/* eslint-disable @next/next/no-img-element */
import type { ReactNode } from "react";
import { Bell, Building2, CircleDollarSign, Gauge, LogOut, MapPin, Plus, Settings2, UserRound, UsersRound, type LucideIcon } from "lucide-react";
import type { DemoAccount, Role, Screen } from "../../types/dealer";

const navigation: Record<Role, { screen: Screen; label: string; icon: LucideIcon }[]> = {
  dealer: [
    { screen: "dealerDashboard", label: "홈", icon: Gauge },
    { screen: "priceGuide", label: "권장 패키지", icon: CircleDollarSign },
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
  dealerDashboard: "홈", shopDashboard: "홈", priceGuide: "권장 시공 패키지", request: "새 시공 요청",
  requestSummary: "요청 최종 확인", dealerMap: "시공점 찾기", deals: "거래 관리", shopRequests: "거래 관리", dealerProfile: "마이페이지", ops: "운영 현황",
};

function isActive(screen: Screen, target: Screen) {
  return screen === target || target === "request" && screen === "requestSummary";
}

export function AppShell({ role, account, screen, onNavigate, onLogout, children }: { role: Role; account: DemoAccount; screen: Screen; onNavigate: (screen: Screen) => void; onLogout: () => void; children: ReactNode }) {
  const roleLabel = role === "dealer" ? "딜러" : role === "shop" ? "시공점" : "관리자";
  return <div className="hub">
    <aside className="hub-rail">
      <button className="hub-mark" onClick={() => onNavigate(navigation[role][0].screen)} aria-label="홈으로">
        <img src="/carmaster-logo-transparent.png" alt="Car-Master" />
      </button>
      <nav className="hub-nav">{navigation[role].map((item) => <button key={item.screen} className={isActive(screen, item.screen) ? "active" : ""} onClick={() => onNavigate(item.screen)}>
        <item.icon size={18} strokeWidth={1.9} aria-hidden="true" />
        <span>{item.label}</span>
      </button>)}</nav>
      <div className="hub-rail-foot">
        <button className="hub-person" onClick={() => onNavigate("dealerProfile")}>
          <span>{account.name.slice(0, 1)}</span>
          <em><b>{account.name}</b><small>{roleLabel}</small></em>
        </button>
        <button className="hub-logout" onClick={onLogout} aria-label="로그아웃"><LogOut size={16} /></button>
      </div>
    </aside>
    <nav className="hub-tabbar" aria-label="주요 메뉴">{navigation[role].map((item) => <button key={item.screen} className={isActive(screen, item.screen) ? "active" : ""} onClick={() => onNavigate(item.screen)}>
      <item.icon size={20} strokeWidth={1.9} aria-hidden="true" />
      <span>{item.label}</span>
    </button>)}</nav>
    <div className="hub-body">
      <header className="hub-topline">
        <b>{screenTitles[screen] ?? "워크스페이스"}</b>
        <div className="hub-topline-actions">
          <span className="hub-live"><i aria-hidden="true" /> 서비스 정상</span>
          <button className="hub-icon-button" aria-label="알림"><Bell size={17} /></button>
          {role === "dealer" && <button className="primary" onClick={() => onNavigate("request")}><Plus size={16} /> 새 시공 요청</button>}
        </div>
      </header>
      <main className="hub-main">{children}</main>
    </div>
  </div>;
}
