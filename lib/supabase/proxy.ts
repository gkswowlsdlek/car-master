import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabasePublishableKey, supabaseUrl } from "./config";
import { demoSessionCookie, verifyDemoSession } from "../demo-session";

const AUTH_PROXY_TIMEOUT_MS = 5_000;
async function withTimeout<T>(value: PromiseLike<T>): Promise<T | null> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([Promise.resolve(value), new Promise<null>((resolve) => { timeoutId = setTimeout(() => resolve(null), AUTH_PROXY_TIMEOUT_MS); })]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export async function updateSupabaseSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;
  const protectedRole = pathname.startsWith("/dealer") ? "dealer" : pathname.startsWith("/shop") ? "installer" : pathname.startsWith("/admin") ? "admin" : pathname.startsWith("/account-status") ? "installer" : null;
  const demoRole = await verifyDemoSession(request.cookies.get(demoSessionCookie)?.value);
  const normalizedDemoRole = demoRole === "shop" ? "installer" : demoRole;

  // Public demo sessions unlock only the prototype UI. Supabase RLS still
  // receives no authenticated user and continues to protect real member data.
  if (protectedRole && normalizedDemoRole && ["dealer", "installer", "admin"].includes(normalizedDemoRole)) {
    response.headers.set("Cache-Control", "private, no-store");
    if (normalizedDemoRole === protectedRole) {
      if (pathname.startsWith("/account-status")) return NextResponse.redirect(new URL("/shop", request.url));
      return response;
    }
    const demoPath = normalizedDemoRole === "dealer" ? "/dealer" : normalizedDemoRole === "admin" ? "/admin" : "/shop";
    return NextResponse.redirect(new URL(demoPath, request.url));
  }
  // Public pages must not wait for a remote Supabase session check. The client
  // initializes an existing session in the background and redirects signed-in users.
  if (!protectedRole) return response;
  if (!supabaseUrl || !supabasePublishableKey) return response;
  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
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
  if (protectedRole) {
    const userId = typeof claimsResult?.data?.claims?.sub === "string" ? claimsResult.data.claims.sub : null;
    if (!userId) return copyAuthCookies(response, NextResponse.redirect(new URL("/login", request.url)));
    const profileResult = await withTimeout(supabase.from("profiles").select("role").eq("id", userId).single<{ role: "dealer" | "installer" | "admin" }>());
    const profile = profileResult?.data;
    if (!profile) return copyAuthCookies(response, NextResponse.redirect(new URL("/login", request.url)));
    if (profile.role !== protectedRole) return copyAuthCookies(response, NextResponse.redirect(new URL(profile.role === "dealer" ? "/dealer" : profile.role === "admin" ? "/admin" : "/account-status", request.url)));
    if (profile.role === "installer") {
      const approvalResult = await withTimeout(supabase.from("installer_approvals").select("status").eq("user_id", userId).single<{ status: string }>());
      const approval = approvalResult?.data;
      const approved = approval?.status === "approved";
      if (pathname.startsWith("/shop") && !approved) return copyAuthCookies(response, NextResponse.redirect(new URL("/account-status", request.url)));
      if (pathname.startsWith("/account-status") && approved) return copyAuthCookies(response, NextResponse.redirect(new URL("/shop", request.url)));
    }
  }
  return response;
}

function copyAuthCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));
  target.headers.set("Cache-Control", "private, no-store");
  return target;
}
