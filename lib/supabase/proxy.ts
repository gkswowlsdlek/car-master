import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabasePublishableKey, supabaseUrl } from "./config";

export async function updateSupabaseSession(request: NextRequest) {
  let response = NextResponse.next({ request });
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
  const { data } = await supabase.auth.getClaims();
  response.headers.set("Cache-Control", "private, no-store");
  const pathname = request.nextUrl.pathname;
  const protectedRole = pathname.startsWith("/dealer") ? "dealer" : pathname.startsWith("/shop") ? "installer" : pathname.startsWith("/admin") ? "admin" : pathname.startsWith("/account-status") ? "installer" : null;
  if (protectedRole) {
    const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
    if (!userId) return copyAuthCookies(response, NextResponse.redirect(new URL("/login", request.url)));
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).single<{ role: "dealer" | "installer" | "admin" }>();
    if (!profile) return copyAuthCookies(response, NextResponse.redirect(new URL("/login", request.url)));
    if (profile.role !== protectedRole) return copyAuthCookies(response, NextResponse.redirect(new URL(profile.role === "dealer" ? "/dealer" : profile.role === "admin" ? "/admin" : "/account-status", request.url)));
    if (profile.role === "installer") {
      const { data: approval } = await supabase.from("installer_approvals").select("status").eq("user_id", userId).single<{ status: string }>();
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
