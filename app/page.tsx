"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { AccountStatusScreen } from "../components/auth/AccountStatusScreen";
import { LoginScreen } from "../components/auth/LoginScreen";
import { SignUpScreen } from "../components/auth/SignUpScreen";
import { ForgotPasswordScreen } from "../components/auth/ForgotPasswordScreen";
import { UpdatePasswordScreen } from "../components/auth/UpdatePasswordScreen";
import { OnboardingScreen } from "../components/auth/OnboardingScreen";
import { TermsScreen } from "../components/legal/TermsScreen";
import { PrivacyScreen } from "../components/legal/PrivacyScreen";
import { LandingPage } from "../components/landing/LandingPage";
import { AppShell } from "../components/layout/AppShell";
import { AdminWorkspace } from "../components/workspaces/AdminWorkspace";
import { DealerWorkspace } from "../components/workspaces/DealerWorkspace";
import { InstallerWorkspace } from "../components/workspaces/InstallerWorkspace";
import { demoAccounts, isDemoAccountId } from "../data/demo-accounts";
import { demoInstallerListings } from "../data/installer-directory-demo";
import { installerDirectoryRepository } from "../repositories/installer-directory-repository";
import type { InstallerListing } from "../types/installer";
import type { ShopCoverage } from "../components/layout/AppShell";
import { useTransactionActions } from "../hooks/use-transaction-actions";
import { useTransactionStore } from "../hooks/use-transaction-store";
import { demoAttachmentProvider } from "../services/attachments";
import { authProvider, initializeAuth, routeAfterAuthInitialization } from "../services/auth";
import {
  isProtectedPath,
  legacyRoleForUserRole,
  publicScreenForPath,
  workspacePathForRole,
  workspacePathForUser,
} from "../services/auth/access-policy";
import type { DemoAccount, Role, Screen } from "../types/dealer";
import type {
  CurrentUser,
  DealerOnboardingInput,
  InstallerOnboardingInput,
  SignUpInput,
  SignUpResult,
} from "../types/auth";

/** Groups approved shops by 시/도 for the sidebar coverage block: the four
 * largest regions, everything else folded into "그 외". Returns null when
 * there is nothing to show, so the caller can omit the block entirely. */
function summarizeCoverage(shops: InstallerListing[]): ShopCoverage | null {
  const usable = shops.filter((shop) => shop.approved !== false);
  if (usable.length === 0) return null;
  const counts = new Map<string, number>();
  for (const shop of usable) {
    const label = (shop.province || "기타").replace(/(특별시|광역시|특별자치시|특별자치도|도)$/, "") || shop.province;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, 4).map(([label, count]) => ({ label, count }));
  const rest = sorted.slice(4).reduce((sum, [, count]) => sum + count, 0);
  return { total: usable.length, regions: rest > 0 ? [...top, { label: "그 외", count: rest }] : top };
}

function pathForScreen(screen: Screen, role: Role) {
  if (screen === "landing") return "/";
  if (screen === "login") return "/login";
  if (screen === "signup") return "/signup";
  if (screen === "forgotPassword") return "/forgot-password";
  if (screen === "updatePassword") return "/update-password";
  if (screen === "terms") return "/terms";
  if (screen === "privacy") return "/privacy";
  if (screen === "onboarding") return "/onboarding";
  if (screen === "accountStatus") return "/account-status";
  return workspacePathForRole(role);
}

function accountForUser(user: CurrentUser): DemoAccount {
  // Callers must route a "pending" user to onboarding before ever reaching
  // here (see enterAuthenticatedUser) — a pending role has no DemoAccount
  // shape to map into. Fail loudly rather than silently guessing a role.
  if (user.role === "pending") throw new Error("accountForUser called with a pending-onboarding user");
  const role: Role = legacyRoleForUserRole(user.role);
  return {
    id: user.id,
    email: user.email,
    password: "",
    name: user.name,
    role,
    entryScreen: role === "dealer" ? "dealerDashboard" : role === "shop" ? "shopDashboard" : "ops",
    shopId: role === "shop" ? user.id : undefined,
  };
}

