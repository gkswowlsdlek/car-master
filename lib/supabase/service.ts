import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./config";

// Server-only Supabase client using the privileged secret key. This bypasses
// RLS entirely, so it exists ONLY for app/api/demo-attachments/* route
// handlers, which authorize every call themselves (verifyDemoSession +
// room-membership check) before ever touching this client. Never import
// this file from a "use client" component. It's still safe if that ever
// happened by mistake: neither env var below has a NEXT_PUBLIC_ prefix, so
// Next.js never inlines either into a client bundle — it would just read as
// undefined in the browser and isServiceRoleConfigured would be false, not
// leak the key.
//
// SUPABASE_SECRET_KEY is Supabase's current-generation server key name
// (replacing the legacy "service_role" key going forward). SUPABASE_SERVICE_ROLE_KEY
// is kept as a fallback for projects that still only have the legacy key
// configured. Whichever is read, it must never be prefixed NEXT_PUBLIC_ and
// must only ever be set as a server-side Vercel environment variable.
const serverKey = (process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) ?? "";
export const isServiceRoleConfigured = Boolean(supabaseUrl && serverKey);

export function createSupabaseServiceClient() {
  if (!isServiceRoleConfigured) throw new Error("SUPABASE_SECRET_KEY(또는 SUPABASE_SERVICE_ROLE_KEY)가 설정되지 않았습니다.");
  return createClient(supabaseUrl, serverKey, { auth: { autoRefreshToken: false, persistSession: false } });
}
