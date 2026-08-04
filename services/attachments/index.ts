import { LocalAttachmentProvider } from "./attachment-provider";
import { SupabaseAttachmentProvider } from "./supabase-attachment-provider";
import { DemoAttachmentProvider } from "./demo-attachment-provider";

export const attachmentProvider = new LocalAttachmentProvider();
export const supabaseAttachmentProvider = new SupabaseAttachmentProvider();
export const demoAttachmentProvider = new DemoAttachmentProvider();
export type { AttachmentProvider } from "./attachment-provider";
