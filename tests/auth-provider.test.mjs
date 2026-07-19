import assert from "node:assert/strict";
import test from "node:test";
import { demoAccounts } from "../data/demo-accounts.ts";
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

test("published QA credentials open the dealer, installer, and admin roles", async () => {
  const expected = [
    { email: "1", password: "1", role: "dealer" },
    { email: "2", password: "2", role: "installer" },
    { email: "3", password: "3", role: "admin" },
  ];

  for (const account of expected) {
    const provider = new DemoAuthProvider(demoAccounts);
    const user = await provider.login(account);
    assert.equal(user.role, account.role);
  }
});
