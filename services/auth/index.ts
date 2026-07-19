import { demoAccounts } from "../../data/demo-accounts";
import { DemoAuthProvider } from "./demo-auth-provider";
import { isSupabaseConfigured } from "../../lib/supabase/config";
import { SupabaseAuthProvider } from "./supabase-auth-provider";

// V0.3.4 beta fallback: keep the three role accounts available until
// Supabase is configured. This also allows preview/production builds to be
// tested without exposing a broken authentication screen.
export const isDemoAuthMode = !isSupabaseConfigured;
export const authProvider = isSupabaseConfigured ? new SupabaseAuthProvider() : new DemoAuthProvider(demoAccounts);
export type { AuthCredentials, AuthProvider } from "./auth-provider";
