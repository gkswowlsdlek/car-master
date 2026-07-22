import type { CurrentUser } from "../../types/auth";

export const publicPaths = ["/", "/login", "/signup", "/auth/callback"] as const;
export const protectedPaths = ["/dealer", "/shop", "/admin", "/account-status"] as const;

export function isPublicPath(pathname: string) {
  return publicPaths.some((path) => path === "/" ? pathname === path : pathname === path || pathname.startsWith(`${path}/`));
}

export function isProtectedPath(pathname: string) {
  return protectedPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function publicScreenForPath(pathname: string) {
  if (pathname === "/login") return "login" as const;
  if (pathname === "/signup") return "signup" as const;
  return "landing" as const;
}

export function workspacePathForUser(user: CurrentUser) {
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
  return true;
}
