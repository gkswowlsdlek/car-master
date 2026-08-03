# Car-Master v0.3.13 — Demo Admin Installer-Membership Approval Parity

v0.3.13은 Admin Workspace에서 유일하게 Demo/Real parity가 없던 시공점 가입 승인 화면을 채우는 작은 범위의 버전입니다. Dealer 1/1, Installer 2/2는 이미 자신의 업무 흐름에 대해 Demo/Real parity가 있었지만, Admin 3/3의 시공점 가입 심사 패널은 정적 안내 문구만 보여줄 뿐 아무 동작도 하지 않았습니다.

## 이번 버전에서 달라진 점

- Demo Admin(3/3)이 시공점 가입 신청을 확인하고 승인·반려·활동정지 처리를 직접 눌러볼 수 있는 격리된 데모 백엔드를 추가했습니다.
- 데모 데이터는 실제 회원 테이블과 FK로 전혀 연결되지 않으며(`demo_transactions`, `demo_chat_messages`와 동일한 물리적 분리 원칙), 모든 상태 변경은 `demo_review_installer_application` RPC 한 경로로만 가능합니다.
- 승인 대기, 승인 완료, 반려 상태를 각각 보여주는 가상 시공점 3건을 시드했습니다.
- `InstallerApprovalPanel`은 마이그레이션이 실제로 적용되었는지(`isSchemaReady()`) 먼저 확인한 뒤에만 데모 백엔드로 전환되며, 적용 전에는 기존과 동일한 안내 화면을 보여줍니다.
- 실제(Real) 관리자 계정의 승인 로직은 분기 조건이 변경 전과 수식적으로 동일함을 코드 검증으로 확인했습니다.

## 추가로 발견하고 고친 문제 (v0.4 이전 정리 작업)

owner가 딜러/시공점/관리자 관점으로 직접 검증하기 전에, 같은 계열의 문제가 더 있는지 전체 UI를 훑어 다음을 발견하고 고쳤습니다. 모두 로컬 브라우저(Playwright)로 실제 클릭까지 확인했습니다.

- 관리자 운영 현황의 "주간 거래량" 차트가 실제 거래와 무관한 고정 수치를 보여주던 문제 → 실제 거래 생성일 기준으로 계산하도록 수정.
- 딜러 대시보드의 "확인 대기 거래" 등 빠른 실행 버튼이 거래 관리 화면으로 이동만 시킬 뿐 상태 필터를 적용하지 않던 문제 → 클릭한 버튼에 맞는 필터가 실제로 적용되도록 수정.
- "오늘 입고 예정" 카드의 건수와 클릭 시 보이는 목록이 서로 다른 기준으로 계산되던 불일치 수정.
- 거래 관리 화면에 "숨기기" 버튼이 없어 메신저를 거치지 않으면 거래를 숨길 방법이 없던 문제 → "거래 숨기기" 버튼 추가.
- 관리자 전체 거래 모니터링에서 "담당 딜러" 라벨 아래 시공점명이 잘못 표시되던 문제 → 담당 딜러와 시공점을 각각 올바르게 표시.
- 사이드바·랜딩 페이지에 남아있던 `v0.3.11` 하드코딩 버전 표기를 실제 버전과 맞춤.

## 유지된 기반

- Supabase 거래, 거래방, 채팅, 첨부파일 및 Realtime 연결
- 역할별 거래 접근 권한과 RPC 기반 상태 변경
- Dealer, Installer 워크스페이스의 기존 Demo/Real parity 구조
- 실제 시공점 가입 승인(`installer_profiles`/`installer_approvals`) 테이블과 RLS 정책

## 이번 버전에 포함하지 않은 항목

- **`202608030001_v0313_demo_installer_membership.sql` 마이그레이션의 Production 적용** — 아직 미적용 상태입니다.
- Production에서의 Demo Admin 승인 패널 라이브(인터랙티브) 검증
- 새로운 결제 또는 정산 기능
- 다른 워크스페이스 재설계

## 검증 범위

- 단위 테스트 63건 전체 통과 (`pnpm test`)
- TypeScript 타입 검사 (`tsc --noEmit`)
- ESLint 0 warning / 0 error
- Production build (`next build`)
- `pnpm dev` + Playwright(Chromium)로 딜러(1/1)·관리자(3/3) 계정 실제 클릭 검증 (필터 적용, 숨기기 버튼, 라벨 표시)

## 아직 코드로 못 고치는 것 (제 권한 밖)

- **`202608030001_v0313_demo_installer_membership.sql` 마이그레이션의 Production 적용** — 이 작업 환경에 Production Supabase 접속 정보가 없어 직접 적용이 불가능합니다.

## 다음 단계 (v0.4 이전 남은 작업, owner 확인 필요)

1. 마이그레이션을 Production Supabase에 적용 (Supabase 대시보드 SQL Editor 또는 CLI + 접속 정보 필요)
2. Demo Admin 3/3 계정으로 승인 패널 라이브 인터랙션 검증
3. 딜러·시공점·관리자 3역할을 직접 사용해보며 회귀 확인
4. main 브랜치 반영 및 필요 시 Vercel Production 배포
