import assert from "node:assert/strict";
import test from "node:test";
import { canAccessWorkspacePath, workspacePathForUser } from "../services/auth/access-policy.ts";

const dealer = { id: "d", email: "d@example.com", name: "딜러", role: "dealer" };
const admin = { id: "a", email: "a@example.com", name: "관리자", role: "admin" };
const pending = { id: "i1", email: "i1@example.com", name: "시공점", role: "installer", approvalStatus: "pending" };
const approved = { ...pending, id: "i2", approvalStatus: "approved" };
const suspended = { ...pending, id: "i3", approvalStatus: "suspended" };

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
