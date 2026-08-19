import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const normalize = (source) => source.replace(/\r\n?/g, "\n");

let migrationSource;
let typesSource;
let stateServiceSource;
let repoSource;
let actionsHookSource;
let chatWorkspaceSource;
let dealerListSource;
let shopDashboardSource;
let managementScreenSource;
let localRepoSource;
let demoRepoSource;
let dealerWorkspaceSource;

test.before(async () => {
  migrationSource = normalize(await read("supabase/migrations/202608190001_transaction_warranty_issuance.sql"));
  typesSource = normalize(await read("types/transactions.ts"));
  stateServiceSource = normalize(await read("services/transaction-state-service.ts"));
  repoSource = normalize(await read("repositories/supabase-transaction-repository.ts"));
  actionsHookSource = normalize(await read("hooks/use-transaction-actions.ts"));
  chatWorkspaceSource = normalize(await read("components/transactions/TransactionChatWorkspace.tsx"));
  dealerListSource = normalize(await read("components/transactions/DealerTransactionManagementScreen.tsx"));
  shopDashboardSource = normalize(await read("components/shop/ShopDashboard.tsx"));
  managementScreenSource = normalize(await read("components/transactions/TransactionManagementScreen.tsx"));
  localRepoSource = normalize(await read("repositories/transaction-repository.ts"));
  demoRepoSource = normalize(await read("repositories/demo-transaction-repository.ts"));
  dealerWorkspaceSource = normalize(await read("components/workspaces/DealerWorkspace.tsx"));
});

// 딜러가 시공 요청을 만드는 시점엔 고객명/연락처/차량번호가 없는 경우가
// 흔하다는 E2E 발견 사실을 다룬다. ServiceRequestForm은 이미 이 정보를
// 요구하지 않으므로(별도 확인 완료, 변경 없음) 여기서는 입고~출고 사이에
// 딜러가 채워 넣고 시공점이 발급 완료 처리하는 나머지 절반만 다룬다.

test("보증서 관련 컬럼 8개는 전부 additive — nullable이거나 안전한 기본값이라 기존 행에 영향이 없다", () => {
  assert.match(migrationSource, /add column dealer_name text not null default ''/);
  assert.match(migrationSource, /add column dealer_company_name text not null default ''/);
  assert.match(migrationSource, /add column customer_name text,/);
  assert.match(migrationSource, /add column customer_phone text,/);
  assert.match(migrationSource, /add column vehicle_number text,/);
  assert.match(migrationSource, /add column vin text,/);
  assert.match(migrationSource, /add column warranty_info_submitted_at timestamptz,/);
  assert.match(migrationSource, /add column warranty_issued_at timestamptz;/);
});

