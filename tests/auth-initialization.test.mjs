import assert from "node:assert/strict";
import test from "node:test";
import { initializeAuth, routeAfterAuthInitialization } from "../services/auth/auth-initialization.ts";

const dealer = { id: "dealer", email: "dealer@example.com", name: "딜러", role: "dealer" };

test("auth initialization completes for authenticated and anonymous users", async () => {
  assert.deepEqual(await initializeAuth({ initialize: async () => dealer }, 20), { status: "authenticated", user: dealer });
  assert.deepEqual(await initializeAuth({ initialize: async () => null }, 20), { status: "anonymous", user: null });
});

test("delayed auth initialization times out instead of blocking a public page", async () => {
  const result = await initializeAuth({ initialize: () => new Promise(() => {}) }, 10);
  assert.deepEqual(result, { status: "timeout", user: null });
});

test("failed auth initialization completes with a safe error result", async () => {
  const failure = new Error("internal Supabase detail");
  const result = await initializeAuth({ initialize: async () => { throw failure; } }, 20);
  assert.equal(result.status, "error");
  assert.equal(result.user, null);
  assert.equal(result.error, failure);
});

test("anonymous protected routes go to login while public routes keep their screen", () => {
  assert.deepEqual(routeAfterAuthInitialization("/dealer", null), { destination: "login", screen: "login" });
  assert.deepEqual(routeAfterAuthInitialization("/", null), { destination: "public", screen: "landing" });
  assert.deepEqual(routeAfterAuthInitialization("/login", null), { destination: "public", screen: "login" });
});

test("authenticated users enter their workspace from root, login, and protected routes", () => {
  for (const path of ["/", "/login", "/dealer"]) assert.equal(routeAfterAuthInitialization(path, dealer).destination, "workspace");
});
