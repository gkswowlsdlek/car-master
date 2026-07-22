import { isSupabaseConfigured } from "../../lib/supabase/config";
import { SupabaseAuthProvider } from "./supabase-auth-provider";
import { UnconfiguredAuthProvider } from "./unconfigured-auth-provider";
import type { AuthProvider } from "./auth-provider";

export const authProvider: AuthProvider = isSupabaseConfigured ? new SupabaseAuthProvider() : new UnconfiguredAuthProvider();
export type { AuthCredentials, AuthProvider } from "./auth-provider";
export { AUTH_INITIALIZATION_TIMEOUT_MS, initializeAuth, routeAfterAuthInitialization } from "./auth-initialization";
