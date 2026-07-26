import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("transaction management is operational and does not duplicate Messenger", async () => {
  const source = await read("components/transactions/TransactionManagementScreen.tsx");
  assert.doesNotMatch(source, /TransactionChatWorkspace/);
  assert.match(source, /거래 진행 단계/);
  assert.match(source, /메시지 열기/);
  assert.match(source, /STAGE_ACTION_LABEL/);
  assert.match(source, /transaction-detail-/);
});

test("Messenger header controls are connected to real local actions", async () => {
  const source = await read("components/transactions/TransactionChatWorkspace.tsx");
  assert.match(source, /setNotificationsMuted/);
  assert.match(source, /openContact/);
  assert.match(source, /setShowDetails/);
  assert.match(source, /messenger-more-menu/);
  assert.match(source, /이 거래방 숨기기/);
});

test("service request uses structured regions and a constrained native date input", async () => {
  const source = await read("components/dealer/ServiceRequestForm.tsx");
  assert.match(source, /시도 선택/);
  assert.match(source, /시군구 선택/);
  assert.match(source, /type="date"/);
  assert.match(source, /min=\{today\}/);
  assert.match(source, /onFindShops\(area\)/);
});

test("dealer profile formats phone, validates email, and uses compact toggles", async () => {
  const source = await read("components/profile/ProfileEditor.tsx");
  assert.match(source, /function formatPhone/);
  assert.match(source, /올바른 이메일 주소/);
  assert.match(source, /기본 활동지역/);
  assert.match(source, /toggle-input/);
  assert.match(source, /변경사항 저장/);
});

test("demo installers are deterministically offset from administrative reference points", async () => {
  const source = await read("data/installer-directory-demo.ts");
  assert.match(source, /137\.508/);
  assert.match(source, /demoLat/);
  assert.match(source, /demoLng/);
  assert.match(source, /isDemo: true/);
});

test("responsive rules cover requested desktop and mobile workspace behavior", async () => {
  const css = await read("app/globals.css");
  assert.match(css, /@media \(min-width: 1024px\)/);
  assert.match(css, /height: calc\(100dvh - 126px\)/);
  assert.match(css, /grid-template-columns: clamp\(220px,20vw,270px\) minmax\(0,1fr\)/);
  assert.match(css, /\.app-frame\.mobile-chat-fullscreen \.messenger-workspace/);
  assert.match(css, /@media \(max-width: 390px\)/);
});
