# Car-Master v0.3.4.9 기반 안정화

- 실제 회원의 신규 거래, 거래방과 메시지를 Supabase에 저장합니다.
- 거래 참여자는 다른 기기에서도 Realtime 채팅을 이어갈 수 있습니다.
- 단일 이미지 또는 문서 첨부파일을 비공개 Supabase Storage에 저장합니다.
- 관리자에게 승인된 실제 시공점만 딜러 검색과 시공 요청에 연결합니다.
- 위치 정보가 없는 시공점도 `거리 정보 없음`으로 노출합니다.
- 기존 브랜드와 제품별 가격 UI를 유지하면서 화면 명칭을 권장 시공 패키지 가이드로 변경합니다.
- 데모 세션과 기존 localStorage 데이터는 삭제하거나 자동 이전하지 않습니다.

## 배포 전 필수 작업

1. v0.3.4 회원 Migration 적용 여부를 확인합니다.
2. `supabase/migrations/202607210001_v035_foundation.sql`을 적용합니다.
3. Supabase Realtime에서 `chat_messages`, `transactions` Publication을 확인합니다.
4. 딜러·승인 시공점·관리자 실제 계정으로 RLS와 파일 다운로드를 검증합니다.
