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

export function validateChatAttachment(file: Pick<File, "name" | "size" | "type">) {
  if (file.size <= 0) throw new Error("내용이 없는 파일은 첨부할 수 없습니다.");
  if (file.size > CHAT_ATTACHMENT_MAX_BYTES) throw new Error("첨부파일은 10MB 이하만 업로드할 수 있습니다.");
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const allowedType = CHAT_ATTACHMENT_TYPES.includes(file.type as typeof CHAT_ATTACHMENT_TYPES[number]);
  const allowedExtension = CHAT_ATTACHMENT_EXTENSIONS.includes(extension as typeof CHAT_ATTACHMENT_EXTENSIONS[number]);
  if (!allowedType || !allowedExtension) {
    throw new Error("JPG, PNG, WEBP, PDF, TXT, DOC, DOCX, XLS, XLSX 파일만 첨부할 수 있습니다.");
  }
}

/**
 * Prototype provider: keeps the file in a browser object URL only.
 * Replace this provider with a cloud uploader before production use.
 */
export class LocalAttachmentProvider implements AttachmentProvider {
  async prepare(file: File): Promise<ChatAttachment> {
    validateChatAttachment(file);
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
