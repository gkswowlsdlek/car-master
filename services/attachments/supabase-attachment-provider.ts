import { createSupabaseBrowserClient } from "../../lib/supabase/client";
import type { ChatAttachment } from "../../types/transactions";
import { CHAT_ATTACHMENT_EXTENSIONS, CHAT_ATTACHMENT_MAX_BYTES, CHAT_ATTACHMENT_TYPES, type AttachmentProvider } from "./attachment-provider";

const safeName = (name: string) => name.normalize("NFKC").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);

export class SupabaseAttachmentProvider implements AttachmentProvider {
  async prepare(file: File, roomId?: string): Promise<ChatAttachment> {
    if (!roomId) throw new Error("거래방을 확인할 수 없습니다.");
    if (file.size > CHAT_ATTACHMENT_MAX_BYTES) throw new Error("첨부파일은 10MB 이하만 업로드할 수 있습니다.");
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!CHAT_ATTACHMENT_TYPES.includes(file.type as typeof CHAT_ATTACHMENT_TYPES[number]) || !CHAT_ATTACHMENT_EXTENSIONS.includes(extension as typeof CHAT_ATTACHMENT_EXTENSIONS[number])) throw new Error("JPG, PNG, WEBP, PDF, TXT, DOC, DOCX, XLS, XLSX 파일만 첨부할 수 있습니다.");
    const client = createSupabaseBrowserClient();
    const id = crypto.randomUUID();
    const storagePath = `${roomId}/${id}/${safeName(file.name)}`;
    const { error } = await client.storage.from("transaction-attachments").upload(storagePath, file, { upsert: false, contentType: file.type });
    if (error) throw new Error(`파일 업로드에 실패했습니다: ${error.message}`);
    const { data } = await client.storage.from("transaction-attachments").createSignedUrl(storagePath, 3600);
    return { id, name: file.name, type: file.type, size: file.size, url: data?.signedUrl ?? "", storagePath, kind: file.type.startsWith("image/") ? "image" : "file", persistence: "remote", createdAt: new Date().toISOString() };
  }
  release() { /* Remote files remain attached to the transaction. */ }
}
