import { demoAccounts } from "../../data/demo-accounts";
import { DemoAuthProvider } from "./demo-auth-provider";
import { isSupabaseConfigured } from "../../lib/supabase/config";
import { SupabaseAuthProvider } from "./supabase-auth-provider";
import { UnconfiguredAuthProvider } from "./unconfigured-auth-provider";

export const isDemoAuthMode = !isSupabaseConfigured && process.env.NODE_ENV === "development";
export const authProvider = isSupabaseConfigured ? new SupabaseAuthProvider() : isDemoAuthMode ? new DemoAuthProvider(demoAccounts) : new UnconfiguredAuthProvider();
export type { AuthCredentials, AuthProvider } from "./auth-provider";
