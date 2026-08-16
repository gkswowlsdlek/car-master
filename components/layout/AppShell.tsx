"use client";
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import type { ReactNode } from "react";
import { ArrowLeft, Bell, Building2, Gauge, HelpCircle, LogOut, MapPin, Menu, MessageCircle, MoreHorizontal, Plus, Settings2, UserRound, UsersRound, X, type LucideIcon } from "lucide-react";
import type { DemoAccount, Role, Screen } from "../../types/dealer";

// Dealer's own core flow (North Star: "가까운 시공점 찾기" first) drives the
// order here — 홈/시공점찾기/거래관리/메시지 are the 4 items MOBILE_PRIMARY_COUNT
// keeps on the mobile bottom nav without overflow. "시공 요청" is deliberately
// NOT a nav destination — the product flow is Shop 먼저 찾기 → 선택 → 요청, so
// it stays only as a strong CTA on the Dashboard (and the existing topbar
// quick-action button), never a sidebar/bottom-nav item. 마이페이지/권장 시공
// 패키지 are real, unremoved routes — kept at the tail so they still surface
// in the sidebar and in mobile's "더보기" sheet.
const navigation: Record<Role, { screen?: Screen; href?: string; label: string; icon: LucideIcon }[]> = {
  dealer: [
    { screen: "dealerDashboard", label: "대시보드", icon: Gauge },
    { screen: "dealerMap", label: "시공점 찾기", icon: MapPin },
    { screen: "deals", label: "거래 관리", icon: Building2 },
    { screen: "messages", label: "메시지", icon: MessageCircle },
    { screen: "dealerHelp", label: "고객센터", icon: HelpCircle },
    { screen: "dealerProfile", label: "마이페이지", icon: UserRound },
  ],
  shop: [
    { screen: "shopDashboard", label: "홈", icon: Gauge },
    { screen: "shopRequests", label: "거래방", icon: Building2 },
    { screen: "messages", label: "메시지", icon: MessageCircle },
    { screen: "dealerProfile", label: "시공점 관리", icon: Settings2 },
    { href: "/help/shop", label: "고객센터", icon: HelpCircle },
  ],
  admin: [
    { screen: "ops", label: "운영 현황", icon: UsersRound },
    { screen: "adminShops", label: "시공점 관리", icon: Building2 },
    { screen: "adminAccount", label: "계정", icon: UserRound },
  ],
};

const screenTitles: Partial<Record<Screen, string>> = {
  dealerDashboard: "대시보드", shopDashboard: "시공점 대시보드", priceGuide: "권장 시공 패키지 가이드", request: "새 시공 요청",
  requestSummary: "요청 최종 확인", dealerMap: "시공점 찾기", deals: "거래 관리", shopRequests: "거래 관리", messages: "메시지", dealerProfile: "마이페이지", ops: "운영 현황", adminShops: "시공점 관리", adminAccount: "계정", dealerHelp: "고객센터",
};

// Shop's sidebar labels ("거래방"/"시공점 관리") and the shared screenTitles
// map (written for Dealer's "거래 관리"/"마이페이지") disagreed for the same
// two screens — the topbar showed different words than the sidebar button
// the Shop user just clicked. Dealer's nav has always had sidebar label ===
// topbar title for every item; this makes Shop match that same convention
// without touching the shared map Dealer still relies on.
const shopScreenTitles: Partial<Record<Screen, string>> = { shopRequests: "거래방", dealerProfile: "시공점 관리" };

const MOBILE_PRIMARY_COUNT = 4;

function isActive(screen: Screen, target: Screen) {
  return screen === target || target === "request" && screen === "requestSummary";
}

