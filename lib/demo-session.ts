import type { Role } from "../types/dealer";

export const demoSessionCookie = "carmaster-demo-session";
const sessionLifetimeSeconds = 60 * 60 * 24;

function encode(bytes: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function signature(value: string) {
  const secret = process.env.CARMASTER_DEMO_SESSION_SECRET;
  if (!secret) return null;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return encode(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

export async function createDemoSession(role: Role) {
  const expiresAt = Math.floor(Date.now() / 1000) + sessionLifetimeSeconds;
  const payload = `${role}.${expiresAt}`;
  const signed = await signature(payload);
  if (!signed) throw new Error("Demo session secret is not configured.");
  return { token: `${payload}.${signed}`, maxAge: sessionLifetimeSeconds };
}

export async function verifyDemoSession(token?: string) {
  if (!token) return null;
  const [role, expiresAt, received] = token.split(".");
  if (!["dealer", "shop", "admin"].includes(role) || !expiresAt || !received || Number(expiresAt) <= Math.floor(Date.now() / 1000)) return null;
  const expected = await signature(`${role}.${expiresAt}`);
  return expected === received ? role as Role : null;
}
