# Car-Master — 진행 중인 관심사

## 대시보드 4중 네임스페이스 (V0.5 직전 리터치 과제)

`DealerDashboard.tsx` 루트가 지금도 4개 클래스를 동시에 답니다:

```
dealer-dashboard r3-dealer-dashboard r4-dealer-dashboard reference-prototype-dashboard
```

세대마다 신규 클래스로 갈아타지 않고 **별칭을 추가하며 옛 CSS를 덮는 방식**으로
쌓여왔다. `chore/css-legacy-cleanup`(2026-08-18)에서 확인한 실측:

- `app/globals.css` 안에 이 네 네임스페이스(`.reference-*` / `.r2-*` / `.r3-*` /
  `.r4-*` / `.prototype-*`)를 참조하는 규칙이 **280개**
- 그중 루트는 살아있지만 자손 클래스가 이제 JSX에 없어 **죽은 규칙 60개**를
  같은 라운드에서 삭제함(완전 안전 확인된 것만 — 콤마 그룹 안에 살아있는
  branch가 섞인 5곳은 손대지 않고 남겨둠, 아래 참고)
- 나머지 220개는 **살아있는 규칙**이지만, 같은 요소가 여러 별칭으로 중복
  스타일링되고 있어 로드 순서로 승자가 갈리는 구조 — 오늘 발견된 버그 3건
  (사이드바 로고 중복, 거래 관리 2줄 분리, 메신저 grid 붕괴)이 전부 이 패턴이었음

### 다음 라운드에서 할 일
1. 대시보드를 한 세대(예: `r4-dealer-dashboard` 하나)로 통일하고 나머지 3개
   클래스를 JSX에서 제거
2. 그 결정에 따라 각 네임스페이스의 CSS를 병합 — 승자만 남기고 패자 삭제
3. 관련 테스트가 클래스명을 어서션하는지 먼저 확인(제거 전 grep)
4. `!important` 187개 중 옛 네임스페이스 규칙 안에 있는 **94개**가 이 작업의
   주 대상 — 병합하면서 특정도로 대체 가능한지 하나씩 검토

### 손대지 않고 남겨둔 애매한 5곳 (chore/css-legacy-cleanup 시점)
콤마로 묶인 셀렉터 그룹 안에 살아있는 branch가 섞여 있어 통째로 지우면
살아있는 스타일까지 날아가는 경우. `app/globals.css`에서 `.r3-search-form input`과
`.r3-search-hero .ws-search-cta`가 같은 규칙에 콤마로 묶인 4곳 + `.r6-dealer-dashboard,
.r4-dealer-dashboard` 1곳. 다음 라운드에서 콤마를 쪼개 죽은 branch만 제거하면 됨.

---

## 시공점 정보 변경(상호·주소) Admin 알림 — 우선순위 낮음, 보류

`fix/beta-security`(2026-08-18)에서 조사. 웹랩 진단 ②에 대한 대응 방향을
"차단·재승인" 대신 "Admin에게 알림만"으로 바꾸기로 했고, 알림 자체는
마이그레이션 없이 되는 방법이 있는지 먼저 확인했다.

**결론: 마이그레이션 없이는 불가능.** 확인한 내용:
- `update_shop_operating_profile` RPC가 편집 가능한 필드는 11개
  (shop_name/address/detail_address/phone/contact_phone/business_hours/
  closed_days/supported_brands/supported_services/introduction/
  accepting_requests) — `installer_shops.business_registration_number`는
  이 RPC에 없어 **승인된 시공점은 사업자번호를 바꿀 방법이 현재 아예 없다**.
  그래서 실질 감시 대상은 상호·주소 2개뿐
- `installer_shops.updated_at`은 있지만 11개 필드 중 아무거나 하나만
  바뀌어도 덮어써진다 — 어떤 필드가 바뀌었는지 구분 불가, 이전 값도 사라짐.
  이걸로는 "상호·주소만, 나머지는 조용히"라는 조건을 지킬 수 없다
- 이 저장소에 필드 단위로 이전 값을 보존하는 로그/감사 테이블은
  `transaction_stage_events`(거래 도메인 전용) 하나뿐, 시공점 프로필에
  해당하는 건 없다. 관련 트리거도 없다
- `services/notifications/notification-service.ts`는 v0.4용 NAVER SENS
  placeholder로, 콘솔에 찍고 끝나는 no-op — 아무데도 저장 안 됨. Admin이
  볼 방법이 없다

**다음 라운드에서 필요한 최소 마이그레이션** (우선순위 낮음으로 보류):
- 신규 테이블 `shop_profile_change_events`(shop_id/field/old_value/
  new_value/changed_by/created_at) 1개
- `installer_shops`에 `AFTER UPDATE` 트리거 1개 — shop_name/address(+
  방어적으로 business_registration_number, 나중에 편집 가능해질 경우 대비)가
  실제로 바뀔 때만 삽입
- `AdminShopManagementScreen.tsx`에 이미 있는 "업체 연결 요청" 카드와 같은
  패턴으로 "최근 정보 변경" 카드 추가
- Demo는 손댈 것 없음 — `ShopManagementScreen.tsx`가 데모 계정이면
  Supabase를 아예 안 타고 로컬 메모리(`demoRecord`)만 쓴다

---

*이 파일은 다음 라운드를 위한 메모다. 세션 메모리와 달리 저장소에 커밋되어
브랜치를 넘나들며 참조할 수 있다.*
