import type { CurrentUser } from "../../types/auth";

export function workspacePathForUser(user: CurrentUser) {
  if (user.role === "admin") return "/admin";
  if (user.role === "dealer") return "/dealer";
  return user.approvalStatus === "approved" ? "/shop" : "/account-status";
}

export function canAccessWorkspacePath(user: CurrentUser | null, pathname: string) {
  if (!user) return !["/dealer", "/shop", "/admin", "/account-status"].some((path) => pathname.startsWith(path));
  if (pathname.startsWith("/dealer")) return user.role === "dealer";
  if (pathname.startsWith("/admin")) return user.role === "admin";
  if (pathname.startsWith("/shop")) return user.role === "installer" && user.approvalStatus === "approved";
  if (pathname.startsWith("/account-status")) return user.role === "installer" && user.approvalStatus !== "approved";
  return true;
}
