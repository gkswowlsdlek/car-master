#!/usr/bin/env node
// One-off, human-run backfill: geocodes every installer_shops row that still
// has latitude/longitude = NULL (every Admin-registered shop from before
// admin_register_shop started accepting coordinates, plus any future one
// where geocoding happened to fail at registration time) and fills in the
// real coordinates. Never fabricates a fallback coordinate — a shop whose
// address can't be geocoded is left NULL and reported, not guessed at.
//
// Deliberately NOT a SQL migration and NOT a client-callable RPC:
//   - Postgres has no built-in HTTP client here (would need pg_net or a
//     similar extension just for this one-time job — out of scope).
//   - This needs the Supabase SERVICE ROLE key (bypasses RLS) and the NAVER
//     Client Secret, both of which must only ever live in a trusted,
//     human-operated environment — never shipped to the browser, never
//     exposed as a button any authenticated user could click.
//
// Usage:
//   SUPABASE_SECRET_KEY=... NEXT_PUBLIC_SUPABASE_URL=... \
//   NEXT_PUBLIC_NAVER_MAP_CLIENT_ID=... NAVER_MAP_CLIENT_SECRET=... \
//   node --experimental-strip-types scripts/backfill-shop-coordinates.mjs [--dry-run]
//
// Prints a per-shop result line and a final summary. Safe to re-run: it only
// ever selects rows still missing coordinates, so an already-backfilled shop
// is simply skipped on the next run.

import { createClient } from "@supabase/supabase-js";
import { geocodeAddressViaNcp } from "../lib/ncp-geocode.ts";

const DRY_RUN = process.argv.includes("--dry-run");
// Stay well under NCP's default rate limit — this is a one-off batch job,
// not a latency-sensitive path, so there's no reason to push it.
const DELAY_MS = 250;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = (process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
const naverClientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID?.trim();
const naverClientSecret = process.env.NAVER_MAP_CLIENT_SECRET?.trim();

function requireEnv(name, value) {
  if (!value) {
    console.error(`Missing required env var: ${name}`);
    process.exitCode = 1;
    return false;
  }
  return true;
}

const ok = [
  requireEnv("NEXT_PUBLIC_SUPABASE_URL", supabaseUrl),
  requireEnv("SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY)", serviceKey),
  requireEnv("NEXT_PUBLIC_NAVER_MAP_CLIENT_ID", naverClientId),
  requireEnv("NAVER_MAP_CLIENT_SECRET", naverClientSecret),
].every(Boolean);
if (!ok) process.exit(1);

const supabase = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const credentials = { clientId: naverClientId, clientSecret: naverClientSecret };

async function main() {
  const { data: shops, error } = await supabase
    .from("installer_shops")
    .select("id, shop_name, address")
    .or("latitude.is.null,longitude.is.null");
  if (error) {
    console.error("Failed to list shops needing coordinates:", error.message);
    process.exit(1);
  }

  console.log(`${shops.length} shop(s) missing coordinates.${DRY_RUN ? " (dry run — no writes)" : ""}`);
  let updated = 0;
  let skipped = 0;

  for (const shop of shops) {
    const outcome = await geocodeAddressViaNcp(shop.address, credentials);
    if (!outcome.success) {
      console.log(`SKIP  ${shop.shop_name} (${shop.address}) — ${outcome.reason}`);
      skipped += 1;
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
      continue;
    }

    console.log(
      `${DRY_RUN ? "WOULD-UPDATE" : "UPDATE"}  ${shop.shop_name} (${shop.address}) -> ${outcome.latitude}, ${outcome.longitude}`,
    );
    if (!DRY_RUN) {
      const { error: updateError } = await supabase
        .from("installer_shops")
        .update({ latitude: outcome.latitude, longitude: outcome.longitude })
        .eq("id", shop.id);
      if (updateError) {
        console.log(`  -> FAILED to save: ${updateError.message}`);
        skipped += 1;
        await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
        continue;
      }
    }
    updated += 1;
    await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
  }

  console.log(`\nDone. ${updated} updated, ${skipped} skipped (left NULL — re-run later or fix the address).`);
}

await main();
