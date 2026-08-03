import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Admin weekly transaction volume chart is computed from real transactions, not a hardcoded fixture", async () => {
  const source = await read("components/admin/AdminOverview.tsx");
  assert.doesNotMatch(source, /\[38, 52, 44, 68, 58, 82, 72\]/);
  assert.match(source, /function weeklyVolume\(transactions: Transaction\[\]\)/);
  assert.match(source, /new Date\(item\.status\.createdAt\)/);
  assert.match(source, /volume\.map\(\(count, index\)/);
});
