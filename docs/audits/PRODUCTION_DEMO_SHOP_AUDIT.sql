-- Production installer_shops 정리 대상 확인 — 읽기 전용.
--
-- 배경: 실제 서버는 "테스트 아이디만 가입된 빈 상태"가 목표인데, 데모/테스트로
-- 만든 시공점이 남아 있다는 이야기가 있어 그것부터 확인한다. 이 파일에는
-- DELETE가 없다. 무엇이 지워지고 무엇이 함께 사라지는지를 눈으로 본 다음에
-- 삭제 여부를 판단한다.
--
-- 실행: Supabase Studio → SQL Editor (Production 프로젝트). 1 → 2 → 3 → 4 순서.
--
-- 스키마 메모 (컬럼명이 화면 표기와 다르다):
--   installer_shops.shop_name        : 시공점명   (name 아님)
--   installer_shops.accepting_requests : 요청 수신 (available 아님)
--   approval_status = approved + ownership_status = unclaimed 는 오류가 아니라
--   정상 상태다 — 운영자가 전화로 찾아 선등록했고 아직 계정이 안 붙은 시공점.
--   이걸 "정리 대상"으로 착각하지 말 것.

-- ────────────────────────────────────────────────────────────────────────
-- 1. 전체 목록. 몇 곳이 있고 각각 무엇에 엮여 있는지 먼저 본다.
-- ────────────────────────────────────────────────────────────────────────
select
  s.id,
  s.shop_name,
  s.business_name,
  s.business_registration_number,
  s.address,
  s.phone,
  s.approval_status,
  s.ownership_status,
  s.accepting_requests,
  s.created_at,
  (select count(*) from public.shop_memberships m
     where m.shop_id = s.id and m.status = 'active')                              as active_members,
  (select count(*) from public.transactions t where t.shop_id = s.id)             as transactions,
  (select count(*) from public.shop_search_proposals p where p.shop_id = s.id)    as proposals,
  (select count(*) from public.shop_claim_requests c where c.shop_id = s.id)      as claim_requests,
  (select count(*) from public.shop_search_requests r
     where r.registered_shop_id = s.id)                                           as registered_from_requests
from public.installer_shops s
order by s.created_at;

-- ────────────────────────────────────────────────────────────────────────
-- 2. 판정. 이름/주소/사업자번호 패턴은 참고용 힌트일 뿐이므로,
--    1번 결과를 눈으로 확인한 뒤 이 판정과 대조한다.
--
--    FK 동작:
--      transactions.shop_id            → on delete RESTRICT (삭제를 막는다)
--      shop_search_proposals.shop_id   → on delete RESTRICT (삭제를 막는다)
--      shop_memberships.shop_id        → on delete CASCADE  (같이 지워진다)
--      shop_claim_requests.shop_id     → on delete CASCADE  (같이 지워진다)
--      shop_search_requests.registered_shop_id → on delete SET NULL (이력만 끊김)
-- ────────────────────────────────────────────────────────────────────────
select
  s.id,
  s.shop_name,
  s.address,
  s.approval_status,
  s.ownership_status,
  s.created_at,
  case
    when exists (select 1 from public.transactions t where t.shop_id = s.id)
      then '삭제 불가 — 거래가 걸려 있음 (FK restrict)'
    when exists (select 1 from public.shop_search_proposals p where p.shop_id = s.id)
      then '삭제 불가 — 시공점 제안 이력이 있음 (FK restrict)'
    when exists (select 1 from public.shop_memberships m where m.shop_id = s.id and m.status = 'active')
      then '검토 필요 — 활성 계정이 연결되어 있음 (지우면 멤버십도 함께 사라짐)'
    else '삭제 가능 — 걸린 거래·제안·활성 계정 없음'
  end as verdict
from public.installer_shops s
where s.shop_name ~* '(demo|test|테스트|데모|샘플|sample|더미|dummy)'
   or s.business_name ~* '(demo|test|테스트|데모|샘플|sample)'
   or s.address ~* '(demo|test|테스트|데모)'
   or s.business_registration_number in ('000-00-00000', '111-11-11111', '123-45-67890')
   or s.phone ~ '^0(00|10-0000)'
order by s.created_at;

-- ────────────────────────────────────────────────────────────────────────
-- 3. 특정 시공점 하나의 영향 범위. <SHOP_ID>를 1번 결과의 id로 바꿔 실행.
-- ────────────────────────────────────────────────────────────────────────
-- select 'transactions (RESTRICT — 삭제 차단)'   as relation, count(*) from public.transactions          where shop_id = '<SHOP_ID>'
-- union all
-- select 'shop_search_proposals (RESTRICT)',                   count(*) from public.shop_search_proposals where shop_id = '<SHOP_ID>'
-- union all
-- select 'shop_memberships (CASCADE — 함께 삭제)',              count(*) from public.shop_memberships      where shop_id = '<SHOP_ID>'
-- union all
-- select 'shop_claim_requests (CASCADE — 함께 삭제)',           count(*) from public.shop_claim_requests   where shop_id = '<SHOP_ID>'
-- union all
-- select 'shop_search_requests.registered_shop_id (SET NULL)', count(*) from public.shop_search_requests  where registered_shop_id = '<SHOP_ID>';

-- ────────────────────────────────────────────────────────────────────────
-- 4. 시공점을 지워도 로그인 계정은 남는다.
--    "실 서버를 비워둔다"가 목표라면 auth 계정은 별도 판단이 필요하다.
--    (auth.users 삭제는 profiles → 여러 테이블로 cascade 되므로 훨씬 무겁다.
--     이 목록을 먼저 보고, 지울 계정이 있으면 그때 따로 계획한다.)
-- ────────────────────────────────────────────────────────────────────────
select
  p.id       as profile_id,
  p.email,
  p.role,
  s.id       as shop_id,
  s.shop_name,
  m.membership_role,
  m.status   as membership_status,
  p.created_at
from public.shop_memberships m
join public.profiles p on p.id = m.user_id
join public.installer_shops s on s.id = m.shop_id
order by p.created_at;
