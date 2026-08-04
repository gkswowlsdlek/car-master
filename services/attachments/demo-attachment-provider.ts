import type { ChatAttachment } from "../../types/transactions";
import { validateChatAttachment, type AttachmentProvider } from "./attachment-provider";

/**
 * Demo Messenger attachment provider — uploads through the server-only
 * /api/demo-attachments/* routes instead of talking to Supabase Storage
 * directly (Demo sessions are a signed cookie, not a real Supabase Auth
 * session, so they can't pass the storage RLS that gates the real
 * transaction-attachments bucket). Mirrors SupabaseAttachmentProvider's
 * shape so TransactionChatWorkspace can swap providers without other
 * changes.
 *
 * isReady() lets callers detect "SUPABASE_SERVICE_ROLE_KEY or the
 * demo-transaction-attachments bucket isn't set up yet" and fall back to
 * the existing LocalAttachmentProvider instead of throwing — same
 * graceful-degrade pattern as demo-transaction-repository.ts's
 * isSchemaReady().
 */
export class DemoAttachmentProvider implements AttachmentProvider {
  private readyPromise: Promise<boolean> | null = null;

  async isReady(): Promise<boolean> {
    if (!this.readyPromise) {
      this.readyPromise = (async () => {
        try {
          const response = await fetch("/api/demo-attachments/ready");
          if (!response.ok) return false;
          const data = await response.json().catch(() => null) as { ready?: boolean } | null;
          return data?.ready === true;
        } catch {
          return false;
        }
      })();
    }
    return this.readyPromise;
  }

  async prepare(file: File, roomId?: string): Promise<ChatAttachment> {
    if (!roomId) throw new Error("거래방을 확인할 수 없습니다.");
    validateChatAttachment(file);
    const form = new FormData();
    form.append("file", file);
    form.append("roomId", roomId);
    const response = await fetch("/api/demo-attachments/upload", { method: "POST", body: form });
    const body = await response.json().catch(() => null) as (ChatAttachment & { error?: string }) | null;
    if (!response.ok || !body) throw new Error(body?.error ?? "파일 업로드에 실패했습니다.");
    return body;
  }

  release() { /* Remote files remain attached to the transaction. */ }

  async discard(attachment: ChatAttachment) {
    if (!attachment.storagePath) return;
    try {
      await fetch("/api/demo-attachments/upload", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storagePath: attachment.storagePath }),
      });
    } catch (error) {
      console.warn("[demo-attachments] Failed to remove an unlinked upload", error);
    }
  }
}
