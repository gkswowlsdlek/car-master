import { NextResponse, type NextRequest } from "next/server";
import { demoSessionCookie, verifyDemoSession } from "../../../../lib/demo-session";
import { createSupabaseServiceClient, isServiceRoleConfigured } from "../../../../lib/supabase/service";
import { DEMO_ATTACHMENTS_BUCKET } from "../../../../lib/demo-attachments-config";

const MAX_PATHS = 50;

function isChatRole(role: string | null): role is "dealer" | "shop" {
  return role === "dealer" || role === "shop";
}

// Re-signs storagePaths on every room load — mirrors
// repositories/supabase-chat-repository.ts's real equivalent (it calls
// createSignedUrl directly from the browser because a real user's session
// is covered by storage RLS; Demo has no such session, so this route does
// the same job server-side with the service-role client).
export async function POST(request: NextRequest) {
  if (!isServiceRoleConfigured) return NextResponse.json({ urls: {} });

  const role = await verifyDemoSession(request.cookies.get(demoSessionCookie)?.value);
  if (!isChatRole(role)) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { paths?: unknown } | null;
  const rawPaths = Array.isArray(body?.paths) ? body.paths : [];
  const paths = rawPaths
    .filter((path): path is string => typeof path === "string" && path.startsWith("demo/"))
    .slice(0, MAX_PATHS);
  if (paths.length === 0) return NextResponse.json({ urls: {} });

  const client = createSupabaseServiceClient();
  const urls: Record<string, string> = {};
  await Promise.all(
    paths.map(async (path) => {
      const { data, error } = await client.storage.from(DEMO_ATTACHMENTS_BUCKET).createSignedUrl(path, 3600);
      if (!error && data?.signedUrl) urls[path] = data.signedUrl;
    }),
  );
  return NextResponse.json({ urls });
}
