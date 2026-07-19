import type { ChatAttachment } from "../../types/transactions";

export interface AttachmentProvider {
  prepare(file: File): Promise<ChatAttachment>;
  release(attachment: ChatAttachment): void;
}

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
