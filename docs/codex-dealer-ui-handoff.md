# Dealer Home UI V1 — Codex Handoff

이 문서는 코드베이스 조사 결과만 담는다. 여기 적힌 것 외에 새로운 Product Rule을
임의로 추가하지 않았다 — 판단이 필요한 부분은 "알려진 risks"/"확인해야 할 것"에
질문 형태로 남겼다.

## Current branch / SHA

- branch: `feature/dealer-home-ui-v1`
- commit: `0f62f54` ("feat: prototype dealer home vehicle-first workspace")
- origin과 완전히 동기화됨 (local HEAD == `origin/feature/dealer-home-ui-v1`)
- `main` 대비 diff: `app/globals.css` (+33 lines, 신규 CSS 블록만), `components/dealer/DealerDashboard.tsx` (className 한 줄 추가) — 딱 이 2개 파일뿐
- Production 미배포, main에 merge 안 됨

## Phase 1~8 Product Rules 요약 (기존 코드 기준)

- **Phase 1**: Dealer가 Shop을 직접 선택하면 Installer 수락 대기 없이 Transaction + Room이 즉시 생성된다. 전화 확인은 정상 절차이지 실패가 아니다.
- **Phase 2**: Shop을 못 찾으면 Shop Search Request를 만들 수 있다. Admin이 확인/운영메모/연결어려움 처리.
- **Phase 3**: Admin이 미가입 업체를 approved+unclaimed Shop으로 빠르게 등록할 수 있다(계정/소유자 없음).
- **Phase 4**: Admin이 Dealer에게 Shop 1곳을 제안하고, Dealer 수락 시 Phase 1의 거래 생성 Flow를 그대로 재사용한다.
- **Phase 5**: 거래 Lifecycle = 입고 전/작업 중/작업 완료/출고(정상) + 취소/시공 불가(예외 종료). 최종 시공금액은 "Dealer가 Shop에 지급하기로 확정한 금액"이며 결제/정산/PG가 아니다. Transaction/Room/Message/Shop은 절대 삭제하지 않는다.
- **Phase 6**: Dealer 거래관리(`DealerTransactionManagementScreen`)는 진행중/완료/종료로 묶어 보여주는 browse-and-find 화면일 뿐이다 — 상태변경/금액수정 등 실제 조작은 전부 거래방(Room)에서 처리한다.
- **Phase 7**: Admin 운영센터는 실제 처리 필요 항목만 보여준다(Queue). vanity metric(총 거래수, 가입자수, 성장률 차트 등) 금지.
- **Phase 8**: 전화 연락 결과(`contact_status`: 확인 전/연결됨/연락 안 됨)는 작업 stage/outcome과 완전히 분리된 별도 신호다. 실제 로그인 Dealer의 시공점 검색에는 Demo 데이터가 섞이면 안 된다.

## Dealer Home V1에서 변경한 것

`components/dealer/DealerDashboard.tsx`에 CSS class `dealer-home-prototype` 한 개
추가 — 그 외 JSX 구조, props, 콜백, 로직은 **문자 그대로 동일**하다. `app/globals.css`에
`.dealer-home-prototype` 스코프 아래 새 CSS 블록만 추가됐다(레이아웃/타이포/색상 조정,
반응형 breakpoint 포함). 새 컴포넌트, 새 상태, 새 API 호출, 새 prop 없음.

현재 화면에 존재하는 실제 UI 요소(컴포넌트 기준):

1. 헤더(`dealer-welcome`): "{dealerName} 딜러님, 오늘 출고할 차량이 있나요?"
2. 위치 우선 검색 박스(`dealer-location-first`): 지역/주소 입력 + 작업유형 select + "시공점 찾기" 버튼 → `onSearchLocation`/`onFindShop`
3. 포커스 배너(조건부, `waitingCount > 0`일 때): "확인이 필요한 요청이 N건 있어요" → `onFilterDeals("견적")`
4. 진행 중인 거래 목록(조건부, 최대 4건, `dealer-active-deals`): 카드 클릭 시 `onOpenTransaction` — Phase 7부터 거래방(Room)으로 직접 이동
5. 보조 액션 행(`dealer-secondary-actions`): 새 시공 요청 / 권장 패키지 확인 / (Real 모드에서만) 시공점 찾기 요청
6. Empty State(`deals.length === 0`일 때): "아직 거래가 없습니다." + "가까운 시공점 찾기" CTA

## 아직 사람이(Desktop 브라우저로) 검수 안 한 것

- 실제 Desktop 브라우저에서의 시각적 확인 — 이번 세션에서도 진행하지 않았다(요청 범위 밖).
- 위 CSS만으로 의도한 레이아웃이 실제로 나오는지, 다른 화면(Shop/Admin)과 겹치는 클래스가 없는지는 코드 리뷰로만 확인했고 렌더링 확인은 아직 없다.

## 절대 건드리면 안 되는 backend/business rule (이번 브랜치 기준 재확인)

