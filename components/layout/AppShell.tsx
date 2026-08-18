"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  Bell,
  Building2,
  ChevronRight,
  Gauge,
  HelpCircle,
  LogOut,
  MapPin,
  Menu,
  MessageCircle,
  MoreHorizontal,
  MoreVertical,
  Plus,
  Settings2,
  UserRound,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import type { DemoAccount, Role, Screen } from "../../types/dealer";

// Dealer's own core flow (North Star: "가까운 시공점 찾기" first) drives the
// order here — 홈/시공점찾기/거래관리/메시지 are the 4 items MOBILE_PRIMARY_COUNT
// keeps on the mobile bottom nav without overflow. "시공 요청" is deliberately
// NOT a nav destination — the product flow is Shop 먼저 찾기 → 선택 → 요청, so
// it stays only as a strong CTA on the Dashboard (and the existing topbar
// quick-action button), never a sidebar/bottom-nav item. 마이페이지/권장 시공
// 패키지 are real, unremoved routes — kept at the tail so they still surface
// in the sidebar and in mobile's "더보기" sheet.
// group splits the desktop rail into "업무"(the daily flow) and "지원"(help and
// account). It is desktop-sidebar presentation only — the mobile bottom nav and
// its 더보기 sheet still read this array in order, so MOBILE_PRIMARY_COUNT and
// the pinned-item logic below are unaffected.
type NavItem = { screen?: Screen; href?: string; label: string; icon: LucideIcon; group: "work" | "support" };

const navigation: Record<Role, NavItem[]> = {
  dealer: [
    { screen: "dealerDashboard", label: "대시보드", icon: Gauge, group: "work" },
    { screen: "dealerMap", label: "시공점 찾기", icon: MapPin, group: "work" },
    { screen: "deals", label: "거래 관리", icon: Building2, group: "work" },
    { screen: "messages", label: "메시지", icon: MessageCircle, group: "work" },
    { screen: "dealerHelp", label: "고객센터", icon: HelpCircle, group: "support" },
    { screen: "dealerProfile", label: "마이페이지", icon: UserRound, group: "support" },
  ],
  shop: [
    { screen: "shopDashboard", label: "홈", icon: Gauge, group: "work" },
    { screen: "shopRequests", label: "거래방", icon: Building2, group: "work" },
    { screen: "messages", label: "메시지", icon: MessageCircle, group: "work" },
    { screen: "dealerProfile", label: "시공점 관리", icon: Settings2, group: "support" },
    { href: "/help/shop", label: "고객센터", icon: HelpCircle, group: "support" },
  ],
  admin: [
    { screen: "ops", label: "운영 현황", icon: UsersRound, group: "work" },
    { screen: "adminShops", label: "시공점 관리", icon: Building2, group: "work" },
    { screen: "adminAccount", label: "계정", icon: UserRound, group: "support" },
  ],
};

const screenTitles: Partial<Record<Screen, string>> = {
  dealerDashboard: "대시보드",
  shopDashboard: "시공점 대시보드",
  request: "새 시공 요청",
  requestSummary: "요청 최종 확인",
  dealerMap: "시공점 찾기",
  deals: "거래 관리",
  shopRequests: "거래 관리",
  messages: "메시지",
  dealerProfile: "마이페이지",
  ops: "운영 현황",
  adminShops: "시공점 관리",
  adminAccount: "계정",
  dealerHelp: "고객센터",
};

// Shop's sidebar labels ("거래방"/"시공점 관리") and the shared screenTitles
// map (written for Dealer's "거래 관리"/"마이페이지") disagreed for the same
// two screens — the topbar showed different words than the sidebar button
// the Shop user just clicked. Dealer's nav has always had sidebar label ===
// topbar title for every item; this makes Shop match that same convention
// without touching the shared map Dealer still relies on.
const shopScreenTitles: Partial<Record<Screen, string>> = { shopRequests: "거래방", dealerProfile: "시공점 관리" };

const MOBILE_PRIMARY_COUNT = 4;

/** Approved-shop network summary for the sidebar coverage block. Always
 * derived from a real directory read (see app/page.tsx); null whenever that
 * read fails or returns nothing, in which case the block is simply omitted. */
export type ShopCoverage = { total: number; regions: { label: string; count: number }[] };

function isActive(screen: Screen, target: Screen) {
  return screen === target || (target === "request" && screen === "requestSummary");
}

