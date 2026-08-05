import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

// Server-side password-recovery confirmation. Exists because the PKCE
// `?code=` link (the old flow, still handled by app/auth/callback for
// signup confirmation) requires the SAME browser that called
// resetPasswordForEmail() to still have the code_verifier it stored in its
// own localStorage — confirmed by reading @supabase/auth-js's
// _exchangeCodeForSession source (GoTrueClient.js): it reads
// `${storageKey}-code-verifier` from `this.storage` and throws
// AuthPKCECodeVerifierMissingError if that key isn't there. A recovery
// email is almost always opened in a *different* browser/app (Gmail's
// in-app webview, a different device) than whichever browser requested the
// reset, so that verifier is never present — the exchange fails even on a
// genuinely first, fresh click.
//
// verifyOtp({ token_hash, type: 'recovery' }) has no such requirement (no
// codeVerifier lookup anywhere in its implementation) and its own source
// explicitly fires the PASSWORD_RECOVERY event on success — this is
// Supabase's documented Server-Side Auth pattern for exactly this case.
// The email template must point here via `{{ .TokenHash }}` instead of
// `{{ .ConfirmationURL }}` — see docs/... in the completion report for the
// exact template string.
//
// Never logs token_hash, the verifyOtp error, or any session/token value.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const next = "/update-password";

  if (tokenHash && type === "recovery") {
    try {
      const supabase = await createSupabaseServerClient();
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
      if (!error) return NextResponse.redirect(new URL(`${next}?verified=1`, url.origin));
    } catch {
      // Falls through to the generic verified=0 redirect below — never
      // surfaces a raw 500 to someone coming from a password-reset email.
    }
  }

  return NextResponse.redirect(new URL(`${next}?verified=0`, url.origin));
}