test("보증서 상태는 컬럼으로 저장하지 않는다 — warranty_status라는 컬럼/체크 제약이 없고, 항상 파생 함수로만 계산한다", () => {
  assert.doesNotMatch(migrationSource, /add column warranty_status/);
  assert.doesNotMatch(migrationSource, /warranty_status text/);
  assert.match(
    stateServiceSource,
    /export function warrantyStatus\(warranty: WarrantyInfo\): WarrantyStatus \{\s*\n\s*if \(warranty\.issuedAt\) return "ISSUED";\s*\n\s*if \(warranty\.customerName && warranty\.customerPhone && warranty\.vehicleNumber\) return "READY";\s*\n\s*return "NOT_READY";/,
  );
});

test("dealer_name/dealer_company_name은 create_transaction_with_room과 create_shop_transaction_with_room 양쪽 모두 auth.uid()의 dealer_profiles에서 스냅샷으로 채운다 — installer_name과 대칭", () => {
  for (const fn of ["create_transaction_with_room", "create_shop_transaction_with_room"]) {
    const start = migrationSource.indexOf(`create or replace function public.${fn}`);
    const end = migrationSource.indexOf(`revoke all on function public.${fn}`);
    const body = migrationSource.slice(start, end);
    assert.match(body, /select dp\.name, coalesce\(dp\.company_name, ''\) into v_dealer_name, v_dealer_company_name/);
    assert.match(body, /from public\.dealer_profiles dp where dp\.user_id = auth\.uid\(\);/);
    assert.match(body, /dealer_name, dealer_company_name/);
  }
});

test("set_transaction_warranty_info은 딜러(본인 거래) 또는 admin만 — set_transaction_contact_status와 동일한 4분기 인가 골격", () => {
  const start = migrationSource.indexOf("create or replace function public.set_transaction_warranty_info");
  const end = migrationSource.indexOf("revoke all on function public.set_transaction_warranty_info");
  const fn = migrationSource.slice(start, end);
  assert.match(fn, /security definer/);
  assert.match(fn, /set search_path = ''/);
  assert.match(fn, /if caller_role = 'admin'::public\.user_role then/);
  assert.match(
    fn,
    /elsif caller_role = 'dealer'::public\.user_role then\s*\n\s*if target\.dealer_id <> auth\.uid\(\) then raise exception 'Transaction access denied'; end if;/,
  );
});

test("set_transaction_warranty_info은 부분 저장을 허용한다 — 3개 필드가 다 없어도 저장 자체는 성공해야 VIN만 등록하는 시나리오가 가능하다", () => {
  const start = migrationSource.indexOf("create or replace function public.set_transaction_warranty_info");
  const end = migrationSource.indexOf("revoke all on function public.set_transaction_warranty_info");
  const fn = migrationSource.slice(start, end);
  assert.doesNotMatch(fn, /raise exception 'Missing/);
  assert.doesNotMatch(fn, /if.*customer_name.*is null.*then\s*\n\s*raise exception/);
});

test("set_transaction_warranty_info은 NOT_READY -> READY로 막 넘어가는 순간에만 warranty_info_submitted_at을 찍는다 — 이미 READY였던 걸 재저장해도 최초 시각을 덮어쓰지 않는다", () => {
  const start = migrationSource.indexOf("create or replace function public.set_transaction_warranty_info");
  const end = migrationSource.indexOf("revoke all on function public.set_transaction_warranty_info");
  const fn = migrationSource.slice(start, end);
  assert.match(fn, /was_ready := target\.customer_name is not null and target\.customer_phone is not null and target\.vehicle_number is not null;/);
  assert.match(fn, /now_ready := n_customer_name is not null and n_customer_phone is not null and n_vehicle_number is not null;/);
  assert.match(
    fn,
    /warranty_info_submitted_at = case\s*\n\s*when now_ready and not was_ready then now\(\)\s*\n\s*else warranty_info_submitted_at\s*\n\s*end,/,
  );
});

test("set_transaction_warranty_info은 고객명/연락처를 시스템 메시지 본문에 절대 넣지 않는다 — '등록했습니다'만 남긴다", () => {
  const start = migrationSource.indexOf("create or replace function public.set_transaction_warranty_info");
  const end = migrationSource.indexOf("revoke all on function public.set_transaction_warranty_info");
  const fn = migrationSource.slice(start, end);
  assert.match(fn, /insert into public\.chat_messages \(room_id, sender_role, text\)\s*\n\s*values \(room_id, 'system', '딜러가 보증서 발급 정보를 등록했습니다\.'\);/);
  assert.doesNotMatch(fn, /\|\| p_customer_name/);
  assert.doesNotMatch(fn, /\|\| p_customer_phone/);
});

test("issue_transaction_warranty는 담당 시공점(installer_id 또는 shop 멤버십) 또는 admin만, 그리고 정보가 READY 상태가 아니면 예외를 던진다 — 정보 없이 잘못 ISSUED 처리되는 것을 서버에서 막는다", () => {
  const start = migrationSource.indexOf("create or replace function public.issue_transaction_warranty");
  const end = migrationSource.indexOf("revoke all on function public.issue_transaction_warranty");
  const fn = migrationSource.slice(start, end);
  assert.match(
    fn,
    /elsif caller_role = 'installer'::public\.user_role then\s*\n\s*if target\.installer_id <> auth\.uid\(\)\s*\n\s*and not \(target\.shop_id is not null and public\.has_active_shop_membership\(target\.shop_id\)\) then/,
  );
  assert.match(fn, /if target\.warranty_issued_at is not null then\s*\n\s*raise exception 'Warranty already issued';/);
  assert.match(
    fn,
    /if target\.customer_name is null or target\.customer_phone is null or target\.vehicle_number is null then\s*\n\s*raise exception 'Warranty info is not ready yet';/,
  );
});

test("issue_transaction_warranty는 warranty_issued_at을 찍고 시스템 메시지를 남긴다", () => {
  const start = migrationSource.indexOf("create or replace function public.issue_transaction_warranty");
  const end = migrationSource.indexOf("revoke all on function public.issue_transaction_warranty");
  const fn = migrationSource.slice(start, end);
  assert.match(fn, /set warranty_issued_at = now\(\), updated_at = now\(\)/);
  assert.match(fn, /'system', '시공점이 보증서 발급을 완료했습니다\.'/);
});

test("네 함수 모두 security definer + 빈 search_path + revoke/grant 관례를 지킨다", () => {
  for (const fn of [
    "create_transaction_with_room",
    "create_shop_transaction_with_room",
    "set_transaction_warranty_info",
    "issue_transaction_warranty",
  ]) {
    assert.match(migrationSource, new RegExp(`revoke all on function public\\.${fn}\\([^)]*\\) from public, anon;`));
    assert.match(migrationSource, new RegExp(`grant execute on function public\\.${fn}\\([^)]*\\) to authenticated;`));
  }
});

test("transition_transaction_stage와 end_transaction_outcome은 이번 마이그레이션에서 전혀 재정의되지 않는다 — 작업완료/출고는 보증서 상태와 무관하게 항상 가능해야 한다", () => {
  assert.doesNotMatch(migrationSource, /create or replace function public\.transition_transaction_stage/);
  assert.doesNotMatch(migrationSource, /create or replace function public\.end_transaction_outcome/);
});

test("Transaction 타입은 dealerName/dealerCompanyName(installerName과 대칭)과 항상 존재하는 warranty 객체를 갖는다", () => {
  assert.match(typesSource, /export type WarrantyStatus = "NOT_READY" \| "READY" \| "ISSUED";/);
  assert.match(
    typesSource,
    /export type WarrantyInfo = \{\s*\n\s*customerName\?: string;\s*\n\s*customerPhone\?: string;\s*\n\s*vehicleNumber\?: string;\s*\n\s*vin\?: string;/,
  );
  assert.match(typesSource, /dealerName\?: string;\s*\n\s*dealerCompanyName\?: string;/);
  assert.match(typesSource, /warranty: WarrantyInfo;/);
});

test("supabase-transaction-repository는 8개 컬럼을 전부 select하고 매핑하며, setWarrantyInfo/issueWarranty가 정확히 대응하는 RPC를 호출한다", () => {
  assert.match(
    repoSource,
    /customer_name,customer_phone,vehicle_number,vin,warranty_info_submitted_at,warranty_issued_at/,
  );
  assert.match(repoSource, /dealerName: row\.dealer_name \?\? undefined,/);
  assert.match(repoSource, /vehicleNumber: row\.vehicle_number \?\? undefined,/);
  assert.match(repoSource, /issuedAt: row\.warranty_issued_at \?\? undefined,/);
  assert.match(repoSource, /async setWarrantyInfo\(/);
  assert.match(repoSource, /rpc\("set_transaction_warranty_info", \{/);
  assert.match(repoSource, /async issueWarranty\(transactionId: string\)/);
  assert.match(repoSource, /rpc\("issue_transaction_warranty", \{/);
});

test("use-transaction-actions: Real은 RPC, Demo/로컬은 no-RPC 로컬 폴백 — set_transaction_contact_status가 세운 것과 같은 전례", () => {
  const fn = actionsHookSource.slice(
    actionsHookSource.indexOf("const setWarrantyInfo = useCallback"),
    actionsHookSource.indexOf("const issueWarranty = useCallback"),
  );
  assert.match(fn, /supabaseTransactionRepository\.setWarrantyInfo\(transaction\.id, info\)/);
  assert.match(fn, /warrantyStatus\(transaction\.warranty\) !== "NOT_READY"/);
  assert.match(actionsHookSource, /supabaseTransactionRepository\.issueWarranty\(transaction\.id\)/);
  assert.match(
    actionsHookSource,
    /if \(warrantyStatus\(transaction\.warranty\) !== "READY"\) \{\s*\n\s*throw new Error\("보증서 발급 정보가 아직 준비되지 않았습니다\."\);/,
  );
  assert.match(
    actionsHookSource,
    /return\s*\{[\s\S]*setContactStatus,\s*setWarrantyInfo,\s*issueWarranty,\s*changeFinalPrice,\s*changePayment\s*,?\s*\};/,
  );
});

test("normalizeTransaction과 demo-transaction-repository 매퍼는 warranty를 항상 {} 기본값으로 채운다 — 기능 이전 로컬/공유 데이터도 안전하게 읽힌다", () => {
  assert.match(localRepoSource, /warranty: value\.warranty \?\? \{\},/);
  assert.match(demoRepoSource, /warranty: \{\},/);
});

test("로컬(Demo) 신규 거래 생성 시 dealerName/dealerCompanyName/warranty를 계정 정보로 즉시 채운다", () => {
  assert.match(dealerWorkspaceSource, /dealerName: account\.name,/);
  assert.match(dealerWorkspaceSource, /dealerCompanyName: defaultDealerCompanyName,/);
  assert.match(dealerWorkspaceSource, /warranty: \{\},/);
});

test("TransactionChatWorkspace 헤더는 차량번호가 있을 때만 붙이고, 시공점이 보는 상대 라벨은 실제 dealerName을 우선한다 — 고객명/연락처는 헤더에 절대 노출하지 않는다", () => {
  assert.match(
    chatWorkspaceSource,
    /\{transaction\.warranty\.vehicleNumber \? ` · \$\{transaction\.warranty\.vehicleNumber\}` : ""\}/,
  );
  assert.match(
    chatWorkspaceSource,
    /\{role === "dealer" \? transaction\.installerName : transaction\.dealerName \|\| "담당 딜러"\} <i \/>/,
  );
  assert.doesNotMatch(chatWorkspaceSource, /<h2>[\s\S]{0,200}customerName/);
});

test("TransactionChatWorkspace 딜러 폼은 '임시 저장'(항상 가능, 부분 저장)과 '보증서 정보 전달'(3개 필수 필드가 모두 있을 때만 활성화)을 분리한다 — incomplete 상태에서 전달이 완료 처리되지 않는다", () => {
  assert.match(
    chatWorkspaceSource,
    /const canSubmitWarranty = Boolean\(\s*\n\s*warrantyDraft\.customerName\.trim\(\) && warrantyDraft\.customerPhone\.trim\(\) && warrantyDraft\.vehicleNumber\.trim\(\),\s*\n\s*\);/,
  );
  const submitFn = chatWorkspaceSource.slice(
    chatWorkspaceSource.indexOf("const submitWarrantyInfo = async"),
    chatWorkspaceSource.indexOf("const submitIssueWarranty"),
  );
  assert.match(submitFn, /if \(!onSetWarrantyInfo \|\| warrantyPending \|\| !canSubmitWarranty\) return;/);
  assert.match(submitFn, /"보증서 발급 준비가 완료됐습니다\. 시공점에 전달됩니다\."/);
  const submitButton = chatWorkspaceSource.slice(
    chatWorkspaceSource.indexOf("void submitWarrantyInfo()") - 400,
    chatWorkspaceSource.indexOf("void submitWarrantyInfo()") + 50,
  );
  assert.match(submitButton, /disabled=\{warrantyPending \|\| !canSubmitWarranty\}/);
  assert.match(chatWorkspaceSource, /const saveWarrantyDraft = async \(\) => \{/);
  assert.match(chatWorkspaceSource, />\s*\{warrantyPending \? "저장 중…" : "임시 저장"\}\s*</);
});

test("필수 3개가 모두 채워지면 '임시 저장'은 잠기고 '보증서 정보 전달'만 활성화된다 — 같은 RPC를 타는 임시 저장으로 실수로 READY에 도달하는 걸 막는다", () => {
  const tempSaveButton = chatWorkspaceSource.slice(
    chatWorkspaceSource.indexOf('onClick={() => void saveWarrantyDraft()}') - 250,
    chatWorkspaceSource.indexOf('onClick={() => void saveWarrantyDraft()}') + 50,
  );
  assert.match(tempSaveButton, /disabled=\{warrantyPending \|\| canSubmitWarranty\}/);
  const submitButton = chatWorkspaceSource.slice(
    chatWorkspaceSource.indexOf("void submitWarrantyInfo()") - 400,
    chatWorkspaceSource.indexOf("void submitWarrantyInfo()") + 50,
  );
  assert.match(submitButton, /disabled=\{warrantyPending \|\| !canSubmitWarranty\}/);
});

test("임시 저장 결과 안내 문구는 상황별로 갈린다 — VIN만 있으면 '차량 확인 가능', 이름+연락처는 있는데 차량번호만 없으면 차량번호 안내, 연락처/고객명만 없으면 각각 그 필드를 콕 집어 안내한다", () => {
  const fn = chatWorkspaceSource.slice(
    chatWorkspaceSource.indexOf("const warrantyDraftGuidance = () => {"),
    chatWorkspaceSource.indexOf("const saveWarrantyDraft = async"),
  );
  assert.match(
    fn,
    /if \(!hasPlate && hasVin && !hasName && !hasPhone\)\s*\n\s*return "차량 확인은 가능하지만 보증서 발급 정보는 아직 완료되지 않았습니다\.";/,
  );
  assert.match(fn, /if \(!hasPlate\) return "보증서 발급에는 차량번호가 필요합니다\.";/);
  assert.match(fn, /if \(!hasName\) return "고객명을 입력해 주세요\.";/);
  assert.match(fn, /if \(!hasPhone\) return "연락처를 입력해 주세요\.";/);
});

test("TransactionChatWorkspace 딜러 입력 필드는 정확히 고객명*/연락처*/차량번호*/VIN(선택) 안내 문구를 쓴다", () => {
  assert.match(chatWorkspaceSource, /고객명 \*/);
  assert.match(chatWorkspaceSource, /연락처 \*/);
  assert.match(chatWorkspaceSource, /차량번호 \*/);
  assert.match(chatWorkspaceSource, /차대번호\(VIN\)/);
  assert.match(chatWorkspaceSource, /<small>보증서 발급에는 차량번호가 필요합니다\.<\/small>/);
  assert.match(chatWorkspaceSource, /<small>차대번호는 차량 확인용 선택 정보입니다\.<\/small>/);
});

test("TransactionChatWorkspace 시공점 뷰는 담당딜러/딜러소속/차종/차량번호/VIN/고객명/고객연락처/등록일/상태를 읽기전용 dl로 보여주고, READY일 때만 발급 완료 버튼을 노출한다", () => {
  assert.match(chatWorkspaceSource, /<dt>담당 딜러<\/dt>/);
  assert.match(chatWorkspaceSource, /<dt>딜러 소속<\/dt>/);
  assert.match(chatWorkspaceSource, /<dt>차량번호<\/dt>/);
  assert.match(chatWorkspaceSource, /<dt>VIN<\/dt>/);
  assert.match(chatWorkspaceSource, /<dt>고객명<\/dt>/);
  assert.match(chatWorkspaceSource, /<dt>고객 연락처<\/dt>/);
  assert.match(chatWorkspaceSource, /<dt>정보 등록일<\/dt>/);
  assert.match(chatWorkspaceSource, /<dt>보증서 상태<\/dt>/);
  assert.match(
    chatWorkspaceSource,
    /\{warrantyStatus\(transaction\.warranty\) === "READY" && onIssueWarranty && \(/,
  );
  assert.match(chatWorkspaceSource, /딜러가 아직 보증서 발급 정보를 등록하지 않았습니다\./);
  assert.match(chatWorkspaceSource, /차량번호 등록 대기 중입니다\./);
});

test("shopWarrantyNotReadyMessage는 차량번호가 있지만 이름/연락처가 없는 경우를 '차량번호 등록 대기'와 구분한다", () => {
  assert.match(
    chatWorkspaceSource,
    /const shopWarrantyNotReadyMessage = \(warranty: WarrantyInfo\) => \{\s*\n\s*const hasAny = Boolean\(warranty\.customerName \|\| warranty\.customerPhone \|\| warranty\.vehicleNumber \|\| warranty\.vin\);\s*\n\s*if \(!hasAny\) return "딜러가 아직 보증서 발급 정보를 등록하지 않았습니다\.";\s*\n\s*if \(!warranty\.vehicleNumber\) return "차량번호 등록 대기 중입니다\.";\s*\n\s*return "보증서 발급 정보가 아직 완료되지 않았습니다\.";\s*\n\s*\};/,
  );
  assert.match(
    chatWorkspaceSource,
    /\{warrantyStatus\(transaction\.warranty\) === "NOT_READY" && \(\s*\n\s*<p className="warranty-result-message">\{shopWarrantyNotReadyMessage\(transaction\.warranty\)\}<\/p>\s*\n\s*\)\}/,
  );
});

test("입고~작업완료(출고 전) 구간에서만, role===dealer이고 READY/ISSUED가 아닐 때만 경고 배너가 뜬다 — 작업 생성 직후/입고 전에는 뜨지 않는다", () => {
  assert.match(
    chatWorkspaceSource,
    /role === "dealer" &&\s*\n\s*\(transaction\.status\.stage === "입고" \|\| transaction\.status\.stage === "작업완료"\) &&\s*\n\s*warrantyStatus\(transaction\.warranty\) !== "READY" &&\s*\n\s*warrantyStatus\(transaction\.warranty\) !== "ISSUED"/,
  );
  assert.match(chatWorkspaceSource, /고객명, 연락처, 차량번호가 입력되지 않으면 시공점에서 보증서를 발급할 수 없습니다\./);
  assert.match(chatWorkspaceSource, /보증서 발급 정보가 필요합니다\. 출고 전 고객명, 연락처, 차량번호를 입력해주세요\./);
});

test("DealerTransactionManagementScreen 목록 배지는 입고/작업완료 구간에서만 강조 스타일을 쓰고, VIN만 있으면 '차량번호 대기'로 문구가 갈린다", () => {
  assert.match(
    dealerListSource,
    /const warrantyUrgent = item\.status\.stage === "입고" \|\| item\.status\.stage === "작업완료";/,
  );
  assert.match(
    dealerListSource,
    /const showWarrantyFlag = !terminal && warranty !== "READY" && warranty !== "ISSUED";/,
  );
  assert.match(dealerListSource, /차량번호 대기/);
  assert.match(dealerListSource, /보증서 정보 미입력/);
});

test("ShopDashboard 카드는 dealerLabel 하드코딩 대신 실제 dealerName을 우선하고, 차량번호가 없으면 VIN으로 대체 표기한다", () => {
  assert.match(shopDashboardSource, /item\.dealerName \|\| dealerLabel\(item\.dealerId\)/);
  assert.match(
    shopDashboardSource,
    /function vehicleIdLabel\(item: Transaction\) \{\s*\n\s*if \(item\.warranty\.vehicleNumber\) return item\.warranty\.vehicleNumber;\s*\n\s*if \(item\.warranty\.vin\) return `VIN \$\{item\.warranty\.vin\}`;/,
  );
});

// 거래관리 재구조화(2026-08) — "발급대기 필터에서만 고객명/연락처가 보이는
// 목록 행" 확장은 제거했다: PII(고객명/연락처)는 목록에서 과도하게 노출하지
// 않고 상세 영역에서만 보여준다는 정책으로 바뀌면서, 목록 행은 필터와 무관하게
// 항상 차량번호/VIN + 보증서 배지만 보여주고, 고객명/연락처는 상세 dl에서만
// 확인한다(READY/NOT_READY/ISSUED 어떤 필터든 동일).
test("TransactionManagementScreen(시공점)은 보증서 상태 필터(전체/발급대기/발급완료)를 제공하고, 목록 행은 필터와 무관하게 차량번호/VIN·보증서 배지만 보여주며 고객명/연락처는 상세에서만 노출한다", () => {
  assert.match(managementScreenSource, /const \[warrantyFilter, setWarrantyFilter\] = useState<WarrantyStatus \| "전체">\("전체"\);/);
  assert.match(
    managementScreenSource,
    /\.filter\(\(item\) => warrantyFilter === "전체" \|\| warrantyStatus\(item\.warranty\) === warrantyFilter\)/,
  );
  assert.match(managementScreenSource, /<option value="READY">발급 대기<\/option>/);
  assert.match(managementScreenSource, /<option value="ISSUED">발급 완료<\/option>/);
  assert.match(managementScreenSource, /const vehicleId = vehicleIdentityLabel\(item\.warranty\);/);
  assert.match(managementScreenSource, /warranty-badge warranty-badge-\$\{itemWarranty\.toLowerCase\(\)\}/);
  assert.doesNotMatch(managementScreenSource, /item\.warranty\.customerName/);
  assert.doesNotMatch(managementScreenSource, /item\.warranty\.customerPhone/);
  assert.match(managementScreenSource, /<dt>보증서 상태<\/dt>/);
  assert.match(managementScreenSource, /<dt>고객명<\/dt>/);
  assert.match(managementScreenSource, /<dt>고객 연락처<\/dt>/);
});

test("regression: 기존 컬럼 매핑(installer_name, shop_id, contact_status)과 기존 RPC 호출부는 이번 변경으로 자리만 옮겨졌을 뿐 값 자체는 그대로다", () => {
  assert.match(repoSource, /installerName: row\.installer_name,/);
  assert.match(repoSource, /shopId: row\.shop_id \?\? null,/);
  assert.match(repoSource, /contactStatus: row\.contact_status \?\? undefined,/);
  assert.match(repoSource, /rpc\("create_transaction_with_room", \{/);
  assert.match(repoSource, /rpc\("create_shop_transaction_with_room", \{/);
});
