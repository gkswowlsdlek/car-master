import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./config";

// Server-only Supabase client using the service-role key. This bypasses RLS
// entirely, so it exists ONLY for app/api/demo-attachments/* route handlers,
// which authorize every call themselves (verifyDemoSession + room-membership
// check) before ever touching this client. Never import this file from a
// "use client" component. It's still safe if that ever happened by mistake:
// SUPABASE_SERVICE_ROLE_KEY has no NEXT_PUBLIC_ prefix, so Next.js never
// inlines it into a client bundle — it would just read as undefined in the
// browser and isServiceRoleConfigured would be false, not leak the key.
//
// SUPABASE_SERVICE_ROLE_KEY must never be prefixed NEXT_PUBLIC_ and must
// only ever be set as a server-side Vercel environment variable.
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
export const isServiceRoleConfigured = Boolean(supabaseUrl && serviceRoleKey);

export function createSupabaseServiceClient() {
  if (!isServiceRoleConfigured) throw new Error("SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.");
  return createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
}