- `supabase/` 전체 — 이번 브랜치는 migration 0개. 마지막 적용 migration은 여전히 `202608130005_phone_contact_result.sql`(Phase 8)이다.
- `repositories/`, `hooks/`, `services/`, `types/` — 전부 diff 0. `useTransactionStore`, `useTransactionActions`, `installer-directory-repository`, `shop-search-request-repository`, `supabase-transaction-repository` 등 전부 Phase 8 상태 그대로.
- `DealerWorkspace.tsx`의 `availableShops = useSupabaseData ? approvedInstallerShops : demoInstallerListings` (Phase 8에서 고친 Demo/Real 경계) — 이 파일 자체가 diff에 없으므로 그대로 유지됨.
- Auth/RLS/Admin 권한 모델 — 전부 미변경.
- 거래 stage(입고 전/작업 중/작업 완료/출고), outcome(취소/시공 불가), contact_status(확인 전/연결됨/연락 안 됨) — 세 개념은 UI에서도 절대 섞지 않는다(Phase 8 §25).

## Dealer Home에서 사용하는 실제 데이터 경로

- **Real Shop**: `DealerWorkspace.tsx`의 `availableShops`(useSupabaseData=true일 때 `approvedInstallerShops`만, Demo 미포함) → `onFindShop`/`onSearchLocation`으로 진입하는 `InstallerDirectoryScreen`에서 소비. DealerDashboard 자체는 Shop 데이터를 직접 들고 있지 않다.
- **Demo Shop**: `data/installer-directory-demo.ts` — useSupabaseData=false(Demo 세션)일 때만 `availableShops`에 들어간다.
- **Transaction**: `deals` prop = `transactions.filter(item => !item.visibility.hiddenByDealer)`, 최상위 `useTransactionStore` 훅에서 내려옴 — Dealer Home 전용 fetch 없음, 앱 전체가 공유하는 동일 데이터.
- **Search Request**: `onShopSearchRequests` 콜백(Real 모드에서만 전달됨)으로 `shopSearchRequestRepository` 기반 화면으로 이동. DealerDashboard는 Search Request 데이터를 직접 보여주지 않는다.
- **Contact status**: DealerDashboard.tsx 안에서는 전혀 참조하지 않는다. `contactStatus`는 `DealerTransactionManagementScreen`(거래 관리 리스트의 "연락 안 됨" 칩)과 `TransactionChatWorkspace`(거래방의 전화 확인 배너)에서만 쓰인다 — 둘 다 이 브랜치의 diff 밖.

## Demo/Real 데이터 경계 (Phase 8 수정 이후 유지 여부)

유지된다. Phase 8에서 고친 지점(`DealerWorkspace.tsx`의 `availableShops` 병합 로직)이
이번 브랜치의 diff에 전혀 포함되지 않았으므로, "Real 로그인 Dealer 검색에 Demo Shop이
섞이지 않는다"는 상태가 그대로 유지된다.

## Phase 1~8 Regression 확인 결과

`git diff origin/main...HEAD`가 `app/globals.css`(CSS 추가만)와
`components/dealer/DealerDashboard.tsx`(className 한 줄) 2개 파일뿐이므로, Phase 1~8의
어떤 RPC/RLS/훅/repository/타입도 건드리지 않았다. `DealerDashboard.tsx`의 props
시그니처와 콜백 사용도 main과 100% 동일 — 유일한 변경은 렌더링되는 `<section>`의
className 문자열 뒤에 `dealer-home-prototype`이 붙은 것뿐이다.

## 재사용 가능한 component / hook / service (Search / Shop Detail / Transaction / Room 확장 시)

- `services/installer-search.ts` (`searchNearbyInstallers`) — 거리 기반 정렬 로직
- `services/location-search.ts` (`searchLocation`) — 주소/지역 텍스트 검색
- `components/dealer/InstallerDirectoryScreen.tsx` — 기존 Search 결과(지도+목록) 화면
- `components/dealer/InstallerCard.tsx` / `InstallerDetailPanel.tsx` — Shop 카드/상세 패널
- `components/transactions/DealerTransactionManagementScreen.tsx` — 거래 리스트(진행중/완료/종료 그룹, 검색, 필터) 패턴
- `components/messenger/MessengerScreen.tsx` + `components/transactions/TransactionChatWorkspace.tsx` — 거래방(Room), 모든 거래 상세/조작의 단일 진입점
- `hooks/use-transaction-store.ts` — transactions/rooms 데이터 fetch
- `hooks/use-transaction-actions.ts` — endOutcome/changeStage/setContactStatus/changeFinalPrice 등 모든 거래 조작
- `services/transaction-state-service.ts` — `dealerStageLabel`, `groupOf`, `isTerminalOutcome` 등 상태 라벨/그룹 헬퍼
- `services/shop-message.ts` — "시공점에 보낼 내용 복사" 문구 생성기(Phase 8)
- `services/transaction-errors.ts` — RPC 에러 → 한국어 메시지 변환(Phase 8)
- `repositories/installer-directory-repository.ts`, `repositories/shop-search-request-repository.ts`, `repositories/supabase-transaction-repository.ts`

