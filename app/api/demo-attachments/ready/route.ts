import { NextResponse } from "next/server";
import { createSupabaseServiceClient, isServiceRoleConfigured } from "../../../../lib/supabase/service";
import { DEMO_ATTACHMENTS_BUCKET } from "../../../../lib/demo-attachments-config";

// Capability probe for DemoAttachmentProvider — mirrors the isSchemaReady()
// pattern used by demo-transaction-repository.ts / demo-membership-repository.ts.
// Lets the client fall back to today's LocalAttachmentProvider (session-only
// blob URL) instead of throwing when SUPABASE_SERVICE_ROLE_KEY or the
// migration hasn't been applied yet.
export async function GET() {
  if (!isServiceRoleConfigured) return NextResponse.json({ ready: false, reason: "service-role-missing" });
  try {
    const { data, error } = await createSupabaseServiceClient().storage.getBucket(DEMO_ATTACHMENTS_BUCKET);
    if (error || !data) return NextResponse.json({ ready: false, reason: "bucket-missing" });
    return NextResponse.json({ ready: true });
  } catch {
    return NextResponse.json({ ready: false, reason: "error" });
  }
}
