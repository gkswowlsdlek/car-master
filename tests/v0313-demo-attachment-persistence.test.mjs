import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Demo attachment migration creates an isolated private bucket, grants nothing to anon/authenticated, and never touches the Real bucket", async () => {
  const migration = await read("supabase/migrations/202608040001_v0313_demo_attachment_storage.sql");
  assert.match(migration, /insert into storage\.buckets \(id, name, public, file_size_limit, allowed_mime_types\)/);
  assert.match(migration, /'demo-transaction-attachments', 'demo-transaction-attachments', false/);
  assert.doesNotMatch(migration, /'transaction-attachments'/); // only 'demo-transaction-attachments' appears, never the bare Real bucket id
  assert.doesNotMatch(migration, /grant .* to (anon|authenticated)/i);
  assert.doesNotMatch(migration, /create policy/i);
  assert.doesNotMatch(migration, /drop table|drop bucket|delete from storage/i);
});

test("Real SupabaseAttachmentProvider is unchanged — still browser-direct, still the real bucket, still authenticated-gated", async () => {
  const source = await read("services/attachments/supabase-attachment-provider.ts");
  assert.match(source, /client\.storage\s*\.from\s*\(\s*"transaction-attachments"\s*,?\s*\)\s*\.upload/);
  assert.match(source, /createSupabaseBrowserClient/);
  assert.doesNotMatch(source, /service-role|SERVICE_ROLE|demo-transaction-attachments/i);
});

test("Server-only Supabase service client prefers SUPABASE_SECRET_KEY, falls back to legacy SUPABASE_SERVICE_ROLE_KEY, never NEXT_PUBLIC_, and is never used by a browser attachment provider", async () => {
  const source = await read("lib/supabase/service.ts");
  assert.match(
    source,
    /process\.env\.SUPABASE_SECRET_KEY\?\.trim\(\) \|\| process\.env\.SUPABASE_SERVICE_ROLE_KEY\?\.trim\(\)/,
  );
  assert.doesNotMatch(source, /NEXT_PUBLIC_SUPABASE_SECRET/);
  assert.doesNotMatch(source, /NEXT_PUBLIC_SUPABASE_SERVICE/);
  const localProvider = await read("services/attachments/attachment-provider.ts");
  const realProvider = await read("services/attachments/supabase-attachment-provider.ts");
  assert.doesNotMatch(localProvider, /service\.ts|SECRET_KEY|SERVICE_ROLE/);
  assert.doesNotMatch(realProvider, /service\.ts|SECRET_KEY|SERVICE_ROLE/);
});

test("Demo attachment upload route rejects requests without a valid Demo session, and excludes the admin role", async () => {
  const source = await read("app/api/demo-attachments/upload/route.ts");
  assert.match(source, /verifyDemoSession\(request\.cookies\.get\(demoSessionCookie\)\?\.value\)/);
  assert.match(
    source,
    /if \(!isChatRole\(role\)\) return NextResponse\.json\(\{ error: "인증이 필요합니다\." \}, \{ status: 401 \}\)/,
  );
  assert.match(source, /function isChatRole\(role: string \| null\): role is "dealer" \| "shop"/);
  assert.doesNotMatch(source, /role === "admin"[\s\S]{0,40}return true/);
});

test("Demo attachment upload route rejects an arbitrary/unknown room id instead of trusting the client", async () => {
  const source = await read("app/api/demo-attachments/upload/route.ts");
  assert.match(
    source,
    /from\s*\(\s*"demo_chat_rooms"\s*,?\s*\)\s*\.select\s*\(\s*"id"\s*,?\s*\)\s*\.eq\s*\(\s*"id",\s*roomId\s*,?\s*\)\s*\.maybeSingle\(\)/,
  );
  assert.match(
    source,
    /if \(roomError \|\| !room\) return NextResponse\.json\(\{ error: "거래방을 확인할 수 없습니다\." \}, \{ status: 403 \}\)/,
  );
});

test("Demo attachment upload route validates the file (reuses the same allowlist/size limit as Real, no new file types)", async () => {
  const source = await read("app/api/demo-attachments/upload/route.ts");
  assert.match(
    source,
    /import \{ validateChatAttachment \} from "\.\.\/\.\.\/\.\.\/\.\.\/services\/attachments\/attachment-provider"/,
  );
  assert.match(source, /validateChatAttachment\(file\)/);
  const provider = await read("services/attachments/attachment-provider.ts");
  assert.match(provider, /CHAT_ATTACHMENT_MAX_BYTES = 10 \* 1024 \* 1024/);
});

