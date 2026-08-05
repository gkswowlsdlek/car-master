import type { CurrentUser } from "../../types/auth";

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

export function workspacePathForUser(user: CurrentUser) {
  if (user.role === "pending") return "/onboarding";
  if (user.role === "admin") return "/admin";
  if (user.role === "dealer") return "/dealer";
  return user.approvalStatus === "approved" ? "/shop" : "/account-status";
}

export function canAccessWorkspacePath(user: CurrentUser | null, pathname: string) {
  if (!user) return !isProtectedPath(pathname);
  if (pathname.startsWith("/dealer")) return user.role === "dealer";
  if (pathname.startsWith("/admin")) return user.role === "admin";
  if (pathname.startsWith("/shop")) return user.role === "installer" && user.approvalStatus === "approved";
  if (pathname.startsWith("/account-status")) return user.role === "installer" && user.approvalStatus !== "approved";
  if (pathname.startsWith("/onboarding")) return user.role === "pending";
  return true;
}
