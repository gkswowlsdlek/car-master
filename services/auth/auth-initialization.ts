import type { CurrentUser } from "../../types/auth";
import type { AuthProvider } from "./auth-provider";
import { isProtectedPath, publicScreenForPath } from "./access-policy.ts";

export const AUTH_INITIALIZATION_TIMEOUT_MS = 5_000;

export type AuthInitializationResult =
  | { status: "authenticated"; user: CurrentUser }
  | { status: "anonymous"; user: null }
  | { status: "timeout"; user: null }
  | { status: "error"; user: null; error: unknown };

export async function initializeAuth(provider: Pick<AuthProvider, "initialize">, timeoutMs = AUTH_INITIALIZATION_TIMEOUT_MS): Promise<AuthInitializationResult> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<"timeout">((resolve) => { timeoutId = setTimeout(() => resolve("timeout"), timeoutMs); });
    const initialized = provider.initialize().then((user) => ({ kind: "user" as const, user }));
    const result = await Promise.race([initialized, timeout]);
    if (result === "timeout") return { status: "timeout", user: null };
    return result.user ? { status: "authenticated", user: result.user } : { status: "anonymous", user: null };
  } catch (error) {
    return { status: "error", user: null, error };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export function routeAfterAuthInitialization(pathname: string, user: CurrentUser | null) {
  const protectedPath = isProtectedPath(pathname);
  if (user && (protectedPath || pathname === "/" || pathname === "/login")) return { destination: "workspace" as const, user };
  if (protectedPath) return { destination: "login" as const, screen: "login" as const };
  return { destination: "public" as const, screen: publicScreenForPath(pathname) };
}
