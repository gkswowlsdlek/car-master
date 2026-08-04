# Demo Messenger 이미지 첨부 영속성 — 수동 활성화 절차

이 저장소에는 지금 `SUPABASE_SERVICE_ROLE_KEY`가 어디에도 설정되어 있지
않다 (`vercel env ls`로 Production/Preview 확인 완료 — `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_NAVER_MAP_CLIENT_ID`
3개뿐). 이 문서의 절차를 완료하기 전까지 Demo Messenger 첨부파일은 기존과
동일하게 세션 한정(`LocalAttachmentProvider`, 새로고침하면 사라짐)으로
동작한다 — 코드는 이미 배포돼 있어도 아무것도 깨지지 않는다.

## 왜 service-role 키가 필요한가

Demo 로그인은 `lib/demo-session.ts`의 서명된 쿠키일 뿐, 실제 Supabase Auth
세션이 아니다. Real 첨부파일이 쓰는 `transaction-attachments` 버킷의 storage
정책은 전부 `to authenticated ... using (can_access_room(...))` 형태라
`auth.uid()`가 없는 Demo 요청은 애초에 통과할 수 없다 — 이 정책을 완화하는
것은 이번 작업에서 절대 금지 사항이다. 그래서 Demo 전용 버킷은 anon/
authenticated 누구에게도 권한을 주지 않고(`202608040001` migration),
`app/api/demo-attachments/*` 서버 라우트가 Demo 세션 쿠키 + role +
room 존재 여부를 자체 검증한 뒤에만 service-role 클라이언트로 업로드/서명
URL 발급을 대행한다.

## 1. Migration 적용

Supabase SQL Editor에서 `supabase/migrations/202608040001_v0313_demo_attachment_storage.sql`
전체를 실행한다. `demo-transaction-attachments`라는 이름의 private 버킷
하나를 만들 뿐, 기존 버킷/정책/테이블은 전혀 건드리지 않는다 (idempotent —
`on conflict (id) do nothing`).

## 2. Vercel에 SUPABASE_SERVICE_ROLE_KEY 추가

1. Supabase 대시보드 → Project Settings → API → **service_role** 키를
   복사한다 (이 문서에 값을 기록하지 말 것).
2. Vercel 대시보드 → car-master 프로젝트 → Settings → Environment Variables
   → 새 변수 추가:
   - Name: `SUPABASE_SERVICE_ROLE_KEY`
   - Value: (복사한 service_role 키)
   - Environment: **Production**과 **Preview** 둘 다 체크
   - 절대로 `NEXT_PUBLIC_` 접두사를 붙이지 말 것 — 이 변수는 서버 전용이며,
     실제로 `lib/supabase/service.ts`는 route handler(app/api/demo-attachments/*)
     밖에서는 참조되지 않는다.
3. 저장 후 재배포(다음 Production 배포부터 자동 반영됨. 즉시 반영하려면
   Vercel 대시보드에서 기존 배포를 "Redeploy").

## 3. 활성화 확인

배포 후 아래를 열어서 `{"ready":true}`가 나오면 활성화된 것이다:

```
https://car-master-nine.vercel.app/api/demo-attachments/ready
```

`{"ready":false,"reason":"service-role-missing"}`이면 2단계가 안 된 것이고,
`{"reason":"bucket-missing"}`이면 1단계가 안 된 것이다.

이 라우트는 인증 없이도 boolean 하나만 반환하므로(민감정보 없음), 브라우저에서
직접 열어서 확인해도 안전하다.

## 4. 롤백

- 이미지가 즉시 이전 동작(세션 한정)으로 되돌아가야 하면: Vercel에서
  `SUPABASE_SERVICE_ROLE_KEY`를 삭제하거나 값을 비우면 된다 — 코드는 다시
  자동으로 `LocalAttachmentProvider`로 폴백한다. 재배포 불필요, 다음 페이지
  로드부터 즉시 반영.
- 버킷 자체를 없애려면 Supabase 대시보드에서 `demo-transaction-attachments`
  버킷을 수동 삭제한다 (git rollback으로 되돌아가지 않는 부분 — 완료 보고서
  참고).
