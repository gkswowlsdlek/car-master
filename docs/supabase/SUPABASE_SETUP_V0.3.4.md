# Car-Master V0.3.4 Supabase 설정

## 1. 프로젝트 생성

Supabase에서 새 프로젝트를 생성합니다. Production 데이터베이스에 기존 데이터를 삭제하는 명령은 실행하지 않습니다.

## 2. DB 마이그레이션 적용

Supabase SQL Editor에서 `supabase/migrations/202607190001_v034_membership.sql`을 새 프로젝트에 한 번 적용합니다.

생성되는 구조:

- `profiles`: 인증 사용자와 서비스 역할
- `dealer_profiles`: 딜러 회원 정보
- `installer_profiles`: 시공점 사업자 및 서비스 정보
- `installer_approvals`: 시공점 승인 상태
- Auth 사용자 생성 Trigger
- 사용자 본인 및 관리자 권한에 맞춘 RLS 정책

## 3. Auth 설정

- Email/Password 로그인을 활성화합니다.
- Site URL을 실제 Vercel 주소로 설정합니다.
- Redirect URLs에 다음 주소를 추가합니다.
  - `http://localhost:3000/auth/callback`
  - `https://car-master-nine.vercel.app/auth/callback`
- 운영 정책에 따라 이메일 확인 기능을 활성화합니다.

## 4. 환경변수

로컬 `.env.local`과 Vercel Production에 다음 값을 등록합니다.

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

기존 프로젝트만 `NEXT_PUBLIC_SUPABASE_ANON_KEY`를 publishable key 대신 사용할 수 있습니다. Service role 또는 secret key는 현재 애플리케이션에 필요하지 않으며 브라우저에 노출하면 안 됩니다.

## 5. 최초 관리자 지정

관리자 계정은 일반 회원가입에서 만들 수 없습니다. 먼저 이메일 회원가입을 완료한 계정을 Supabase SQL Editor에서 명시적으로 승격합니다.

```sql
update public.profiles
set role = 'admin', updated_at = now()
where email = '관리자이메일@example.com';
```

승격 대상 이메일을 정확히 확인한 뒤 실행합니다. 브라우저 값이나 회원가입 metadata만으로 관리자 권한을 만들 수 없습니다.

## 6. Vercel 재배포

환경변수를 Production에 등록한 뒤 새 배포를 실행합니다. 배포 후 딜러 가입, 시공점 pending 진입, 관리자 승인, 승인된 시공점 재로그인을 순서대로 확인합니다.