## UI 확장 시 위험한 결합 지점

- **화면 라우팅**: 새 화면을 추가하려면 `types/dealer.ts`의 `Screen` union, `components/layout/AppShell.tsx`의 nav/`screenTitles`, `components/workspaces/DealerWorkspace.tsx`의 렌더 분기, 그리고 `app/page.tsx`의 `pathForScreen`/`workspacePathForRole`까지 여러 곳을 함께 고쳐야 한다.
- **Real/Demo Shop 병합 지점**: `availableShops`는 반드시 `useSupabaseData ? approvedInstallerShops : demoInstallerListings` 형태를 유지해야 한다. 새 화면에서 이 둘을 다시 합치는 코드를 작성하면 Phase 8에서 고친 버그가 재발한다.
- **거래 콜백 계약**: `onOpenTransaction`(→ 거래방 이동), `onFilterDeals`(→ 거래관리 화면 + 필터) 등은 `DealerWorkspace.tsx`에서 특정 네비게이션 의미로 이미 연결돼 있다. 새 UI에서 같은 이름의 콜백을 다른 의미로 재정의하면 안 된다.
- **CSS 스코프**: 이번 프로토타입은 `.dealer-home-prototype` 아래로 스타일을 스코프했다. 앞으로도 Shop/Admin과 공유하는 base class(`.metric-card`, `.dashboard-core-metrics` 등)를 직접 덮어쓰지 말고 전용 스코프 class를 쓰는 편이 안전하다.
- **stage/outcome/contact_status 3개념**: 새 UI 요소를 만들 때 이 셋을 하나의 배지/라벨로 합치지 않는다(Phase 8 §25 그대로 유지).

## Dead code / Legacy UI 후보 (목록만, 삭제 안 함)

- `components/transactions/TransactionManagementScreen.tsx`의 `role === "dealer"` 분기 — 실제로는 `role="shop"`(InstallerWorkspace.tsx)로만 호출된다(Phase 6에서 Dealer는 `DealerTransactionManagementScreen`으로 이전됨). dealer 분기 코드 자체는 아직 파일에 남아 있다.
- DB 함수 `get_approved_installer_directory()` — client 어디에서도 더 이상 호출하지 않는다(마이그레이션 주석에도 "unused, 의도적으로 남겨둠"이라고 명시돼 있음). 삭제하지 않았다.
- `types/dealer.ts`의 `Role` 타입 — 파일 자체 주석으로 `@deprecated UI compatibility alias. New service boundaries use UserRole` 명시돼 있음(이번 브랜치가 만든 것 아님, 기존 상태).

## 다음 UI 확장 순서 (코드/네비게이션 구조 기준 관찰, 새 Product Rule 아님)

현재 네비게이션 흐름(`홈 → 시공점 찾기 → 거래 관리 → 메시지`)과 이번 지시("Search / Shop
Detail로 넘어가지 마라")를 볼 때, 다음 자연스러운 확장 지점은 시공점 찾기(Search)
결과 화면(`InstallerDirectoryScreen`)과 그 상세(Shop Detail)로 보인다. 이건 관찰일 뿐
확정된 지시가 아니므로, 실제 순서/범위는 사람 검수 후 다시 정해야 한다.

## 알려진 Risks

- Desktop 실제 렌더링 미검증 — CSS만으로 의도한 레이아웃이 나오는지 확인 필요.
- `.dealer-home-prototype` 스코프 밖으로 새 CSS가 새어나가지 않는지는 코드 리뷰 수준으로만 확인했다(다른 role-home 화면과 셀렉터 충돌 가능성은 낮아 보이지만 실제 스크린샷 대조는 없었음).
- 이번 브랜치가 참고한 "카마스터가 찾고 있어요" 영역, Sidebar 후보 구조, "내 차량" 네이밍 등은 코드 어디에도 존재하지 않는다 — 원래 UX 요구사항 문서에 있던 항목인지, 이번 프로토타입 범위에 아예 포함되지 않았는지는 코드만으로 판단 불가.

## Codex가 재접속 후 첫 작업으로 확인해야 할 것

1. 이 문서와 실제 최신 `git log`/`git diff origin/main...HEAD`가 여전히 일치하는지 재확인(다른 세션이 브랜치를 건드렸을 수 있음 — 항상 라이브 상태를 신뢰할 것).
2. Desktop 브라우저에서 `feature/dealer-home-ui-v1`을 실제로 렌더링해 CSS 의도대로 나오는지 시각 검수.
3. 사람이 "다음 화면"으로 어디를 지정하는지 확인 후 착수(이 문서의 "다음 UI 확장 순서"는 관찰일 뿐 지시가 아님).