test("Demo attachment upload writes only into the demo bucket at a demo/<roomId>/<uuid>/<name> path, never into the Real bucket", async () => {
  const source = await read("app/api/demo-attachments/upload/route.ts");
  assert.match(source, /const storagePath = `demo\/\$\{roomId\}\/\$\{id\}\/\$\{safeName\(file\.name\)\}`/);
  assert.match(source, /client\.storage\s*\.from\s*\(\s*DEMO_ATTACHMENTS_BUCKET\s*,?\s*\)\s*\.upload/);
  assert.doesNotMatch(source, /from\("transaction-attachments"\)/);
});

test("Demo attachment sign route also requires a valid Demo dealer/shop session and only re-signs demo/ paths", async () => {
  const source = await read("app/api/demo-attachments/sign/route.ts");
  assert.match(source, /verifyDemoSession\(request\.cookies\.get\(demoSessionCookie\)\?\.value\)/);
  assert.match(
    source,
    /if \(!isChatRole\(role\)\) return NextResponse\.json\(\{ error: "인증이 필요합니다\." \}, \{ status: 401 \}\)/,
  );
  assert.match(source, /path\.startsWith\("demo\/"\)/);
});

test("Demo attachment routes degrade to a safe response (not a crash) when the service role isn't configured", async () => {
  const upload = await read("app/api/demo-attachments/upload/route.ts");
  const sign = await read("app/api/demo-attachments/sign/route.ts");
  const ready = await read("app/api/demo-attachments/ready/route.ts");
  assert.match(
    upload,
    /if\s*\(!isServiceRoleConfigured\)\s*return\s+NextResponse\.json\s*\(\s*\{\s*error:\s*"Demo 첨부 기능이 아직 설정되지 않았습니다\."\s*,?\s*\},\s*\{\s*status:\s*503\s*,?\s*\}\s*,?\s*\)/,
  );
  assert.match(sign, /if \(!isServiceRoleConfigured\) return NextResponse\.json\(\{ urls: \{\} \}\)/);
  assert.match(
    ready,
    /if \(!isServiceRoleConfigured\) return NextResponse\.json\(\{ ready: false, reason: "service-role-missing" \}\)/,
  );
});

test("DemoAttachmentProvider mirrors AttachmentProvider shape and gates itself behind an isReady() capability probe", async () => {
  const source = await read("services/attachments/demo-attachment-provider.ts");
  assert.match(source, /class DemoAttachmentProvider implements AttachmentProvider/);
  assert.match(source, /async isReady\(\): Promise<boolean>/);
  assert.match(source, /fetch\("\/api\/demo-attachments\/ready"\)/);
  assert.match(source, /fetch\("\/api\/demo-attachments\/upload", \{ method: "POST", body: form \}\)/);
});

test("TransactionChatWorkspace falls back to the session-only LocalAttachmentProvider unless a ready DemoAttachmentProvider is explicitly passed in — no behavior change for Real", async () => {
  const source = await read("components/transactions/TransactionChatWorkspace.tsx");
  const occurrences =
    source.match(
      /useRemoteAttachments\s*\?\s*supabaseAttachmentProvider\s*:\s*\(demoAttachmentProvider\s*\?\?\s*attachmentProvider\)/g,
    ) ?? [];
  assert.equal(occurrences.length, 4, "expected all 4 provider-selection sites to use the same fallback chain");
});

test("Demo attachment provider is only ever wired up for the dealer/shop Demo roles, never for a Real (Supabase-authenticated) session", async () => {
  const source = await read("app/page.tsx");
  assert.match(source, /if \(useSupabaseData \|\| !isDemoAccountId\(account\.id\) \|\| role === "admin"\) return;/);
  assert.match(
    source,
    /demoAttachmentProvider=\{!useSupabaseData && demoAttachmentsReady \? demoAttachmentProvider : undefined\}/,
  );
});

test("demo-chat-repository re-signs stored attachment paths on every load but is a no-op (no network call) when no message carries a storagePath", async () => {
  const source = await read("repositories/demo-chat-repository.ts");
  assert.match(source, /async function resignAttachmentUrls\(rooms: ChatRoom\[\]\): Promise<ChatRoom\[\]>/);
  assert.match(source, /if \(paths\.length === 0\) return rooms;/);
  assert.match(source, /fetch\("\/api\/demo-attachments\/sign"/);
  assert.match(source, /return resignAttachmentUrls\(rooms\);/);
});

test("Demo text-only Messenger path is untouched — addMessage/markRead/subscribe signatures unchanged", async () => {
  const source = await read("repositories/demo-chat-repository.ts");
  assert.match(source, /async addMessage\(roomId: string, message: TransactionChatMessage\)/);
  assert.match(source, /async markRead\(roomId: string, readerId: string\)/);
  // subscribe now hands the listener the affected room id so the store can
  // refresh one conversation instead of every room (chat pagination). Still a
  // single listener taking no required argument, so callers that ignore it are
  // unaffected — which is what this guard is really protecting.
  assert.match(source, /subscribe\(listener: \(roomId\?: string\) => void\)/);
});
