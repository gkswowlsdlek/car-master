# Real Admin 계정 부트스트랩 절차

Car-Master는 회원가입 화면으로 admin 계정을 만들 수 없다 (`components/auth/SignUpScreen.tsx`가
dealer/installer만 허용하고, `handle_new_user()` 트리거도 `signup_role` 메타데이터로
`dealer`/`installer`만 배정한다 — `supabase/migrations/202607190001_v034_membership.sql:70-118`).
이건 의도된 제한이다: 회원가입 경로로 admin이 생성 가능하면 아무나 요청 body만 조작해서
운영자 권한을 얻을 수 있기 때문이다. 대신 Closed Beta 운영자가 Supabase SQL Editor에서
아래 절차를 **직접** 실행해서 admin 계정 1개를 수동으로 만든다.

이 문서는 어떤 실제 이메일도 하드코딩하지 않는다. 아래 `<PLACEHOLDER>` 값을 상황에 맞게
직접 채워 넣어서 실행할 것.

## 1. 일반 Supabase Auth 사용자 생성

1. Supabase 대시보드 → Authentication → Users → **Add user** (또는 앱의 일반
   회원가입 화면에서 `role: dealer`로 정상 가입) 로 사용자를 하나 만든다.
2. 이 시점에서 `handle_new_user()` 트리거가 자동으로 `public.profiles` 행을
   `role = 'dealer'`로 생성한다 (`dealer_profiles` 행도 함께 생성됨). 이건 정상이다 —
   다음 단계에서 role만 승격한다.
3. 방금 만든 사용자의 `auth.users.id` (UUID)를 대시보드에서 복사해 둔다.
   이 문서에서는 이 값을 `<ADMIN_USER_ID>`로 표기한다.

## 2. profiles.role을 admin으로 승격

Supabase SQL Editor에서 **직접, 수동으로** 아래를 실행한다. service_role 키나
비밀번호는 이 절차에 전혀 필요 없다 — SQL Editor는 이미 관리자 권한으로 실행된다.

```sql
-- <ADMIN_USER_ID>를 위 1단계에서 복사한 실제 UUID로 치환할 것.
update public.profiles
set role = 'admin', updated_at = now()
where id = '<ADMIN_USER_ID>';
```

이게 전부다. `dealer_profiles`에 남아있는 행은 그대로 둬도 무방하다 —
`role = 'admin'`이 되는 순간 앱의 모든 권한 분기는 `profiles.role`만 본다
(`services/auth/access-policy.ts`), `dealer_profiles`는 더 이상 읽히지 않는다.

## 3. 필요한 profiles row / role

- `public.profiles.role`은 `public.user_role` enum (`'dealer' | 'installer' | 'admin'`)이다.
- admin이 되기 위해 필요한 건 **오직** `profiles.id = auth.users.id`인 행의
  `role = 'admin'` 하나뿐이다. 다른 어떤 테이블에도 admin 전용 행을 추가할
  필요가 없다 (installer_profiles/installer_approvals는 installer 전용).

## 4. is_admin()과의 관계

`public.is_admin(check_user_id uuid default auth.uid())`
(`supabase/migrations/202607190001_v034_membership.sql:54-65`)는
`select exists(select 1 from public.profiles where id = check_user_id and role = 'admin')`를
실행하는 `SECURITY DEFINER` 함수다. `profiles`/`dealer_profiles`/`installer_profiles`/
`installer_approvals`의 모든 admin 열람용 RLS 정책이 `... or public.is_admin()`
형태로 이 함수를 호출한다. 즉 2단계에서 `profiles.role`을 `'admin'`으로 바꾸는
순간, 새 마이그레이션이나 별도 권한 부여 없이 이 사용자의 실제 로그인 세션이
즉시 전체 회원/거래/승인 데이터를 열람할 수 있게 된다.

## 5. 잘못 설정됐는지 확인하는 방법

```sql
-- 현재 admin으로 지정된 계정 전체를 확인 (email은 관리자 화면 밖에서만 조회)
select p.id, p.email, p.role, p.created_at
from public.profiles p
where p.role = 'admin'
order by p.created_at desc;
```

- 행이 0개면 admin이 아직 없는 것 — 1~2단계를 다시 확인.
- 원하는 계정이 아닌 다른 행이 섞여 있으면 아래 6번으로 즉시 강등.
- 앱에서는 해당 계정으로 로그인 후 `/admin`에 진입해 "회원 관리" 패널
  헤더에 뜨는 "실제 운영 데이터" 배지로 real 경로가 맞는지 확인할 수 있다
  (Demo 계정이면 "Demo 데이터" 배지가 대신 뜬다).

## 6. admin 권한 제거 방법

```sql
-- <ADMIN_USER_ID>를 강등할 계정의 UUID로 치환할 것.
-- 원래 dealer였는지 installer였는지에 맞는 role로 되돌린다.
update public.profiles
set role = 'dealer', updated_at = now()  -- 또는 'installer'
where id = '<ADMIN_USER_ID>';
```

주의: 이 사용자가 원래 `installer`였다면 `installer_profiles`/`installer_approvals`
행이 이미 존재하므로 `role = 'installer'`로 되돌리면 그대로 정상 동작한다.
원래 `dealer`였다면 `role = 'dealer'`로 되돌리면 된다. 두 테이블 모두 건드릴
필요 없다 — role 컬럼 하나가 유일한 권한의 근원이다.

## 하지 말아야 할 것

- `service_role` 키를 이 문서나 다른 어떤 문서에도 기록하지 말 것 — SQL Editor
  만으로 충분하다.
- `profiles` 테이블에 `insert`/`delete`로 새 admin 행을 만들지 말 것 — 반드시
  정상 회원가입으로 만들어진 기존 `auth.users` 행을 `update`로 승격할 것
  (`profiles.id`가 `auth.users(id)`를 참조하는 FK이므로, 먼저 auth 사용자가
  존재해야 한다).
- RLS를 완화하거나 `is_admin()` 로직을 바꾸지 말 것 — 이 절차는 기존 보안
  모델을 그대로 사용한다.
