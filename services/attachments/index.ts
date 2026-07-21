import { LocalAttachmentProvider } from "./attachment-provider";
import { SupabaseAttachmentProvider } from "./supabase-attachment-provider";

export const attachmentProvider = new LocalAttachmentProvider();
export const supabaseAttachmentProvider = new SupabaseAttachmentProvider();
export type { AttachmentProvider } from "./attachment-provider";
