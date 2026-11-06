---
description: 이슈 하나 구현 → 검증 → PR
argument-hint: <이슈번호> [추가 지시]
---
대상: $ARGUMENTS  (첫 숫자가 이슈 번호, 나머지는 추가 지시)

1. `gh issue view <번호> --json title,body,assignees,comments` 로 읽어라.
   - 다른 사람이 이미 "착수" 코멘트를 남겼으면 멈추고 알려라.
   - 아니면 `gh issue comment <번호> --body "지금 착수합니다"`.
2. 필요한 파일만 읽어라: 이슈에 언급된 파일 + `docs/planning.md`의 API 계약 + (API 호출이면) 실제 서버 핸들러. 계약과 서버 코드가 다르면 멈추고 보고.
3. 브랜치: `main`에서 `feat|fix/<영역>-<설명>`. 아직 병합 안 된 PR에 의존하면 그 브랜치 위에 스택.
4. 파일 3개 이상 바뀌면 계획 5줄 먼저 보여주고 멈춤. 아니면 바로 구현.
5. 변경 영역의 린트/테스트만 실행. 실패 시 수정 최대 2회, 그래도 실패면 멈추고 원인 보고.
6. 커밋 `<타입>: 요약 (#번호)` → push → `gh pr create --base <main 또는 스택 base> --title "[타입] 요약 (#번호)" --body-file <작성한 본문>`.
   본문은 `.github/PULL_REQUEST_TEMPLATE.md` 형식, `Closes #번호`, 검증 상태는 솔직하게. 스택이면 체인과 "Create a merge commit" 경고 필수.
7. 3줄 요약 (PR 번호 / 검증 결과 / 남은 일).
