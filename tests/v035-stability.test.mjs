import assert from "node:assert/strict";
import test from "node:test";
import { normalizeChatMessages } from "../services/chat-message-normalizer.ts";
import { readCollection, writeCollection } from "../repositories/storage.ts";
import { validateChatAttachment } from "../services/attachments/attachment-provider.ts";

test("chat messages are de-duplicated and sorted deterministically", () => {
  const base = { room_id: "room-1", sender_id: "dealer-1", sender_role: "dealer", text: "메시지", attachments: [] };
  const messages = normalizeChatMessages([
    { ...base, id: "b", created_at: "2026-07-21T01:00:01.000Z" },
    { ...base, id: "a", created_at: "2026-07-21T01:00:00.000Z" },
    { ...base, id: "a", created_at: "2026-07-21T01:00:00.000Z" },
  ]);
  assert.deepEqual(messages.map((message) => message.id), ["a", "b"]);
});

test("chat attachment validation rejects empty, oversized and mismatched files", () => {
  assert.throws(() => validateChatAttachment({ name: "empty.pdf", size: 0, type: "application/pdf" }), /내용이 없는 파일/);
  assert.throws(() => validateChatAttachment({ name: "large.pdf", size: 10 * 1024 * 1024 + 1, type: "application/pdf" }), /10MB 이하/);
  assert.throws(() => validateChatAttachment({ name: "photo.exe", size: 100, type: "image/jpeg" }), /파일만 첨부/);
  assert.doesNotThrow(() => validateChatAttachment({ name: "견적서.PDF", size: 100, type: "application/pdf" }));
});

test("local collections preserve legacy arrays and fail safely on corrupt JSON", () => {
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  globalThis.window = {
    dispatchEvent() {}, addEventListener() {}, removeEventListener() {},
  };

  values.set("legacy", JSON.stringify([{ id: "old" }]));
  assert.deepEqual(readCollection("legacy"), [{ id: "old" }]);
  assert.match(values.get("legacy"), /"version":1/);
  values.set("broken", "{not-json");
  assert.deepEqual(readCollection("broken"), []);
  writeCollection("current", [{ id: "new" }]);
  assert.deepEqual(readCollection("current"), [{ id: "new" }]);

  delete globalThis.window;
  delete globalThis.localStorage;
});
