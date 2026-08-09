import type { CurrentUser, InstallerApprovalStatus, LegacyUserRole, UserRole } from "../../types/auth";

export const publicPaths = ["/", "/login", "/signup", "/forgot-password", "/update-password", "/auth/callback", "/terms", "/privacy"] as const;
export const protectedPaths = ["/dealer", "/shop", "/admin", "/account-status", "/onboarding"] as const;

export function isPublicPath(pathname: string) {
  return publicPaths.some((path) => path === "/" ? pathname === path : pathname === path || pathname.startsWith(`${path}/`));
}

export function isProtectedPath(pathname: string) {
  return protectedPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function publicScreenForPath(pathname: string) {
  if (pathname === "/login") return "login" as const;
  if (pathname === "/signup") return "signup" as const;
  if (pathname === "/forgot-password") return "forgotPassword" as const;
  if (pathname === "/update-password") return "updatePassword" as const;
  if (pathname === "/terms") return "terms" as const;
  if (pathname === "/privacy") return "privacy" as const;
  return "landing" as const;
}

export function normalizeUserRole(role: UserRole | LegacyUserRole): UserRole {
  return role === "shop" ? "installer" : role;
}

export function legacyRoleForUserRole(role: Exclude<UserRole, "pending">): LegacyUserRole {
  return role === "installer" ? "shop" : role;
}

export function workspacePathForRole(role: UserRole | LegacyUserRole, approvalStatus?: InstallerApprovalStatus) {
  if (role === "shop") return "/shop" as const;
  const normalizedRole = normalizeUserRole(role);
  if (normalizedRole === "pending") return "/onboarding" as const;
  if (normalizedRole === "admin") return "/admin" as const;
  if (normalizedRole === "dealer") return "/dealer" as const;
  return approvalStatus === "approved" ? "/shop" as const : "/account-status" as const;
}

export function workspacePathForUser(user: CurrentUser) {
  return workspacePathForRole(user.role, user.approvalStatus);
}

export function resolveAuthenticatedDestination(role: UserRole | LegacyUserRole, approvalStatus: InstallerApprovalStatus | undefined, pathname: string) {
  const homePath = workspacePathForRole(role, approvalStatus);
  if (!isProtectedPath(pathname)) return homePath;
  return pathname === homePath || pathname.startsWith(`${homePath}/`) ? pathname : homePath;
}

export function canAccessWorkspacePath(user: CurrentUser | null, pathname: string) {
  if (!user) return !isProtectedPath(pathname);
  return !isProtectedPath(pathname) || resolveAuthenticatedDestination(user.role, user.approvalStatus, pathname) === pathname;
}
