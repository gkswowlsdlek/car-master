import { NextResponse, type NextRequest } from "next/server";
import { demoSessionCookie, verifyDemoSession } from "../../../../lib/demo-session";
import { createSupabaseServiceClient, isServiceRoleConfigured } from "../../../../lib/supabase/service";
import { validateChatAttachment } from "../../../../services/attachments/attachment-provider";
import { DEMO_ATTACHMENTS_BUCKET } from "../../../../lib/demo-attachments-config";

const safeName = (name: string) =>
  name
    .normalize("NFKC")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(-120) || "attachment";

// Only Demo Dealer 1/1 and Demo Installer 2/2 exchange Messenger attachments.
// Demo Admin 3/3 never needs this and is deliberately excluded.
function isChatRole(role: string | null): role is "dealer" | "shop" {
  return role === "dealer" || role === "shop";
}

export async function POST(request: NextRequest) {
  if (!isServiceRoleConfigured)
    return NextResponse.json({ error: "Demo 첨부 기능이 아직 설정되지 않았습니다." }, { status: 503 });

  const role = await verifyDemoSession(request.cookies.get(demoSessionCookie)?.value);
  if (!isChatRole(role)) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const roomId = form?.get("roomId");
  if (!(file instanceof File) || typeof roomId !== "string" || !roomId) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  try {
    validateChatAttachment(file);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "잘못된 파일입니다." }, { status: 400 });
  }

  const client = createSupabaseServiceClient();

  // Room must be a real, already-seeded Demo room — this is what stops a
  // caller with a valid Demo cookie from uploading into an arbitrary/guessed
  // room id. Every Demo chat room is shared by both Demo accounts, so no
  // further per-account membership check is needed beyond "this room exists".
  const { data: room, error: roomError } = await client
    .from("demo_chat_rooms")
    .select("id")
    .eq("id", roomId)
    .maybeSingle();
  if (roomError || !room) return NextResponse.json({ error: "거래방을 확인할 수 없습니다." }, { status: 403 });

  const id = crypto.randomUUID();
  const storagePath = `demo/${roomId}/${id}/${safeName(file.name)}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: uploadError } = await client.storage
    .from(DEMO_ATTACHMENTS_BUCKET)
    .upload(storagePath, bytes, { upsert: false, contentType: file.type });
  if (uploadError) return NextResponse.json({ error: "파일 업로드에 실패했습니다." }, { status: 500 });

  const { data: signed, error: signedError } = await client.storage
    .from(DEMO_ATTACHMENTS_BUCKET)
    .createSignedUrl(storagePath, 3600);
  if (signedError || !signed?.signedUrl) {
    await client.storage.from(DEMO_ATTACHMENTS_BUCKET).remove([storagePath]);
    return NextResponse.json(
      { error: "첨부파일 접근 주소를 만들지 못했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    id,
    name: file.name,
    type: file.type || "application/octet-stream",
    size: file.size,
    url: signed.signedUrl,
    storagePath,
    kind: file.type.startsWith("image/") ? "image" : "file",
    persistence: "remote",
    createdAt: new Date().toISOString(),
  });
}

export async function DELETE(request: NextRequest) {
  if (!isServiceRoleConfigured) return NextResponse.json({ ok: true });
  const role = await verifyDemoSession(request.cookies.get(demoSessionCookie)?.value);
  if (!isChatRole(role)) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { storagePath?: string } | null;
  const storagePath = body?.storagePath;
  if (!storagePath || !storagePath.startsWith("demo/"))
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });

  const { error } = await createSupabaseServiceClient().storage.from(DEMO_ATTACHMENTS_BUCKET).remove([storagePath]);
  if (error) return NextResponse.json({ error: "삭제에 실패했습니다." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
