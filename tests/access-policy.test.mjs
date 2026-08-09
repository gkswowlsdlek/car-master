import assert from "node:assert/strict";
import test from "node:test";
import { canAccessWorkspacePath, isProtectedPath, isPublicPath, legacyRoleForUserRole, normalizeUserRole, publicScreenForPath, resolveAuthenticatedDestination, workspacePathForUser } from "../services/auth/access-policy.ts";

const dealer = { id: "d", email: "d@example.com", name: "딜러", role: "dealer" };
const admin = { id: "a", email: "a@example.com", name: "관리자", role: "admin" };
const pending = { id: "i1", email: "i1@example.com", name: "시공점", role: "installer", approvalStatus: "pending" };
const approved = { ...pending, id: "i2", approvalStatus: "approved" };
const suspended = { ...pending, id: "i3", approvalStatus: "suspended" };
const rejected = { ...pending, id: "i4", approvalStatus: "rejected" };

test("role and installer approval determine the workspace destination", () => {
  assert.equal(workspacePathForUser(dealer), "/dealer");
  assert.equal(workspacePathForUser(admin), "/admin");
  assert.equal(workspacePathForUser(pending), "/account-status");
  assert.equal(workspacePathForUser(approved), "/shop");
});

test("protected workspace paths reject anonymous and cross-role access", () => {
  assert.equal(canAccessWorkspacePath(null, "/dealer"), false);
  assert.equal(canAccessWorkspacePath(dealer, "/admin"), false);
  assert.equal(canAccessWorkspacePath(pending, "/shop"), false);
  assert.equal(canAccessWorkspacePath(suspended, "/shop"), false);
  assert.equal(canAccessWorkspacePath(approved, "/shop"), true);
});

test("authenticated destination matrix redirects every wrong-role path to the user's one allowed workspace", () => {
  for (const path of ["/dealer", "/shop", "/admin"]) {
    assert.equal(resolveAuthenticatedDestination("dealer", undefined, path), "/dealer");
    assert.equal(resolveAuthenticatedDestination("admin", undefined, path), "/admin");
    assert.equal(resolveAuthenticatedDestination("installer", "approved", path), "/shop");
  }
  for (const user of [pending, rejected, suspended]) {
    for (const path of ["/dealer", "/shop", "/admin", "/account-status"]) {
      assert.equal(resolveAuthenticatedDestination(user.role, user.approvalStatus, path), "/account-status");
    }
  }
  assert.equal(resolveAuthenticatedDestination("pending", undefined, "/dealer"), "/onboarding");
});

test("legacy Demo shop and Auth installer share one explicit role normalization boundary", () => {
  assert.equal(normalizeUserRole("shop"), "installer");
  assert.equal(normalizeUserRole("installer"), "installer");
  assert.equal(legacyRoleForUserRole("installer"), "shop");
  assert.equal(resolveAuthenticatedDestination("shop", undefined, "/admin"), "/shop");
});

test("public and protected routes are classified without rebuilding the router", () => {
  for (const path of ["/", "/login", "/signup", "/auth/callback"]) assert.equal(isPublicPath(path), true);
  for (const path of ["/dealer", "/shop", "/admin", "/account-status"]) assert.equal(isProtectedPath(path), true);
  assert.equal(publicScreenForPath("/"), "landing");
  assert.equal(publicScreenForPath("/login"), "login");
  assert.equal(publicScreenForPath("/signup"), "signup");
});
