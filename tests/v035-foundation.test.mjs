import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("v0.3.5 defines the four recommended package tiers and ranges", async () => {
  const source = await readFile(new URL("../data/pricePackages.ts", import.meta.url), "utf8");
  for (const tier of ["ENTRY", "STANDARD", "PREMIUM", "SIGNATURE"]) assert.match(source, new RegExp(`name: "${tier}"`));
  for (const range of ["40~60만원", "60~90만원", "90~130만원", "상담 후 견적"]) assert.match(source, new RegExp(range));
});

test("installers without coordinates remain visible with an explicit label", async () => {
  const source = await readFile(new URL("../services/installer-search.ts", import.meta.url), "utf8");
  assert.match(source, /shop\.lat == null \|\| shop\.lng == null/);
  assert.match(source, /거리 정보 없음/);
  assert.match(source, /a\.distanceKm == null/);
});

test("v0.3.5 migration contains participant RLS, private storage and realtime", async () => {
  const source = await readFile(new URL("../supabase/migrations/202607210001_v035_foundation.sql", import.meta.url), "utf8");
  assert.match(source, /create table public\.transactions/);
  assert.match(source, /create table public\.transaction_rooms/);
  assert.match(source, /create table public\.chat_messages/);
  assert.match(source, /'transaction-attachments', 'transaction-attachments', false/);
  assert.match(source, /public\.can_access_room/);
  assert.match(source, /supabase_realtime add table public\.chat_messages/);
});
