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
  assert.match(source, /setDetailPanel/);
  assert.match(source, /messenger-more-menu/);
  assert.match(source, /이 거래방 숨기기/);
  assert.match(source, /거래 상세 보기/);
  assert.match(source, /시공점 정보 보기/);
});

test("service request uses structured regions and a constrained native date input", async () => {
  const source = await read("components/dealer/ServiceRequestForm.tsx");
  const regions = await read("data/administrative-regions.ts");
  assert.match(source, /시도 선택/);
  assert.match(source, /시군구 선택/);
  assert.match(source, /type="date"/);
  assert.match(source, /min=\{today\}/);
  assert.match(source, /onFindShops\(area\)/);
  assert.match(source, /administrativeRegions/);
  assert.equal(
    (regions.match(/"[^"]+구"/g) ?? []).filter((item) =>
      [
        "강남구",
        "강동구",
        "강북구",
        "강서구",
        "관악구",
        "광진구",
        "구로구",
        "금천구",
        "노원구",
        "도봉구",
        "동대문구",
        "동작구",
        "마포구",
        "서대문구",
        "서초구",
        "성동구",
        "성북구",
        "송파구",
        "양천구",
        "영등포구",
        "용산구",
        "은평구",
        "종로구",
        "중구",
        "중랑구",
      ].includes(item.slice(1, -1)),
    ).length >= 25,
    true,
  );
  for (const region of [
    "서울",
    "부산",
    "대구",
    "인천",
    "광주",
    "대전",
    "울산",
    "세종",
    "경기",
    "강원",
    "충북",
    "충남",
    "전북",
    "전남",
    "경북",
    "경남",
    "제주",
  ])
    assert.match(regions, new RegExp(`${region}:`));
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
  // Messenger's Inbox-pane rules moved to styles/messenger.css; the chat-pane rules asserted
  // below stayed in app/globals.css because they're shared with the embedded Transaction-room
  // chat (TransactionChatWorkspace.tsx) — read both so the assertions still cover the union of
  // what used to be one file.
  const css = (await read("app/globals.css")) + (await read("styles/messenger.css"));
  assert.match(css, /@media \(min-width: 1024px\)/);
  assert.match(css, /height: calc\(100dvh - 126px\)/);
  assert.match(css, /\.messenger-layout\s*\{[^}]*grid-template-columns:\s*60px\s+minmax\(0,\s*1fr\)/s);
  assert.match(
    css,
    /\.messenger-layout\.list-open\s*\{[^}]*grid-template-columns:\s*60px\s+clamp\(230px,\s*20vw,\s*280px\)\s+minmax\(0,\s*1fr\)/s,
  );
  assert.match(
    css,
    /\.messenger-chat-pane\s*>\s*\.messenger-workspace[^}]+grid-template-columns:\s*minmax\(0,\s*1fr\)/s,
  );
  assert.match(css, /\.messenger-chat-pane \.messenger-sidebar\.mobile-open/);
  assert.match(css, /\.app-frame\.mobile-chat-fullscreen \.messenger-workspace/);
});
