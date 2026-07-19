import { NextResponse, type NextRequest } from "next/server";
import { demoAccounts } from "../../../data/demo-accounts";
import { createDemoSession, demoSessionCookie, verifyDemoSession } from "../../../lib/demo-session";
import type { Role } from "../../../types/dealer";

const credentials = (): { role: Role; username?: string; password?: string }[] => [
  { role: "dealer", username: process.env.CARMASTER_DEMO_DEALER_ID, password: process.env.CARMASTER_DEMO_DEALER_PASSWORD },
  { role: "shop", username: process.env.CARMASTER_DEMO_SHOP_ID, password: process.env.CARMASTER_DEMO_SHOP_PASSWORD },
  { role: "admin", username: process.env.CARMASTER_DEMO_ADMIN_ID, password: process.env.CARMASTER_DEMO_ADMIN_PASSWORD },
];

function publicAccount(role: Role) {
  const account = demoAccounts.find((item) => item.role === role);
  return account ? { id: account.id, email: "", password: "", name: account.name, role: account.role, entryScreen: account.entryScreen, shopId: account.shopId } : null;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { username?: string; password?: string } | null;
  const matched = credentials().find((item) => item.username && item.password && item.username === body?.username?.trim() && item.password === body?.password);
  if (!matched) return NextResponse.json({ matched: false }, { status: 401 });
  const account = publicAccount(matched.role);
  if (!account) return NextResponse.json({ matched: false }, { status: 401 });
  try {
    const session = await createDemoSession(matched.role);
    const response = NextResponse.json({ account });
    response.cookies.set(demoSessionCookie, session.token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: session.maxAge });
    return response;
  } catch {
    return NextResponse.json({ error: "시험 계정 환경설정을 확인해 주세요." }, { status: 503 });
  }
}

export async function GET(request: NextRequest) {
  const role = await verifyDemoSession(request.cookies.get(demoSessionCookie)?.value);
  const account = role ? publicAccount(role) : null;
  return account ? NextResponse.json({ account }) : NextResponse.json({ account: null }, { status: 401 });
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(demoSessionCookie, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
