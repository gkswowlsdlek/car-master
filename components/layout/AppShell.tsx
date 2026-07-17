/* eslint-disable @next/next/no-img-element */
import type { ReactNode } from "react";
import type { DemoAccount, Role, Screen } from "../../types/dealer";

const navigation: Record<Role, { screen: Screen; label: string }[]> = {
  dealer: [{ screen: "dealerDashboard", label: "대시보드" }, { screen: "priceGuide", label: "가격 가이드" }, { screen: "request", label: "시공 요청" }, { screen: "dealerMap", label: "시공점 찾기" }, { screen: "deals", label: "거래 관리" }, { screen: "dealerProfile", label: "마이페이지" }],
  shop: [{ screen: "shopRequests", label: "거래 관리" }, { screen: "dealerProfile", label: "마이페이지" }],
  admin: [{ screen: "ops", label: "관리자 현황" }],
};

export function AppShell({ role, account, screen, onNavigate, onLogout, children }: { role: Role; account: DemoAccount; screen: Screen; onNavigate: (screen: Screen) => void; onLogout: () => void; children: ReactNode }) {
  return <div className="app-frame"><aside className="app-sidebar"><button className="app-logo" onClick={() => onNavigate(navigation[role][0].screen)}><img src="/carmaster-logo-transparent.png" alt="Car-Master" /><small>{role.toUpperCase()} WORKSPACE</small></button><nav>{navigation[role].map((item) => <button key={item.screen} className={screen === item.screen || item.screen === "request" && screen === "requestSummary" ? "active" : ""} onClick={() => onNavigate(item.screen)}>{item.label}</button>)}</nav><div className="sidebar-profile"><span>{account.name.slice(0, 1)}</span><div><b>{account.name}</b><small>{role === "dealer" ? "딜러" : role === "shop" ? "시공점" : "관리자"}</small></div><button onClick={onLogout}>로그아웃</button></div></aside><main className="app-main"><header className="app-topbar"><div><b>{account.name}</b><span>Car-Master v0.3</span></div></header>{children}</main></div>;
}