export default function Home() {
  const pathname = usePathname();
  const [role, setRole] = useState<Role>("dealer");
  const [account, setAccount] = useState<DemoAccount>(demoAccounts[0]);
  const [screen, setScreen] = useState<Screen>(() => publicScreenForPath(pathname));
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [dealerCompanyName, setDealerCompanyName] = useState<string | undefined>(undefined);
  const [realShopCoverage, setRealShopCoverage] = useState<ShopCoverage | null>(null);
  const [dealerUnreadMessageCount, setDealerUnreadMessageCount] = useState(0);
  const [dealerMobileFullscreen, setDealerMobileFullscreen] = useState(false);
  const [installerMobileFullscreen, setInstallerMobileFullscreen] = useState(false);
  const [installerUnreadMessageCount, setInstallerUnreadMessageCount] = useState(0);
  const useSupabaseData = Boolean(currentUser);
  const {
    transactions,
    rooms,
    isLoading: isTransactionLoading,
    error: transactionLoadError,
    refresh,
    demoSchemaReady,
    sharedRoomIds,
  } = useTransactionStore(useSupabaseData, account.id);
  // True once the shared Demo transaction backend (202608010001 migration)
  // is confirmed live — until then every Demo mutation below falls back to
  // this browser's own localStorage exactly as before v0.3.12, instead of
  // throwing against RPCs/tables that don't exist yet.
  const useDemoSharedBackend = !useSupabaseData && demoSchemaReady === true;
  const {
    sendMessage,
    markRoomRead,
    loadContact,
    hideTransaction,
    unhideTransaction,
    changeStage,
    endOutcome,
    setContactStatus,
    changeFinalPrice,
    changePayment,
  } = useTransactionActions({ useSupabaseData, transactions, sharedRoomIds, demoActorId: account.id, role, refresh });

  // Demo Messenger attachment persistence (SUPABASE_SERVICE_ROLE_KEY +
  // demo-transaction-attachments bucket). Same graceful-degrade shape as
  // demoSchemaReady above: stays false (falling back to the session-only
  // LocalAttachmentProvider) until the one-time server setup is confirmed.
  const [demoAttachmentsReady, setDemoAttachmentsReady] = useState(false);
  useEffect(() => {
    if (useSupabaseData || !isDemoAccountId(account.id) || role === "admin") return;
    let active = true;
    void demoAttachmentProvider.isReady().then((ready) => {
      if (active) setDemoAttachmentsReady(ready);
    });
    return () => {
      active = false;
    };
  }, [useSupabaseData, account.id, role]);

  const goToScreen = useCallback(
    (next: Screen, nextRole = role) => {
      setScreen(next);
      window.history.pushState(null, "", pathForScreen(next, nextRole));
    },
    [role],
  );

  const login = useCallback((nextAccount: DemoAccount, replace = false) => {
    setAccount(nextAccount);
    setRole(nextAccount.role);
    setScreen(nextAccount.entryScreen);
    const path = pathForScreen(nextAccount.entryScreen, nextAccount.role);
    window.history[replace ? "replaceState" : "pushState"](null, "", path);
  }, []);

  const enterAuthenticatedUser = useCallback((user: CurrentUser, replace = false) => {
    if (user.role === "pending") {
      // No dealer/installer/admin account shape exists yet for a pending
      // user (accountForUser can't map "pending" into a Role) — send them
      // straight to onboarding instead of building a DemoAccount.
      setCurrentUser(user);
      setScreen("onboarding");
      window.history[replace ? "replaceState" : "pushState"](null, "", "/onboarding");
      return;
    }
    const nextAccount = accountForUser(user);
    const nextScreen: Screen =
      workspacePathForUser(user) === "/account-status" ? "accountStatus" : nextAccount.entryScreen;
    setCurrentUser(user);
    setAccount(nextAccount);
    setRole(nextAccount.role);
    setScreen(nextScreen);
    const path = pathForScreen(nextScreen, nextAccount.role);
    window.history[replace ? "replaceState" : "pushState"](null, "", path);
  }, []);

  const authenticate = useCallback(
    async (email: string, password: string) => {
      const demoResponse = await fetch("/api/demo-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: email, password }),
      });
      if (demoResponse.ok) {
        const { account: demoAccount } = (await demoResponse.json()) as { account: DemoAccount };
        // A real Supabase session left over from earlier in this browser (a
        // different tab, a prior real-account test) must not survive into a
        // Demo session — otherwise its own auth-state-change listener can
        // reassert `currentUser` after this and silently flip useSupabaseData
        // back to true, routing Demo traffic into the real-only approved-
        // installer gate. Best-effort: never let a sign-out failure block demo login.
        await authProvider.logout().catch(() => {});
        setCurrentUser(null);
        login(demoAccount);
        return;
      }
      if (demoResponse.status !== 401) {
        const result = (await demoResponse.json().catch(() => null)) as { error?: string } | null;
        throw new Error(result?.error ?? "로그인 설정을 확인해 주세요.");
      }
      await fetch("/api/demo-login", { method: "DELETE" });
      const user = await authProvider.login({ email, password });
      enterAuthenticatedUser(user);
    },
    [enterAuthenticatedUser, login],
  );

  const signUp = useCallback(
    async (input: SignUpInput): Promise<SignUpResult> => {
      const result = await authProvider.signUp(input);
      if (result.user) enterAuthenticatedUser(result.user);
      return result;
    },
    [enterAuthenticatedUser],
  );

  const logout = useCallback(async () => {
    await fetch("/api/demo-login", { method: "DELETE" });
    await authProvider.logout();
    setCurrentUser(null);
    goToScreen("login");
  }, [goToScreen]);

  const requestPasswordReset = useCallback((email: string) => authProvider.requestPasswordReset(email), []);
  const exchangeRecoveryCode = useCallback((code: string) => authProvider.exchangeRecoveryCode(code), []);
  // Recovery sessions are single-purpose: sign out right after the new
  // password is set so the user proves they know it by logging in fresh,
  // rather than silently landing in their dashboard on a session that
  // originated from an email link.
  const updatePasswordFromRecovery = useCallback(async (newPassword: string) => {
    await authProvider.updatePassword(newPassword);
    await authProvider.logout().catch(() => {});
  }, []);
  const changePassword = useCallback(
    (currentPassword: string, newPassword: string) => authProvider.updatePassword(newPassword, currentPassword),
    [],
  );
  const completeDealerOnboarding = useCallback(
    async (input: DealerOnboardingInput) => {
      const user = await authProvider.completeDealerOnboarding(input);
      enterAuthenticatedUser(user, true);
    },
    [enterAuthenticatedUser],
  );
  const completeInstallerOnboarding = useCallback(
    async (input: InstallerOnboardingInput) => {
      const user = await authProvider.completeInstallerOnboarding(input);
      enterAuthenticatedUser(user, true);
    },
    [enterAuthenticatedUser],
  );

  useEffect(() => {
    let active = true;
    const protectedPath = isProtectedPath(pathname);
    const frame = requestAnimationFrame(() => {
      void (async () => {
        try {
          const demoResponse = await fetch("/api/demo-login", { cache: "no-store" });
          if (!active) return;
          if (demoResponse.ok) {
            const { account: demoAccount } = (await demoResponse.json()) as { account: DemoAccount };
            if (!active) return;
            // Same isolation as authenticate()'s demo branch: a leftover real
            // Supabase session must not be able to flip currentUser back on
            // (e.g. after a refresh) while a demo cookie is active.
            await authProvider.logout().catch(() => {});
            if (!active) return;
            login(demoAccount, true);
            return;
          }
          const result = await initializeAuth(authProvider);
          if (!active) return;
          if (result.status === "error") console.error("[auth] Session initialization failed", result.error);
          if (result.status === "timeout") console.warn("[auth] Session initialization timed out");
          const route = routeAfterAuthInitialization(pathname, result.user);
          if (route.destination === "workspace") enterAuthenticatedUser(route.user, true);
          else if (route.destination === "login") {
            setScreen("login");
            window.history.replaceState(null, "", "/login");
          } else setScreen(route.screen);
        } catch (error) {
          console.error("[auth] Session bootstrap failed", error);
          if (active && protectedPath) {
            setScreen("login");
            window.history.replaceState(null, "", "/login");
          }
        } finally {
          if (active) setAuthReady(true);
        }
      })();
    });
    return () => {
      active = false;
      cancelAnimationFrame(frame);
    };
  }, [enterAuthenticatedUser, login, pathname]);

  // Sidebar coverage figure. Never hardcoded: Demo derives it from the demo
  // directory during render, Real fetches the approved-shop directory. Any
  // failure leaves it null and the sidebar omits the block entirely.
  useEffect(() => {
    if (!useSupabaseData) return;
    let active = true;
    void installerDirectoryRepository
      .getApproved()
      .then((shops) => { if (active) setRealShopCoverage(summarizeCoverage(shops)); })
      .catch(() => { if (active) setRealShopCoverage(null); });
    return () => { active = false; };
  }, [useSupabaseData]);
  const demoShopCoverage = useMemo(() => summarizeCoverage(demoInstallerListings), []);
  const shopCoverage = useSupabaseData ? realShopCoverage : demoShopCoverage;

  useEffect(() => {
    if (!authProvider.subscribe) return;
    return authProvider.subscribe((user) => {
      if (user) enterAuthenticatedUser(user, true);
      else {
        setCurrentUser(null);
        setScreen("login");
        window.history.replaceState(null, "", "/login");
      }
    });
  }, [enterAuthenticatedUser]);

  if (isProtectedPath(pathname) && !authReady)
    return (
      <main className="system-state-page" aria-busy="true">
        <section>
          <div className="system-state-logo">CM</div>
          <div className="loading-line wide" />
          <p>회원 세션을 확인하고 있습니다.</p>
        </section>
      </main>
    );
  if (screen === "landing") return <LandingPage onStart={() => goToScreen("login")} />;
  if (screen === "login")
    return (
      <LoginScreen
        onLogin={authenticate}
        onExplore={() => goToScreen("landing")}
        onSignUp={() => goToScreen("signup")}
        onForgotPassword={() => goToScreen("forgotPassword")}
      />
    );
  if (screen === "signup") return <SignUpScreen onBack={() => goToScreen("login")} onSignUp={signUp} />;
  if (screen === "forgotPassword")
    return <ForgotPasswordScreen onRequestReset={requestPasswordReset} onBack={() => goToScreen("login")} />;
  if (screen === "updatePassword")
    return (
      <UpdatePasswordScreen
        onExchangeCode={exchangeRecoveryCode}
        onUpdatePassword={updatePasswordFromRecovery}
        onGoToLogin={() => goToScreen("login")}
        onGoToForgotPassword={() => goToScreen("forgotPassword")}
      />
    );
  if (screen === "terms") return <TermsScreen />;
  if (screen === "privacy") return <PrivacyScreen />;
  if (screen === "onboarding" && currentUser)
    return (
      <OnboardingScreen
        user={currentUser}
        onCompleteDealer={completeDealerOnboarding}
        onCompleteInstaller={completeInstallerOnboarding}
        onLogout={() => void logout()}
      />
    );
  if (screen === "accountStatus" && currentUser)
    return <AccountStatusScreen user={currentUser} onLogout={() => void logout()} />;

  const adminUnreadMessageCount = rooms
    .filter((room) => transactions.some((item) => item.chatRoomId === room.id))
    .reduce((sum, room) => sum + room.unreadCount, 0);
  const unreadMessageCount =
    role === "shop"
      ? installerUnreadMessageCount
      : role === "dealer"
        ? dealerUnreadMessageCount
        : adminUnreadMessageCount;
  const mobileFullscreen =
    role === "shop" ? installerMobileFullscreen : role === "dealer" ? dealerMobileFullscreen : false;
  return (
    <AppShell
      role={role}
      account={account}
      company={role === "dealer" ? dealerCompanyName : undefined}
      screen={screen}
      unreadMessageCount={unreadMessageCount}
      mobileFullscreen={mobileFullscreen}
      shopCoverage={role === "dealer" ? shopCoverage : null}
      onNavigate={goToScreen}
      onLogout={() => void logout()}
    >
      {transactionLoadError && (
        <div className="system-inline-error" role="alert">
          <span>{transactionLoadError}</span>
          <button onClick={() => void refresh()}>다시 시도</button>
        </div>
      )}
      {isTransactionLoading && useSupabaseData && (
        <p className="system-inline-loading" role="status">
          거래 정보를 불러오는 중입니다.
        </p>
      )}
      {role === "dealer" && (
        <DealerWorkspace
          account={account}
          screen={screen}
          transactions={transactions}
          rooms={rooms}
          useSupabaseData={useSupabaseData}
          useDemoSharedBackend={useDemoSharedBackend}
          demoAttachmentProvider={!useSupabaseData && demoAttachmentsReady ? demoAttachmentProvider : undefined}
          isLoading={isTransactionLoading}
          loadError={transactionLoadError}
          onNavigate={goToScreen}
          onRefresh={refresh}
          onSend={sendMessage}
          onHide={hideTransaction}
          onFinalPriceChange={changeFinalPrice}
          onStageChange={changeStage}
          onPaymentChange={changePayment}
          onEndOutcome={endOutcome}
          onSetContactStatus={setContactStatus}
          onFindAnotherShop={() => goToScreen("dealerMap")}
          onMarkRead={markRoomRead}
          onLoadContact={loadContact}
          onChangePassword={changePassword}
          onCompanyNameChange={setDealerCompanyName}
          onUnreadMessageCountChange={setDealerUnreadMessageCount}
          onMobileFullscreenChange={setDealerMobileFullscreen}
        />
      )}
      {role === "shop" && (
        <InstallerWorkspace
          account={account}
          screen={screen}
          transactions={transactions}
          rooms={rooms}
          installers={demoInstallerListings}
          useRemoteAttachments={useSupabaseData}
          demoAttachmentProvider={!useSupabaseData && demoAttachmentsReady ? demoAttachmentProvider : undefined}
          isLoading={isTransactionLoading}
          loadError={transactionLoadError}
          onNavigate={goToScreen}
          onSend={sendMessage}
          onHide={hideTransaction}
          onUnhide={unhideTransaction}
          onFinalPriceChange={changeFinalPrice}
          onStageChange={changeStage}
          onPaymentChange={changePayment}
          onEndOutcome={endOutcome}
          onMarkRead={markRoomRead}
          onLoadContact={loadContact}
          onChangePassword={changePassword}
          onUnreadMessageCountChange={setInstallerUnreadMessageCount}
          onMobileFullscreenChange={setInstallerMobileFullscreen}
        />
      )}
      {role === "admin" && (
        <AdminWorkspace
          account={account}
          screen={screen}
          transactions={transactions}
          rooms={rooms}
          onNavigate={goToScreen}
          onChangePassword={changePassword}
        />
      )}
    </AppShell>
  );
}