export function AppShell({
  role,
  account,
  company,
  screen,
  unreadMessageCount = 0,
  mobileFullscreen = false,
  shopCoverage = null,
  onNavigate,
  onLogout,
  children,
}: {
  role: Role;
  account: DemoAccount;
  company?: string;
  screen: Screen;
  unreadMessageCount?: number;
  mobileFullscreen?: boolean;
  shopCoverage?: ShopCoverage | null;
  onNavigate: (screen: Screen) => void;
  onLogout: () => void;
  children: ReactNode;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  // 화면 전환은 SPA 상태 변경이라 브라우저의 자동 스크롤 복원이 없다 — 이전
  // 화면의 스크롤이나 자식 마운트 효과가 남긴 위치가 그대로 이어지므로, 새
  // 화면은 항상 최상단에서 시작한다. 부모 effect는 자식 effect 뒤에 실행되므로
  // 자식이 마운트 중 어디로 스크롤했든 여기가 마지막에 이긴다. 창 스크롤만
  // 초기화한다 — 메신저 채팅의 최신 메시지 자동 스크롤은 .messenger-messages
  // 내부 스크롤이라 영향받지 않는다.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);
  const roleLabel = role === "dealer" ? "딜러" : role === "shop" ? "시공점" : "관리자";
  const items = navigation[role];
  const workItems = items.filter((item) => item.group === "work");
  const supportItems = items.filter((item) => item.group === "support");
  // 계정 메뉴에는 지금 실제로 존재하는 화면만 넣는다 — 역할별 프로필/계정 화면
  // 하나와 로그아웃이 전부다. 없는 설정 화면을 항목으로 만들지 않는다.
  const accountScreenItem = items.find(
    (item) => item.screen === "dealerProfile" || item.screen === "adminAccount",
  );
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
    while (bumpIndex > 0 && primary[bumpIndex].screen && pinnedScreens.includes(primary[bumpIndex].screen as Screen))
      bumpIndex--;
    const bumped = primary[bumpIndex];
    primary = [...primary.slice(0, bumpIndex), pinnedItem, ...primary.slice(bumpIndex + 1)];
    overflow = [bumped, ...overflow.filter((item) => item.screen !== pinned)];
  }
  const overflowActive = overflow.some((item) => (item.screen ? isActive(screen, item.screen) : false));
  const go = (item: (typeof items)[number]) => {
    setMoreOpen(false);
    if (item.href) window.location.assign(item.href);
    else if (item.screen) onNavigate(item.screen);
  };
  // Desktop Messenger reads as its own focused workspace, not a page inside
  // the general Dealer/Shop chrome, so the sidebar and workspace topbar step
  // aside for a minimal "back to Car-Master" bar. Mobile is untouched here —
  // it already has its own dedicated Inbox/fullscreen-chat handling via
  // mobileFullscreen, driven separately by MessengerScreen's mobile view state.
  const messengerFocus = screen === "messages";
  const homeScreen = navigation[role][0].screen ?? "dealerDashboard";

  return (
    <div
      className={`app-frame role-${role}${screen === "dealerDashboard" ? " dealer-home-frame" : ""}${mobileFullscreen ? " mobile-chat-fullscreen" : ""}${messengerFocus ? " messenger-focus" : ""}`}
    >
      <aside className="app-sidebar">
        <button className="app-logo" onClick={() => onNavigate(homeScreen)}>
          <img src="/carmaster-logo-transparent.png" alt="Car-Master" />
          <small>{roleLabel} 워크스페이스</small>
        </button>
        {(
          [
            ["업무", workItems],
            ["지원", supportItems],
          ] as const
        ).map(
          ([label, groupItems]) =>
            groupItems.length > 0 && (
              <div className="sidebar-group" key={label}>
                <div className="sidebar-group-label">{label}</div>
                <nav>
                  {groupItems.map((item) => (
                    <button
                      key={item.href ?? item.screen}
                      className={item.screen ? (isActive(screen, item.screen) ? "active" : "") : ""}
                      onClick={() => go(item)}
                    >
                      <i aria-hidden="true">
                        <item.icon size={22} strokeWidth={2} />
                      </i>
                      <span>{item.label}</span>
                      {item.screen === "messages" && unreadMessageCount > 0 && (
                        <span className="nav-unread-badge">
                          {unreadMessageCount > 99 ? "99+" : unreadMessageCount}
                        </span>
                      )}
                    </button>
                  ))}
                </nav>
              </div>
            ),
        )}
        {shopCoverage && (
          <button
            type="button"
            className="sidebar-coverage"
            onClick={() => onNavigate(role === "dealer" ? "dealerMap" : homeScreen)}
          >
            <b className="sidebar-coverage-title">시공점 네트워크</b>
            <span className="sidebar-coverage-count">
              전국 등록 <b>{shopCoverage.total}</b>곳
            </span>
            <span className="sidebar-coverage-action">
              지역 확인 <ChevronRight size={14} aria-hidden="true" />
            </span>
          </button>
        )}
        <div className="sidebar-profile">
          <span>{account.name.slice(0, 1)}</span>
          <div>
            <b>{account.name}</b>
            <small>{company ?? `${roleLabel} 계정`}</small>
          </div>
          <button
            className="sidebar-account-toggle"
            onClick={() => setAccountMenuOpen((open) => !open)}
            aria-label="계정 메뉴"
            aria-expanded={accountMenuOpen}
          >
            <MoreVertical size={16} />
          </button>
          {accountMenuOpen && (
            <>
              <button
                type="button"
                className="sidebar-account-backdrop"
                aria-label="계정 메뉴 닫기"
                onClick={() => setAccountMenuOpen(false)}
              />
              <div className="sidebar-account-menu" role="menu">
                {accountScreenItem?.screen && (
                  <button
                    role="menuitem"
                    onClick={() => {
                      setAccountMenuOpen(false);
                      onNavigate(accountScreenItem.screen!);
                    }}
                  >
                    <accountScreenItem.icon size={15} aria-hidden="true" />
                    {accountScreenItem.label}
                  </button>
                )}
                <button
                  role="menuitem"
                  onClick={() => {
                    setAccountMenuOpen(false);
                    onLogout();
                  }}
                >
                  <LogOut size={15} aria-hidden="true" />
                  로그아웃
                </button>
              </div>
            </>
          )}
        </div>
      </aside>
      <main className="app-main">
        {/* Both headers stay mounted; CSS (desktop-only, .messenger-focus scoped)
          picks which one shows. Mobile always keeps app-topbar-default — the
          messenger-focus-topbar's base rule is display:none, only overridden
          at desktop widths, so the existing mobile Inbox/chat header flow is
          untouched. */}
        <header className="app-topbar app-topbar-default">
          <button className="mobile-sidebar-toggle" onClick={() => setMoreOpen(true)} aria-label="업무 메뉴 열기">
            <Menu size={20} />
          </button>
          <div className="topbar-title">
            <small>Car-Master</small>
            <b>{(role === "shop" ? shopScreenTitles[screen] : undefined) ?? screenTitles[screen] ?? "워크스페이스"}</b>
          </div>
          <div className="topbar-actions">
            <span className="service-status">
              <i /> 서비스 정상
            </span>
            <button className="topbar-icon-button" aria-label="알림">
              <Bell size={18} />
            </button>
            {role === "dealer" && (
              <button className="primary" onClick={() => onNavigate("request")}>
                <Plus size={17} /> 새 시공 요청
              </button>
            )}
            <button className="mobile-logout-button" onClick={onLogout} aria-label="로그아웃">
              <LogOut size={18} />
              <span>로그아웃</span>
            </button>
            <div className="topbar-account">
              <span>{account.name.slice(0, 1)}</span>
              <div>
                <b>{account.name}</b>
                <small>{company ?? `${roleLabel} 계정`}</small>
              </div>
            </div>
          </div>
        </header>
        <header className="app-topbar messenger-focus-topbar">
          <button type="button" className="messenger-back-to-workspace" onClick={() => onNavigate(homeScreen)}>
            <ArrowLeft size={17} aria-hidden="true" /> Car-Master
          </button>
          <b>메시지</b>
          <button className="mobile-logout-button" onClick={onLogout} aria-label="로그아웃">
            <LogOut size={18} />
            <span>로그아웃</span>
          </button>
        </header>
        {children}
      </main>

      <nav className="app-mobile-nav" aria-label="주요 메뉴">
        {primary.map((item) => (
          <button
            key={item.href ?? item.screen}
            className={item.screen ? (isActive(screen, item.screen) ? "active" : "") : ""}
            onClick={() => go(item)}
          >
            <span className="mobile-nav-icon">
              {item.screen === "messages" && unreadMessageCount > 0 && (
                <span className="nav-unread-badge">{unreadMessageCount > 99 ? "99+" : unreadMessageCount}</span>
              )}
              <item.icon size={20} strokeWidth={2} aria-hidden="true" />
            </span>
            <span>{item.label}</span>
          </button>
        ))}
        {overflow.length > 0 && (
          <button
            className={overflowActive ? "active" : ""}
            onClick={() => setMoreOpen(true)}
            aria-haspopup="true"
            aria-expanded={moreOpen}
          >
            <MoreHorizontal size={20} aria-hidden="true" />
            <span>더보기</span>
          </button>
        )}
      </nav>
      {moreOpen && (
        <div className="app-mobile-more" role="dialog" aria-modal="true" aria-label="더보기 메뉴">
          <button className="app-mobile-more-backdrop" onClick={() => setMoreOpen(false)} aria-label="닫기" />
          <div className="app-mobile-more-sheet">
            <div className="app-mobile-more-head">
              <b>더보기</b>
              <button onClick={() => setMoreOpen(false)} aria-label="닫기">
                <X size={18} />
              </button>
            </div>
            <div className="app-mobile-more-grid">
              {overflow.map((item) => (
                <button
                  key={item.href ?? item.screen}
                  className={item.screen ? (isActive(screen, item.screen) ? "active" : "") : ""}
                  onClick={() => go(item)}
                >
                  <item.icon size={20} strokeWidth={2} aria-hidden="true" />
                  <span>{item.label}</span>
                </button>
              ))}
              <button
                onClick={() => {
                  setMoreOpen(false);
                  window.location.href = role === "shop" ? "/help/shop" : "/help";
                }}
              >
                <HelpCircle size={20} strokeWidth={2} aria-hidden="true" />
                <span>고객센터</span>
              </button>
              <button
                onClick={() => {
                  setMoreOpen(false);
                  onLogout();
                }}
              >
                <LogOut size={20} aria-hidden="true" />
                <span>로그아웃</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
