import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { demoInstallerListings } from "../data/installer-directory-demo.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

/* repositories/*.ts는 확장자 없는 상대 임포트("./storage")를 써서 Node ESM이
   직접 로드하지 못한다(앱은 번들러가 해석). 그래서 시드 데이터는 이 저장소의
   다른 테스트들과 같은 방식으로 소스에서 읽어 검사한다. */
const transactionSource = await read("repositories/transaction-repository.ts");
const chatSource = await read("repositories/chat-repository.ts");
const seedBlock = transactionSource.slice(
  transactionSource.indexOf("const DEMO_SEEDS: SeedInput[] = ["),
  transactionSource.indexOf("function demoSeedTransactions()"),
);
const seedEntries = seedBlock.split(/\n  \{\n/).slice(1);
const field = (entry, name) => entry.match(new RegExp(`${name}: (?:"([^"]*)"|([^,\n]+)),`))?.slice(1).find(Boolean);
const seeds = seedEntries.map((entry) => ({
  id: field(entry, "id"),
  installerId: field(entry, "installerId"),
  installerName: field(entry, "installerName"),
  stage: field(entry, "stage"),
  entry,
}));

/* ── Demo 데이터 ───────────────────────────────────────────────────────── */

test("데모 딜러는 서비스가 돌아가는 것처럼 보이는 분량의 거래를 갖는다 (10~15건)", () => {
  assert.ok(seeds.length >= 10 && seeds.length <= 15, `expected 10-15 demo transactions, got ${seeds.length}`);
  assert.equal(new Set(seeds.map((item) => item.id)).size, seeds.length, "demo transaction ids must be unique");
});

test("거래 단계가 한쪽에 몰리지 않는다 — 견적/시공예약/입고/작업완료/출고/취소가 모두 최소 1건", () => {
  const byStage = new Map();
  for (const item of seeds) byStage.set(item.stage, (byStage.get(item.stage) ?? 0) + 1);
  for (const stage of ["견적", "시공예약", "입고", "작업완료", "출고", "취소"]) {
    assert.ok(byStage.get(stage) >= 1, `stage ${stage} has no demo transaction`);
  }
  // 거래관리 탭(진행중/완료/종료)이 전부 채워지는지.
  const terminal = byStage.get("취소") ?? 0;
  const released = byStage.get("출고") ?? 0;
  assert.ok(terminal >= 1 && released >= 1 && seeds.length - terminal - released >= 5);
});

test("데모 거래의 시공점은 전부 기존 데모 디렉터리에서 골라 쓴다 — 업체명을 새로 지어내지 않는다", () => {
  const known = new Map(demoInstallerListings.map((shop) => [shop.id, shop.name]));
  for (const item of seeds) {
    assert.ok(known.has(item.installerId), `${item.id} references unknown shop ${item.installerId}`);
    assert.equal(item.installerName, known.get(item.installerId), `${item.id} shop name drifted from the directory`);
  }
});

test("차량·고객 정보는 일부만 채워져 있다 — 실제 운영처럼, 그리고 '미등록' 렌더 경로가 죽지 않게", () => {
  const withPlate = seeds.filter((item) => /vehicleNumber: "/.test(item.entry)).length;
  assert.ok(withPlate >= 2, "expected some demo deals to carry a vehicle number");
  assert.ok(seeds.length - withPlate >= 2, "expected some demo deals to still be missing a vehicle number");
  const withCustomer = seeds.filter((item) => /customerName: "/.test(item.entry)).length;
  assert.ok(withCustomer >= 2 && withCustomer < seeds.length);
  const withFinalPrice = seeds.filter((item) => /finalPrice: \d/.test(item.entry)).length;
  assert.ok(withFinalPrice >= 2 && withFinalPrice < seeds.length);
});

test("시드 타임스탬프는 항상 과거다 — '오늘 15시'로 찍으면 오전에 열었을 때 미래가 되어 전부 '방금'으로 표시된다", () => {
  // created/updated는 '몇 시간 전'으로만 표현하고, 벽시계 시각(seedDateAt)은
  // 미래일 수 있는 일정(입고/출고 예정일)에만 쓴다.
  assert.match(transactionSource, /const createdAt = shared \? DEMO_SEED_CREATED_AT : seedHoursAgo\(/);
  assert.match(transactionSource, /const updatedAt = shared \? DEMO_SEED_CREATED_AT : seedHoursAgo\(/);
  for (const item of seeds) {
    assert.match(item.entry, /createdHoursAgo: \d+/, `${item.id} must stamp createdAt relative to now`);
    assert.match(item.entry, /updatedHoursAgo: \d+/, `${item.id} must stamp updatedAt relative to now`);
  }
});

test("거래 로그는 손으로 나열하지 않고 현재 단계에서 파생된다 — 둘이 어긋날 수 없게", () => {
  assert.match(transactionSource, /const STAGE_PATH: Record<SeedStage,/);
  assert.match(transactionSource, /stageLog: seedStageLog\(input\.id, input\.stage, createdAt, updatedAt\)/);
  // 각 경로의 마지막 단계가 그 키와 같아야 한다.
  const pathBlock = transactionSource.slice(
    transactionSource.indexOf("const STAGE_PATH"),
    transactionSource.indexOf("/** Spreads the path's events"),
  );
  for (const stage of ["견적", "시공예약", "입고", "작업완료", "출고", "취소"]) {
    const arm = pathBlock.slice(pathBlock.indexOf(`\n  ${stage}: `));
    const end = arm.indexOf("],") === -1 ? arm.indexOf("]") : arm.indexOf("],");
    const stages = [...arm.slice(0, end).matchAll(/stage: "([^"]+)"/g)].map((m) => m[1]);
    assert.equal(stages[stages.length - 1], stage, `STAGE_PATH.${stage} does not end at ${stage}`);
  }
});

test("1/1 ↔ 2/2 공유 거래방(CHAT-DEMO-0001)은 그대로 유지된다 — 로컬 시드가 그 방을 덮어쓰지 않는다", () => {
  const shared = seeds.find((item) => item.id === "CM-DEMO-0001");
  assert.equal(shared.installerId, "SHOP-MISA-001");
  assert.match(shared.entry, /chatRoomId: "CHAT-DEMO-0001"/);
  assert.match(transactionSource, /const shared = input\.id === "CM-DEMO-0001";/);
  assert.match(transactionSource, /export const SHARED_DEMO_ROOM_IDS = new Set\(\["CHAT-DEMO-0001"\]\);/);
  assert.doesNotMatch(chatSource, /n: "0001"/, "CHAT-DEMO-0001 must stay in the shared demo_chat_* backend");
});

test("메시지 화면이 비어 보이지 않게 대화도 함께 시드된다 — 다만 전부는 아니다(대화 없는 거래도 정상 상태)", () => {
  const roomNumbers = [...chatSource.matchAll(/\n    n: "(\d{4})"/g)].map((m) => m[1]);
  assert.ok(roomNumbers.length >= 5, `expected several seeded conversations, got ${roomNumbers.length}`);
  assert.ok(roomNumbers.length < seeds.length, "some demo deals must have no conversation yet");
  const seedIds = new Set(seeds.map((item) => item.id));
  for (const n of roomNumbers) {
    assert.ok(seedIds.has(`CM-DEMO-${n}`), `CHAT-DEMO-${n} points at a transaction that does not exist`);
  }
  // 시공점 id도 거래의 것과 같아야 발신자가 엉뚱한 업체로 찍히지 않는다.
  const roomShops = [...chatSource.matchAll(/\n    n: "(\d{4})",\n    shopId: "([^"]+)"/g)];
  for (const [, n, shopId] of roomShops) {
    assert.equal(seeds.find((item) => item.id === `CM-DEMO-${n}`).installerId, shopId, `CHAT-DEMO-${n} shop mismatch`);
  }
  assert.match(chatSource, /unread: \d/, "expected at least one unread demo conversation");
});

/* ── 신뢰 지표 금지 ─────────────────────────────────────────────────────── */

test("시공점 목록 어디에도 평점·리뷰수·응답시간·누적 거래건수가 없다 (decisions.md: 가짜 평점·리뷰·거래건수 폐기)", async () => {
  for (const shop of demoInstallerListings) {
    for (const banned of ["rating", "reviewCount", "responseTime", "recentTransactionCount", "nextAvailableDate"]) {
      assert.ok(!(banned in shop), `demo listing ${shop.id} still carries ${banned}`);
    }
  }
  // 타입에서도 사라져야 새로 붙이는 순간 컴파일이 막힌다.
  const flowTypes = await read("lib/dealer-flow-data.ts");
  assert.doesNotMatch(flowTypes, /rating|responseTime|recentTransactionCount/);
  assert.doesNotMatch(await read("types/installer.ts"), /reviewCount|nextAvailableDate/);
  // 실 디렉터리도 0/placeholder를 채워 넣지 않는다.
  assert.doesNotMatch(await read("repositories/installer-directory-repository.ts"), /rating|reviewCount|responseTime/);
});

test("딜러 화면 어디에도 신뢰 지표를 그리지 않는다", async () => {
  for (const path of [
    "components/dealer/InstallerCard.tsx",
    "components/dealer/InstallerDetailPanel.tsx",
    "components/dealer/InstallerDirectoryScreen.tsx",
    "components/dealer/ServiceRequestScreen.tsx",
    "services/installer-search.ts",
  ]) {
    assert.doesNotMatch(await read(path), /\.rating|reviewCount|responseTime|recentTransactionCount/, path);
  }
});

test("데모 거래도 실적처럼 읽히는 수치를 만들지 않는다 — 고객 전화번호는 미할당 대역만 쓴다", () => {
  assert.match(transactionSource, /const seedCustomerPhone = \(suffix: string\) => `010-0000-\$\{suffix\}`;/);
  for (const item of seeds) {
    const literal = item.entry.match(/customerPhone: "([^"]+)"/);
    assert.equal(literal, null, `${item.id} should build its phone through seedCustomerPhone()`);
  }
  for (const banned of ["rating", "reviewCount", "responseTime", "recentTransactionCount"]) {
    assert.doesNotMatch(seedBlock, new RegExp(banned), `demo seeds must not carry ${banned}`);
  }
});

/* ── 빈/로딩/오류/권한없음 상태 ─────────────────────────────────────────── */

test("빈 상태는 공용 컴포넌트 한 곳에서 나온다 — 화면마다 다른 문구·다른 여백으로 흩어지지 않게", async () => {
  for (const path of [
    "components/dealer/DealerDashboard.tsx",
    "components/dealer/InstallerDirectoryScreen.tsx",
    "components/messenger/MessengerScreen.tsx",
    "components/transactions/DealerTransactionManagementScreen.tsx",
  ]) {
    assert.match(await read(path), /from "\.\.\/common\/ScreenState"/, path);
  }
});

test("빈 상태 아이콘은 lucide만 쓴다 — 이모지는 OS마다 다르게 렌더되고 '만들다 만 데모'로 읽힌다", async () => {
  const stateSource = await read("components/common/ScreenState.tsx");
  assert.match(stateSource, /from "lucide-react"/);
  // 즐겨찾기 ★ 같은 기존 기호 글리프는 대상이 아니다 — 컬러 이모지만 막는다.
  for (const path of [
    "components/common/ScreenState.tsx",
    "components/dealer/InstallerDirectoryScreen.tsx",
    "components/messenger/MessengerScreen.tsx",
    "components/transactions/DealerTransactionManagementScreen.tsx",
  ]) {
    assert.doesNotMatch(await read(path), /\p{Extended_Pictographic}/u, path);
  }
});

test("신규 딜러 대시보드는 빈 카드 세 개가 아니라 시작 경로 하나를 보여준다", async () => {
  const dashboard = await read("components/dealer/DealerDashboard.tsx");
  assert.match(dashboard, /const FIRST_RUN_STEPS = \[/);
  assert.match(dashboard, /\) : deals\.length === 0 \? \(/);
  assert.match(dashboard, /steps=\{FIRST_RUN_STEPS\}/);
});

test("불러오는 중과 비어 있음을 구분한다 — 첫 로드에 빈 상태가 잠깐 스쳐 지나가지 않게", async () => {
  const dashboard = await read("components/dealer/DealerDashboard.tsx");
  assert.match(dashboard, /loading && deals\.length === 0 \? \(\s*<SkeletonList/);
  assert.match(dashboard, /loadError && deals\.length === 0 \? \(\s*<ErrorState/);
  const messenger = await read("components/messenger/MessengerScreen.tsx");
  assert.match(messenger, /isLoading \? \(\s*<SkeletonList/);
  assert.match(messenger, /loadError \? \(\s*<ErrorState/);
  // 거래방을 못 받아온 경우가 영원한 "잠시만 기다려 주세요"로 남지 않는다.
  const room = await read("components/transactions/TransactionChatWorkspace.tsx");
  assert.match(room, /roomLoading \? \([\s\S]*?\) : \(\s*<ErrorState/);
});

test("권한이 없어 비어 있는 화면은 '데이터 없음'과 다르게 말한다", async () => {
  const workspace = await read("components/workspaces/DealerWorkspace.tsx");
  assert.match(workspace, /screen === "shopSearchRequests" && !useSupabaseData/);
  assert.match(workspace, /<PermissionState/);
});

test("기준 지역이 없으면 카드마다 '거리 정보 없음'을 붙이지 않고, 그 자리에서 기준 주소를 받는다", async () => {
  const directory = await read("components/dealer/InstallerDirectoryScreen.tsx");
  assert.match(directory, /distanceLabel=\{km == null \? "" : distanceLabel\}/);
  assert.match(directory, /!distanceOrigin && onSearchAddress/);
  assert.match(directory, /installer-origin-prompt/);
  // 주소를 못 찾으면 조용히 실패하지 않는다.
  assert.match(directory, /setOriginError\(/);
});

/* ── 카드 속 카드 ───────────────────────────────────────────────────────── */

test("거래방 사이드바 섹션은 카드가 아니라 구분선으로 나뉜다 — 패널 안에 카드가 겹겹이 쌓이지 않게", async () => {
  const css = await read("styles/transactions.css");
  const block = css.slice(
    css.indexOf(".sidebar-stage,\n.sidebar-settlement,\n.sidebar-stage-log {"),
    css.indexOf(".sidebar-stage > span {"),
  );
  assert.ok(block.length > 0, "expected the flattened sidebar-section rule");
  assert.match(block, /border: 0;/);
  assert.match(block, /background: transparent;/);
  assert.match(block, /border-top: 1px solid var\(--color-line\);/);
  // 강조는 실제로 눌러야 하는 "지금 할 일" 한 곳에만, 그것도 누를 게 있을 때만.
  assert.match(css, /\.sidebar-next-step:has\(button\) \{[^}]*background: var\(--color-surface-soft\);/);
});
