import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { createServer } from "node:net";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");
const buildId = new URL("../.next/BUILD_ID", import.meta.url);
const publicPaths = ["/", "/login", "/terms", "/privacy"];
const protectedPaths = ["/dealer", "/shop", "/admin", "/account-status", "/onboarding"];
const demoAccounts = [
  { username: "1", password: "1", role: "dealer", path: "/dealer" },
  { username: "2", password: "2", role: "shop", path: "/shop" },
  { username: "3", password: "3", role: "admin", path: "/admin" },
];

await access(buildId).catch(() => {
  throw new Error("Fresh Next.js output is required. Run `pnpm build` before this smoke test.");
});

const port = await reservePort();
const baseUrl = `http://127.0.0.1:${port}`;
let serverOutput = "";
const child = spawn(process.execPath, [nextBin, "start", "-H", "127.0.0.1", "-p", String(port)], {
  cwd: new URL("..", import.meta.url),
  env: { ...process.env, NODE_ENV: "production" },
  stdio: ["ignore", "pipe", "pipe"],
});

child.stdout.on("data", (chunk) => { serverOutput += chunk; });
child.stderr.on("data", (chunk) => { serverOutput += chunk; });

try {
  await waitForServer(child, `${baseUrl}/`);

  for (const path of publicPaths) {
    const response = await fetch(`${baseUrl}${path}`, { redirect: "manual" });
    assert.equal(response.status, 200, `${path} should be publicly accessible`);
    assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
    if (path === "/") assert.match(await response.text(), /Car-Master/i);
    console.log(`PUBLIC ${path}: 200`);
  }

  for (const path of protectedPaths) {
    const response = await fetch(`${baseUrl}${path}`, { redirect: "manual" });
    assert.ok([301, 302, 303, 307, 308].includes(response.status), `${path} should redirect`);
    const location = response.headers.get("location");
    assert.ok(location, `${path} should provide a redirect location`);
    const redirectUrl = new URL(location, baseUrl);
    assert.equal(redirectUrl.pathname, "/login", `${path} should redirect to /login`);
    const loginResponse = await fetch(redirectUrl, { redirect: "manual" });
    assert.equal(loginResponse.status, 200, `${path} redirect should stop at the login page`);
    console.log(`PROTECTED ${path}: ${response.status} -> /login`);
  }

  const missingPath = `/__next-production-smoke-missing-${Date.now()}`;
  const missingResponse = await fetch(`${baseUrl}${missingPath}`, { redirect: "manual" });
  assert.equal(missingResponse.status, 404, "an unknown route should return 404");
  console.log(`NOT_FOUND ${missingPath}: 404`);

  let demoMode;
  for (const account of demoAccounts) {
    const response = await fetch(`${baseUrl}/api/demo-login`, {
      method: "POST",
      redirect: "manual",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: account.username, password: account.password }),
    });

    assert.notEqual(response.status, 500, "Demo login must not crash");
    assert.ok(response.status === 200 || response.status === 503, `unexpected Demo login status: ${response.status}`);
    const currentMode = response.status === 200 ? "configured" : "fail-closed";
    demoMode ??= currentMode;
    assert.equal(currentMode, demoMode, "Demo session configuration must be consistent across roles");

    if (response.status === 503) {
      assert.equal(response.headers.get("set-cookie"), null, "fail-closed login must not create a session");
      console.log(`DEMO ${account.username}/${account.password}: 503 fail-closed (manual verification required)`);
      continue;
    }

    const setCookie = response.headers.get("set-cookie");
    assert.ok(setCookie, "configured Demo login should create an HttpOnly session cookie");
    const cookie = setCookie.split(";", 1)[0];
    const restoreResponse = await fetch(`${baseUrl}/api/demo-login`, { headers: { cookie }, redirect: "manual" });
    assert.equal(restoreResponse.status, 200, "Demo session should restore after login");
    const restored = await restoreResponse.json();
    assert.equal(restored.account?.role, account.role);
    const workspaceResponse = await fetch(`${baseUrl}${account.path}`, { headers: { cookie }, redirect: "manual" });
    assert.equal(workspaceResponse.status, 200, `${account.role} should reach ${account.path}`);
    console.log(`DEMO ${account.username}/${account.password}: 200 -> ${account.path}`);
  }

  console.log("NEXT_PRODUCTION_SMOKE=PASS");
} catch (error) {
  if (serverOutput) process.stderr.write(`\n--- next start output ---\n${serverOutput}\n`);
  throw error;
} finally {
  await stopChild(child);
  await assertPortReleased(port);
  console.log(`SERVER_CLEANUP=PASS port=${port}`);
}

async function reservePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const selectedPort = address.port;
  await new Promise((resolve) => server.close(resolve));
  return selectedPort;
}

async function waitForServer(processHandle, url) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (processHandle.exitCode !== null) throw new Error(`next start exited early with code ${processHandle.exitCode}`);
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status > 0) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("next start did not become ready within 20 seconds");
}

async function stopChild(processHandle) {
  if (processHandle.exitCode !== null) return;
  processHandle.kill();
  await Promise.race([
    new Promise((resolve) => processHandle.once("exit", resolve)),
    new Promise((_, reject) => setTimeout(() => reject(new Error("next start did not stop within 5 seconds")), 5_000)),
  ]);
}

async function assertPortReleased(portNumber) {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(portNumber, "127.0.0.1", resolve);
  });
  await new Promise((resolve) => server.close(resolve));
}
