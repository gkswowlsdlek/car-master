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

*이 파일은 다음 대시보드 리터치 라운드를 위한 메모다. 세션 메모리와 달리
저장소에 커밋되어 브랜치를 넘나들며 참조할 수 있다.*
