import { isSupabaseConfigured } from "../../lib/supabase/config";
import { SupabaseAuthProvider } from "./supabase-auth-provider";
import { UnconfiguredAuthProvider } from "./unconfigured-auth-provider";

export const authProvider = isSupabaseConfigured ? new SupabaseAuthProvider() : new UnconfiguredAuthProvider();
export type { AuthCredentials, AuthProvider } from "./auth-provider";
