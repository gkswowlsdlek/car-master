# Car-Master v0.3.5 종합 안정화 진행 기록

## 작업 원칙

- 기준 버전: v0.3.4.9 (`main`)
- 작업 브랜치: `feat/v0.3.5-health-stabilization`
- 기존 가격 가이드의 브랜드·상품·가격·계산 구조는 변경하지 않는다.
- Supabase 마이그레이션 실행, `main` 병합, 운영 배포는 하지 않는다.
- 기존 `localStorage` 데이터는 삭제하거나 자동 이전하지 않는다.
- 확인 가능한 문제만 기존 구조 안에서 최소 범위로 수정한다.

## 1단계 — 저장소 감사 (완료)

### 확인한 범위

- 패키지 및 빌드 스크립트: `package.json`
- 거래 상태 로딩: `hooks/use-transaction-store.ts`
- 원격 거래 저장소: `repositories/supabase-transaction-repository.ts`
- 원격 채팅 저장소: `repositories/supabase-chat-repository.ts`
- 로컬 거래·채팅 저장소: `repositories/transaction-repository.ts`, `repositories/chat-repository.ts`
- 첨부파일: `services/attachments/supabase-attachment-provider.ts`
- 승인 시공점: `repositories/installer-directory-repository.ts`
- 인증: `services/auth/supabase-auth-provider.ts`, `services/auth/demo-auth-provider.ts`
- 데이터베이스 정의: `supabase/migrations/202607210001_v035_foundation.sql`

### 현재까지 발견한 문제

- P0 후보: 일부 사용자 안내 문구가 깨진 한글로 저장되어 있어 실제 화면 오류 메시지와 시공점 정보가 읽히지 않는다.
- P1 후보: 원격 거래·채팅 초기 로딩 실패가 훅에서 처리되지 않아 로딩/오류/재시도 상태를 표현할 수 없다.
- P1 후보: Realtime 이벤트마다 거래방 전체와 모든 첨부파일 서명 URL을 다시 불러와 메시지가 많아질수록 비용과 지연이 커질 수 있다.
- P1 후보: 메시지 전송 시 클라이언트가 보낸 `sender_id`, `sender_role`, `created_at`을 그대로 사용한다. 실제 권한은 SQL/RLS와 함께 정적 검토가 필요하다.
- P1 후보: 첨부파일의 0바이트 검사, 빈 안전 파일명 처리, 서명 URL 생성 실패 안내가 없다.
- P2 후보: 승인 시공점의 위치·응답 정보가 없을 때 표시되는 한국어 문구가 깨져 있다.

### 보호 중인 사용자 파일

- 미추적 `deliverables/`, `tools/` 폴더는 사용자 소유 파일로 판단하여 열거나 수정하거나 커밋하지 않는다.

## 2단계 — 안정성 수정 (완료)

- 중복 거래 생성 방지와 전송 상태 표시
- 원격 거래·채팅 로딩/오류/재시도 상태
- 채팅 실패 시 초안·첨부 보존과 중복 전송 방지
- 메시지 중복 제거·결정적 정렬·4,000자 제한
- 첨부파일 0바이트·크기·MIME·확장자 검증
- 서명 URL 실패 업로드 정리
- Supabase 세션 변경 구독
- 채팅 발신 역할 RLS 검증

## 3단계 — 테스트 보강 (완료)

- 메시지 중복·정렬 테스트
- 첨부파일 경계조건 테스트
- 구형·손상 localStorage 테스트
- 기존 테스트 포함 17개 통과

## 4단계 — 문서화 (완료)

- `AUDIT_V0.3.5.md`
- `RELEASE_NOTES_V0.3.5.md`
- `TEST_PLAN_V0.3.5.md`
- `SUPABASE_V0.3.6_CHECKLIST.md`

## 다음 작업

1. 변경 범위 최종 검토
2. 작업 브랜치 커밋·푸시·Draft PR 생성

## 5단계 — 최종 검증 (완료)

- `pnpm exec tsc --noEmit`: 성공
- `pnpm lint`: 성공
- `pnpm test`: 17개 전체 성공
- `pnpm build`: 성공
- `pnpm run build:vercel`: 성공
- 로컬 HTTP: `/` 200 및 서비스 제목 확인, `/login` 200 및 본문 확인
- 브라우저 시각 자동화: 실행 환경에서 사용 가능한 브라우저가 없어 미수행. 로컬 서버와 HTTP 렌더링은 정상이며, Preview에서 수동 시각 확인이 필요하다.
- Supabase 마이그레이션: 실행하지 않음
