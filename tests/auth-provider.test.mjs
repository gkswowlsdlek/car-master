import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { defaultDemoCredentials, getDemoCredentials } from "../lib/demo-credentials.ts";
import { createDemoSession, verifyDemoSession } from "../lib/demo-session.ts";

test("the Demo login route composes server credentials, signed sessions, and an HttpOnly cookie", async () => {
  const route = await readFile(new URL("../app/api/demo-login/route.ts", import.meta.url), "utf8");
  assert.match(route, /getDemoCredentials\(\)\.find/);
  assert.match(route, /await createDemoSession\(matched\.role\)/);
  assert.match(route, /response\.cookies\.set\s*\(\s*demoSessionCookie,\s*session\.token,\s*\{\s*httpOnly:\s*true/);
  assert.match(route, /if\s*\(!matched\)\s*return\s+NextResponse\.json\s*\(\s*\{\s*matched:\s*false\s*,?\s*\},\s*\{\s*status:\s*401\s*,?\s*\}\s*,?\s*\)/);
});

test("server demo sessions are signed and reject tampering", async () => {
  const previousSecret = process.env.CARMASTER_DEMO_SESSION_SECRET;
  try {
    process.env.CARMASTER_DEMO_SESSION_SECRET = crypto.randomUUID();
    const session = await createDemoSession("dealer");
    assert.equal(await verifyDemoSession(session.token), "dealer");
    assert.equal(await verifyDemoSession(session.token.replace("dealer", "admin")), null);
  } finally {
    if (previousSecret === undefined) delete process.env.CARMASTER_DEMO_SESSION_SECRET;
    else process.env.CARMASTER_DEMO_SESSION_SECRET = previousSecret;
  }
});

test("server demo sessions fail closed when the signing secret is missing", async () => {
  const previousSecret = process.env.CARMASTER_DEMO_SESSION_SECRET;
  try {
    process.env.CARMASTER_DEMO_SESSION_SECRET = crypto.randomUUID();
    const session = await createDemoSession("dealer");
    delete process.env.CARMASTER_DEMO_SESSION_SECRET;
    await assert.rejects(() => createDemoSession("dealer"), /Demo session secret is not configured/);
    assert.equal(await verifyDemoSession(session.token), null);
  } finally {
    if (previousSecret === undefined) delete process.env.CARMASTER_DEMO_SESSION_SECRET;
    else process.env.CARMASTER_DEMO_SESSION_SECRET = previousSecret;
  }
});

test("server demo sessions fail closed when the signing secret is blank", async () => {
  const previousSecret = process.env.CARMASTER_DEMO_SESSION_SECRET;
  try {
    process.env.CARMASTER_DEMO_SESSION_SECRET = "   ";
    await assert.rejects(() => createDemoSession("dealer"), /Demo session secret is not configured/);
    assert.equal(await verifyDemoSession("dealer.9999999999.invalid"), null);
  } finally {
    if (previousSecret === undefined) delete process.env.CARMASTER_DEMO_SESSION_SECRET;
    else process.env.CARMASTER_DEMO_SESSION_SECRET = previousSecret;
  }
});

test("public QA credentials resolve to the requested dealer, shop, and admin roles", () => {
  assert.deepEqual(getDemoCredentials(), defaultDemoCredentials);
  assert.deepEqual(
    getDemoCredentials().map(({ role, username, password }) => ({ role, username, password })),
    [
      { role: "dealer", username: "1", password: "1" },
      { role: "shop", username: "2", password: "2" },
      { role: "admin", username: "3", password: "3" },
    ],
  );
});