export function AppShell({ role, account, company, screen, unreadMessageCount = 0, mobileFullscreen = false, onNavigate, onLogout, children }: { role: Role; account: DemoAccount; company?: string; screen: Screen; unreadMessageCount?: number; mobileFullscreen?: boolean; onNavigate: (screen: Screen) => void; onLogout: () => void; children: ReactNode }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const roleLabel = role === "dealer" ? "딜러" : role === "shop" ? "시공점" : "관리자";
  const items = navigation[role];
  const primaryItems = items;
  const secondaryItems: typeof items = [];
  let overflow = items.length > MOBILE_PRIMARY_COUNT ? items.slice(MOBILE_PRIMARY_COUNT) : [];
  let primary = overflow.length > 0 ? items.slice(0, MOBILE_PRIMARY_COUNT) : items;
  // "메시지"는 사이드바 순서와 무관하게 모바일 하단 네비에 항상 남아야 하므로,
  // 더보기로 밀려날 primary 항목이 있으면 그것부터 대신 넘긴다.
  const pinnedScreens: Screen[] = ["messages"];
  for (const pinned of pinnedScreens) {
    if (overflow.length === 0 || primary.some((item) => item.screen === pinned)) continue;
    const pinnedItem = items.find((item) => item.screen === pinned);
    if (!pinnedItem) continue;
    let bumpIndex = primary.length - 1;
    while (bumpIndex > 0 && primary[bumpIndex].screen && pinnedScreens.includes(primary[bumpIndex].screen as Screen)) bumpIndex--;
    const bumped = primary[bumpIndex];
    primary = [...primary.slice(0, bumpIndex), pinnedItem, ...primary.slice(bumpIndex + 1)];
    overflow = [bumped, ...overflow.filter((item) => item.screen !== pinned)];
  }
  const overflowActive = overflow.some((item) => item.screen ? isActive(screen, item.screen) : false);
  const go = (item: typeof items[number]) => { setMoreOpen(false); if (item.href) window.location.assign(item.href); else if (item.screen) onNavigate(item.screen); };
  // Desktop Messenger reads as its own focused workspace, not a page inside
  // the general Dealer/Shop chrome, so the sidebar and workspace topbar step
  // aside for a minimal "back to Car-Master" bar. Mobile is untouched here —
  // it already has its own dedicated Inbox/fullscreen-chat handling via
  // mobileFullscreen, driven separately by MessengerScreen's mobile view state.
  const messengerFocus = screen === "messages";
  const homeScreen = navigation[role][0].screen ?? "dealerDashboard";

  return <div className={`app-frame role-${role}${screen === "dealerDashboard" ? " dealer-home-frame" : ""}${mobileFullscreen ? " mobile-chat-fullscreen" : ""}${messengerFocus ? " messenger-focus" : ""}`}>
    <aside className="app-sidebar">
      <button className="app-logo" onClick={() => onNavigate(homeScreen)}><img src="/carmaster-logo-transparent.png" alt="Car-Master" /><small>{roleLabel} 워크스페이스</small></button>
      <div className="sidebar-section-label">업무 메뉴</div>
      <nav className="sidebar-primary-nav">{primaryItems.map((item) => <button key={item.href ?? item.screen} className={item.screen ? (isActive(screen, item.screen) ? "active" : "") : ""} onClick={() => go(item)}><i aria-hidden="true"><item.icon size={22} strokeWidth={2} /></i><span>{item.label}</span>{item.screen === "messages" && unreadMessageCount > 0 && <span className="nav-unread-badge">{unreadMessageCount > 99 ? "99+" : unreadMessageCount}</span>}</button>)}</nav>
      {secondaryItems.length > 0 && <><div className="sidebar-subsection-label">보조 메뉴</div><nav className="sidebar-secondary-nav">{secondaryItems.map((item) => <button key={item.href ?? item.screen} className={item.screen ? (isActive(screen, item.screen) ? "active" : "") : ""} onClick={() => go(item)}><i aria-hidden="true"><item.icon size={17} strokeWidth={2} /></i><span>{item.label}</span></button>)}</nav></>}
      <div className="sidebar-profile"><span>{account.name.slice(0, 1)}</span><div><b>{account.name}</b><small>{company ?? `${roleLabel} 계정`}</small></div><button onClick={onLogout} aria-label="로그아웃"><LogOut size={16} /></button></div>
    </aside>
    <main className="app-main">
      {/* Both headers stay mounted; CSS (desktop-only, .messenger-focus scoped)
          picks which one shows. Mobile always keeps app-topbar-default — the
          messenger-focus-topbar's base rule is display:none, only overridden
          at desktop widths, so the existing mobile Inbox/chat header flow is
          untouched. */}
      <header className="app-topbar app-topbar-default"><button className="mobile-sidebar-toggle" onClick={() => setMoreOpen(true)} aria-label="업무 메뉴 열기"><Menu size={20} /></button><div className="topbar-title"><small>Car-Master</small><b>{(role === "shop" ? shopScreenTitles[screen] : undefined) ?? screenTitles[screen] ?? "워크스페이스"}</b></div><div className="topbar-actions"><span className="service-status"><i /> 서비스 정상</span><button className="topbar-icon-button" aria-label="알림"><Bell size={18} /></button>{role === "dealer" && <button className="primary" onClick={() => onNavigate("request")}><Plus size={17} /> 새 시공 요청</button>}<button className="mobile-logout-button" onClick={onLogout} aria-label="로그아웃"><LogOut size={18} /><span>로그아웃</span></button><div className="topbar-account"><span>{account.name.slice(0, 1)}</span><div><b>{account.name}</b><small>{company ?? `${roleLabel} 계정`}</small></div></div></div></header>
      <header className="app-topbar messenger-focus-topbar"><button type="button" className="messenger-back-to-workspace" onClick={() => onNavigate(homeScreen)}><ArrowLeft size={17} aria-hidden="true" /> Car-Master</button><b>메시지</b><button className="mobile-logout-button" onClick={onLogout} aria-label="로그아웃"><LogOut size={18} /><span>로그아웃</span></button></header>
      {children}
    </main>

    <nav className="app-mobile-nav" aria-label="주요 메뉴">
      {primary.map((item) => <button key={item.href ?? item.screen} className={item.screen ? (isActive(screen, item.screen) ? "active" : "") : ""} onClick={() => go(item)}><span className="mobile-nav-icon">{item.screen === "messages" && unreadMessageCount > 0 && <span className="nav-unread-badge">{unreadMessageCount > 99 ? "99+" : unreadMessageCount}</span>}<item.icon size={20} strokeWidth={2} aria-hidden="true" /></span><span>{item.label}</span></button>)}
      {overflow.length > 0 && <button className={overflowActive ? "active" : ""} onClick={() => setMoreOpen(true)} aria-haspopup="true" aria-expanded={moreOpen}><MoreHorizontal size={20} aria-hidden="true" /><span>더보기</span></button>}
    </nav>
    {moreOpen && <div className="app-mobile-more" role="dialog" aria-modal="true" aria-label="더보기 메뉴">
      <button className="app-mobile-more-backdrop" onClick={() => setMoreOpen(false)} aria-label="닫기" />
      <div className="app-mobile-more-sheet">
        <div className="app-mobile-more-head"><b>더보기</b><button onClick={() => setMoreOpen(false)} aria-label="닫기"><X size={18} /></button></div>
        <div className="app-mobile-more-grid">
          {overflow.map((item) => <button key={item.href ?? item.screen} className={item.screen ? (isActive(screen, item.screen) ? "active" : "") : ""} onClick={() => go(item)}><item.icon size={20} strokeWidth={2} aria-hidden="true" /><span>{item.label}</span></button>)}
          <button onClick={() => { setMoreOpen(false); window.location.href = role === "shop" ? "/help/shop" : "/help"; }}><HelpCircle size={20} strokeWidth={2} aria-hidden="true" /><span>고객센터</span></button>
          <button onClick={() => { setMoreOpen(false); onLogout(); }}><LogOut size={20} aria-hidden="true" /><span>로그아웃</span></button>
        </div>
      </div>
    </div>}
  </div>;
}
