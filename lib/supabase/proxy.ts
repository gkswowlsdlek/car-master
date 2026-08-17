import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server.js";
import { supabasePublishableKey, supabaseUrl } from "./config.ts";
import { demoSessionCookie, verifyDemoSession } from "../demo-session.ts";
import {
  isProtectedPath,
  normalizeUserRole,
  resolveAuthenticatedDestination,
} from "../../services/auth/access-policy.ts";
import type { InstallerApprovalStatus, UserRole } from "../../types/auth.ts";

const AUTH_PROXY_TIMEOUT_MS = 5_000;
const defaultProxyRuntime = { supabaseUrl, supabasePublishableKey, createServerClient };

async function withTimeout<T>(value: PromiseLike<T>): Promise<T | null> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(value),
      new Promise<null>((resolve) => {
        timeoutId = setTimeout(() => resolve(null), AUTH_PROXY_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export async function updateSupabaseSession(request: NextRequest, runtime = defaultProxyRuntime) {
  let response = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;
  const protectedRoute = isProtectedPath(pathname);
  const demoRole = await verifyDemoSession(request.cookies.get(demoSessionCookie)?.value);

  // Public demo sessions unlock only the prototype UI. Supabase RLS still
  // receives no authenticated user and continues to protect real member data.
  if (protectedRoute && demoRole) {
    response.headers.set("Cache-Control", "private, no-store");
    const destination = resolveAuthenticatedDestination(
      normalizeUserRole(demoRole),
      demoRole === "shop" ? "approved" : undefined,
      pathname,
    );
    return destination === pathname ? response : NextResponse.redirect(new URL(destination, request.url));
  }
  // Public pages must not wait for a remote Supabase session check. The client
  // initializes an existing session in the background and redirects signed-in users.
  if (!protectedRoute) return response;
  if (!runtime.supabaseUrl || !runtime.supabasePublishableKey) {
    response.headers.set("Cache-Control", "private, no-store");
    return copyAuthCookies(response, NextResponse.redirect(new URL("/login", request.url)));
  }
  const supabase = runtime.createServerClient(runtime.supabaseUrl, runtime.supabasePublishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, responseOptions) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(responseOptions?.headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });
  const claimsResult = await withTimeout(supabase.auth.getClaims());
  response.headers.set("Cache-Control", "private, no-store");
  if (protectedRoute) {
    const userId = typeof claimsResult?.data?.claims?.sub === "string" ? claimsResult.data.claims.sub : null;
    if (!userId) return copyAuthCookies(response, NextResponse.redirect(new URL("/login", request.url)));
    const profileResult = await withTimeout(
      supabase.from("profiles").select("role").eq("id", userId).single<{ role: UserRole }>(),
    );
    const profile = profileResult?.data;
    if (!profile) return copyAuthCookies(response, NextResponse.redirect(new URL("/login", request.url)));
    let approvalStatus: InstallerApprovalStatus | undefined;
    if (profile.role === "installer") {
      const approvalResult = await withTimeout(
        supabase.from("installer_approvals").select("status").eq("user_id", userId).single<{ status: string }>(),
      );
      const status = approvalResult?.data?.status;
      if (status === "pending" || status === "approved" || status === "rejected" || status === "suspended")
        approvalStatus = status;
    }
    const destination = resolveAuthenticatedDestination(profile.role, approvalStatus, pathname);
    if (destination !== pathname)
      return copyAuthCookies(response, NextResponse.redirect(new URL(destination, request.url)));
  }
  return response;
}

function copyAuthCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));
  target.headers.set("Cache-Control", "private, no-store");
  return target;
}
