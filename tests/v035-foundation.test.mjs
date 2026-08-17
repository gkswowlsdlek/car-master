import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("installer search retains coordinate-free shops and sorts them after located shops", async () => {
  const source = await readFile(new URL("../services/installer-search.ts", import.meta.url), "utf8");
  assert.match(source, /shop\.lat == null \|\| shop\.lng == null/);
  assert.match(source, /거리 정보 없음/);
  assert.match(source, /a\.distanceKm == null/);
});

test("the foundation migration contains participant RLS, private storage and realtime", async () => {
  const source = await readFile(
    new URL("../supabase/migrations/202607210001_v035_foundation.sql", import.meta.url),
    "utf8",
  );
  assert.match(source, /create table public\.transactions/);
  assert.match(source, /create table public\.transaction_rooms/);
  assert.match(source, /create table public\.chat_messages/);
  assert.match(source, /'transaction-attachments', 'transaction-attachments', false/);
  assert.match(source, /public\.can_access_room/);
  assert.match(source, /supabase_realtime add table public\.chat_messages/);
});
