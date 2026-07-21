import type { ChatAttachment } from "../../types/transactions";

export interface AttachmentProvider {
  prepare(file: File, roomId?: string): Promise<ChatAttachment>;
  release(attachment: ChatAttachment): void;
}

export const CHAT_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const CHAT_ATTACHMENT_TYPES = [
  "image/jpeg", "image/png", "image/webp", "application/pdf", "text/plain", "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;
export const CHAT_ATTACHMENT_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "pdf", "txt", "doc", "docx", "xls", "xlsx"] as const;

/**
 * Prototype provider: keeps the file in a browser object URL only.
 * Replace this provider with a cloud uploader before production use.
 */
export class LocalAttachmentProvider implements AttachmentProvider {
  async prepare(file: File): Promise<ChatAttachment> {
    return {
      id: `ATT-${crypto.randomUUID()}`,
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
      url: URL.createObjectURL(file),
      kind: file.type.startsWith("image/") ? "image" : "file",
      persistence: "session",
      createdAt: new Date().toISOString(),
    };
  }

  release(attachment: ChatAttachment) {
    if (attachment.persistence === "session") URL.revokeObjectURL(attachment.url);
  }
}
