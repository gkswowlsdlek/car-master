import assert from "node:assert/strict";
import test from "node:test";
import { createDemoSession, verifyDemoSession } from "../lib/demo-session.ts";
import { DemoAuthProvider } from "../services/auth/demo-auth-provider.ts";

const accounts = [
  { id: "dealer-1", email: "dealer", password: "secret", name: "딜러", role: "dealer", entryScreen: "dealerDashboard" },
  { id: "shop-1", email: "shop", password: "secret", name: "시공점", role: "shop", entryScreen: "shopDashboard", shopId: "installer-1" },
];

test("demo auth validates credentials and exposes a canonical current user", async () => {
  const provider = new DemoAuthProvider(accounts);
  const user = await provider.login({ email: " SHOP ", password: "secret" });
  assert.equal(user.role, "installer");
  assert.equal(user.installerId, "installer-1");
  assert.deepEqual(provider.getCurrentUser(), user);
  await provider.logout();
  assert.equal(provider.getCurrentUser(), null);
});

test("demo auth rejects invalid credentials", async () => {
  const provider = new DemoAuthProvider(accounts);
  await assert.rejects(() => provider.login({ email: "dealer", password: "wrong" }), /아이디 또는 비밀번호/);
});

test("server demo sessions are signed and reject tampering", async () => {
  process.env.CARMASTER_DEMO_SESSION_SECRET = "test-only-session-secret";
  const session = await createDemoSession("dealer");
  assert.equal(await verifyDemoSession(session.token), "dealer");
  assert.equal(await verifyDemoSession(session.token.replace("dealer", "admin")), null);
  delete process.env.CARMASTER_DEMO_SESSION_SECRET;
});
