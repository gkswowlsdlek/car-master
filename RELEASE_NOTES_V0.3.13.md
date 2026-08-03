# Car-Master v0.3.13 — Demo Admin Installer-Membership Approval Parity

v0.3.13은 Admin Workspace에서 유일하게 Demo/Real parity가 없던 시공점 가입 승인 화면을 채우는 작은 범위의 버전입니다. Dealer 1/1, Installer 2/2는 이미 자신의 업무 흐름에 대해 Demo/Real parity가 있었지만, Admin 3/3의 시공점 가입 심사 패널은 정적 안내 문구만 보여줄 뿐 아무 동작도 하지 않았습니다.

## 이번 버전에서 달라진 점

- Demo Admin(3/3)이 시공점 가입 신청을 확인하고 승인·반려·활동정지 처리를 직접 눌러볼 수 있는 격리된 데모 백엔드를 추가했습니다.
- 데모 데이터는 실제 회원 테이블과 FK로 전혀 연결되지 않으며(`demo_transactions`, `demo_chat_messages`와 동일한 물리적 분리 원칙), 모든 상태 변경은 `demo_review_installer_application` RPC 한 경로로만 가능합니다.
- 승인 대기, 승인 완료, 반려 상태를 각각 보여주는 가상 시공점 3건을 시드했습니다.
- `InstallerApprovalPanel`은 마이그레이션이 실제로 적용되었는지(`isSchemaReady()`) 먼저 확인한 뒤에만 데모 백엔드로 전환되며, 적용 전에는 기존과 동일한 안내 화면을 보여줍니다.
- 실제(Real) 관리자 계정의 승인 로직은 분기 조건이 변경 전과 수식적으로 동일함을 코드 검증으로 확인했습니다.

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

- 단위 테스트 58건 전체 통과 (`pnpm test`)
- TypeScript 타입 검사 (`tsc --noEmit`)
- ESLint (기존에 있던 미사용 변수 warning 1건 외 신규 오류 없음)
- Production build (`next build`)

## 다음 단계 (v0.4 이전 남은 작업)

1. 마이그레이션을 Production Supabase에 적용 (Supabase 대시보드 SQL Editor 또는 CLI + 접속 정보 필요)
2. Demo Admin 3/3 계정으로 승인 패널 라이브 인터랙션 검증
3. 실제 관리자 계정으로 기존 승인 경로 회귀 확인
4. main 브랜치 반영 및 필요 시 Vercel Production 배포
