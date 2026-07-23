import { createSupabaseBrowserClient } from "../../lib/supabase/client";
import type { ChatAttachment } from "../../types/transactions";
import { validateChatAttachment, type AttachmentProvider } from "./attachment-provider";

const safeName = (name: string) => name.normalize("NFKC").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120) || "attachment";

export class SupabaseAttachmentProvider implements AttachmentProvider {
  async prepare(file: File, roomId?: string): Promise<ChatAttachment> {
    if (!roomId) throw new Error("거래방을 확인할 수 없습니다.");
    validateChatAttachment(file);
    const client = createSupabaseBrowserClient();
    const id = crypto.randomUUID();
    const storagePath = `${roomId}/${id}/${safeName(file.name)}`;
    const { error } = await client.storage.from("transaction-attachments").upload(storagePath, file, { upsert: false, contentType: file.type });
    if (error) throw new Error(`파일 업로드에 실패했습니다: ${error.message}`);
    const { data, error: signedUrlError } = await client.storage.from("transaction-attachments").createSignedUrl(storagePath, 3600);
    if (signedUrlError || !data?.signedUrl) {
      await client.storage.from("transaction-attachments").remove([storagePath]);
      throw new Error("첨부파일 접근 주소를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }
    return { id, name: file.name, type: file.type, size: file.size, url: data?.signedUrl ?? "", storagePath, kind: file.type.startsWith("image/") ? "image" : "file", persistence: "remote", createdAt: new Date().toISOString() };
  }
  release() { /* Remote files remain attached to the transaction. */ }
  async discard(attachment: ChatAttachment) {
    if (!attachment.storagePath) return;
    const { error } = await createSupabaseBrowserClient().storage.from("transaction-attachments").remove([attachment.storagePath]);
    if (error) console.warn("[attachments] Failed to remove an unlinked upload", error.message);
  }
}
