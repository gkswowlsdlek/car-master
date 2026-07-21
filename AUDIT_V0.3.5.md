# Car-Master v0.3.5 종합 안정화 감사

## 결론

v0.3.4.9의 화면·가격 가이드·사용자 흐름을 유지하면서, 실제 계정에서 발생할 수 있는 중복 요청, 원격 데이터 로딩 실패, 채팅 재전송, 첨부파일 경계조건, 세션 변경, 채팅 발신 역할 검증을 보강했다. Supabase 실제 환경 검증은 마이그레이션을 실행하지 않았으므로 v0.3.6 체크리스트로 분리한다.

## 확인 범위

- 인증·역할·승인: `services/auth/`, `lib/supabase/proxy.ts`, `app/page.tsx`
- 로컬 저장: `repositories/storage.ts`, `transaction-repository.ts`, `chat-repository.ts`, `profile-repository.ts`
- 실제 거래·거래방·채팅: `repositories/supabase-*.ts`, `hooks/use-transaction-store.ts`
- 첨부파일: `services/attachments/`
- 승인 시공점: `repositories/installer-directory-repository.ts`, `services/installer-search.ts`
- 화면 회귀: `components/dealer/`, `components/shop/`, `components/admin/`, `components/transactions/`
- 권한 정의: `supabase/migrations/202607190001_v034_membership.sql`, `202607210001_v035_foundation.sql`
- 빌드·배포 설정: `package.json`, `next.config.ts`, `vite.config.ts`, `vercel.json`

## localStorage 분류

| 키 | 데이터 | 분류 | 처리 |
|---|---|---|---|
| `car-master-transactions` | 데모 거래 | 데모 호환 | 삭제·자동 이전하지 않음 |
| `car-master-chat-rooms` | 데모 거래방·채팅 | 데모 호환 | 삭제·자동 이전하지 않음 |
| `car-master-user-profiles` | 데모 프로필 | 데모 호환 | 실제 계정은 Supabase 사용 |

공통 저장 래퍼는 손상 JSON을 빈 목록으로 안전 처리하고, 구형 배열 형식은 버전 1 구조로 보존 변환한다. 계정별 분리는 데모 저장소에는 적용되어 있지 않으므로 공용 기기에서 시험 계정을 사용할 때는 데이터가 공유될 수 있다. 실제 계정은 RLS가 적용된 Supabase 경로를 사용한다.

## 발견 및 처리

### P0

- 없음. 기존 빌드가 즉시 중단되는 문제는 재현되지 않았다.

### P1 — 수정

- 시공 요청 버튼 연속 클릭 시 중복 생성 가능: 전송 중 버튼 잠금과 상태 표시 추가.
- 거래·채팅 로딩 실패가 화면에서 빈 데이터처럼 보임: 한국어 오류, 로딩, 다시 시도 상태 추가.
- 메시지 전송 실패 후 입력과 첨부가 사라질 수 있음: 성공 후에만 초기화하고 전송 중 중복 입력 차단.
- Realtime 중복 또는 동일 시각 메시지 순서 불안정: ID 중복 제거와 시간·ID 기준 정렬.
- 0바이트·확장자/MIME 불일치 파일 허용: 공통 검증 추가.
- 서명 URL 생성 실패 후 고아 업로드 생성: 실패한 업로드를 제거하고 안내.
- 다른 탭 로그아웃·세션 갱신이 SPA 상태에 늦게 반영: Supabase 인증 상태 구독 추가.
- 클라이언트가 채팅 `sender_role`을 임의 지정 가능: RLS에서 실제 프로필 역할과 일치하도록 제한.
- 수정 대상 거래가 없거나 권한이 없는 경우 성공처럼 종료: 반환 행 확인 추가.

### P1 — v0.3.6 확인 필요

- 실제 Supabase에서 딜러·시공점·관리자별 RLS 허용/거부 결과.
- 두 기기에서 Realtime 전달, 재연결, 중복 수신 여부.
- Storage 업로드·다운로드·서명 URL 만료와 참여자 외 접근 차단.
- 이미 적용된 이전 버전 SQL이 있다면 변경된 제약·정책을 별도 증분 마이그레이션으로 만들어야 하는지 확인.

### P2 — 제안만

- 데모 localStorage를 시험 계정별 네임스페이스로 분리.
- 거래방이 많아질 때 페이지네이션과 증분 Realtime 반영.
- 첨부파일 업로드 후 메시지 전송을 영구 취소했을 때 고아 파일 정리 작업.
- 네트워크 상태에 따른 자동 재시도와 오프라인 표시.

## 회귀 영향

- 가격 데이터와 `data/installation-price-guide.ts`, `data/pricePackages.ts`는 변경하지 않았다.
- 라우팅, 역할별 시작 화면, 데모 계정, 관리자 승인 UI는 유지했다.
- 결제·정산·지도·새 관리자 기능은 추가하지 않았다.
- SQL 파일은 정적으로만 수정했고 데이터베이스에는 실행하지 않았다.

