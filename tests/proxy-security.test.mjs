import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server.js";
import { createDemoSession, demoSessionCookie } from "../lib/demo-session.ts";
import { updateSupabaseSession } from "../lib/supabase/proxy.ts";

const unavailableRuntime = {
  supabaseUrl: "",
  supabasePublishableKey: "",
  createServerClient() {
    throw new Error("Supabase client must not be created without configuration.");
  },
};

const configuredAnonymousRuntime = {
  supabaseUrl: "https://configured.example.test",
  supabasePublishableKey: "configured-test-key",
  createServerClient() {
    return {
      auth: { getClaims: async () => ({ data: { claims: null } }) },
    };
  },
};

const requestFor = (pathname, cookie) => new NextRequest(`https://car-master.example${pathname}`, {
  headers: cookie ? { cookie } : undefined,
});

function assertPasses(response) {
  assert.equal(response.headers.get("x-middleware-next"), "1");
  assert.equal(response.headers.get("location"), null);
}

function assertRedirectsToLogin(response) {
  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "https://car-master.example/login");
}

function authenticatedRuntime(role, approvalStatus) {
  return {
    supabaseUrl: "https://configured.example.test",
    supabasePublishableKey: "configured-test-key",
    createServerClient() {
      return {
        auth: { getClaims: async () => ({ data: { claims: { sub: "user-1" } } }) },
        from(table) {
          const data = table === "profiles" ? { role } : { status: approvalStatus };
          return { select: () => ({ eq: () => ({ single: async () => ({ data }) }) }) };
        },
      };
    },
  };
}

test("configured Supabase rejects an anonymous protected-route request", async () => {
  assertRedirectsToLogin(await updateSupabaseSession(requestFor("/dealer"), configuredAnonymousRuntime));
});

test("configured Supabase leaves public routes accessible without an auth lookup", async () => {
  assertPasses(await updateSupabaseSession(requestFor("/privacy"), configuredAnonymousRuntime));
});

test("missing Supabase configuration fails closed for every protected workspace", async () => {
  for (const pathname of ["/dealer", "/shop", "/admin", "/account-status", "/onboarding"]) {
    assertRedirectsToLogin(await updateSupabaseSession(requestFor(pathname), unavailableRuntime));
  }
});

test("missing Supabase configuration keeps public routes available and cannot loop on login", async () => {
  for (const pathname of ["/", "/login", "/terms", "/privacy"]) {
    assertPasses(await updateSupabaseSession(requestFor(pathname), unavailableRuntime));
  }
});

test("valid Demo sessions still enter their matching workspace without Supabase configuration", async () => {
  const previousSecret = process.env.CARMASTER_DEMO_SESSION_SECRET;
  try {
    process.env.CARMASTER_DEMO_SESSION_SECRET = crypto.randomUUID();
    for (const [role, pathname] of [["dealer", "/dealer"], ["shop", "/shop"], ["admin", "/admin"]]) {
      const { token } = await createDemoSession(role);
      assertPasses(await updateSupabaseSession(requestFor(pathname, `${demoSessionCookie}=${token}`), unavailableRuntime));
    }
  } finally {
    if (previousSecret === undefined) delete process.env.CARMASTER_DEMO_SESSION_SECRET;
    else process.env.CARMASTER_DEMO_SESSION_SECRET = previousSecret;
  }
});

test("real Dealer, approved Installer, and Admin wrong-role requests redirect directly to their canonical workspace", async () => {
  for (const [role, approvalStatus, home, wrongPaths] of [
    ["dealer", undefined, "/dealer", ["/shop", "/admin"]],
    ["installer", "approved", "/shop", ["/dealer", "/admin"]],
    ["admin", undefined, "/admin", ["/dealer", "/shop"]],
  ]) {
    assertPasses(await updateSupabaseSession(requestFor(home), authenticatedRuntime(role, approvalStatus)));
    for (const pathname of wrongPaths) {
      const response = await updateSupabaseSession(requestFor(pathname), authenticatedRuntime(role, approvalStatus));
      assert.equal(response.status, 307);
      assert.equal(response.headers.get("location"), `https://car-master.example${home}`);
    }
  }
});

test("pending, rejected, and suspended Installers stay on account status and never enter shop", async () => {
  for (const status of ["pending", "rejected", "suspended"]) {
    assertPasses(await updateSupabaseSession(requestFor("/account-status"), authenticatedRuntime("installer", status)));
    const response = await updateSupabaseSession(requestFor("/shop"), authenticatedRuntime("installer", status));
    assert.equal(response.status, 307);
    assert.equal(response.headers.get("location"), "https://car-master.example/account-status");
  }
});
