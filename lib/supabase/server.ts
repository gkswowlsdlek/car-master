import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabasePublishableKey, supabaseUrl } from "./config";

export async function createSupabaseServerClient() {
  if (!supabaseUrl || !supabasePublishableKey) throw new Error("Supabase 환경변수가 설정되지 않았습니다.");
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch { /* Server Components cannot always write cookies. */ }
      },
    },
  });
}
