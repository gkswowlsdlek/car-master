import { demoAccounts } from "../../data/demo-accounts";
import { DemoAuthProvider } from "./demo-auth-provider";
import { isSupabaseConfigured } from "../../lib/supabase/config";
import { SupabaseAuthProvider } from "./supabase-auth-provider";

// Demo accounts are UI-only QA sessions. They do not create a Supabase
// session and therefore cannot bypass database RLS or server-side membership.
export const areDemoAccountsEnabled = true;
export const isDemoAuthMode = !isSupabaseConfigured;
export const authProvider = isSupabaseConfigured ? new SupabaseAuthProvider() : new DemoAuthProvider(demoAccounts);
export type { AuthCredentials, AuthProvider } from "./auth-provider";
