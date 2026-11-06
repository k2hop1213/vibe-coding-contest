---
description: PR 하나 리뷰 — 설명이 아니라 diff와 실제 코드로 검증 후 게시
argument-hint: <PR번호>
---
대상 PR: #$ARGUMENTS

1. `gh pr view $ARGUMENTS --json title,body,baseRefName,files` 와 `gh pr diff $ARGUMENTS` 를 읽어라. diff 밖의 파일은 아래 2번에 필요한 것만 연다.
2. 확인할 것 (이 순서로, 해당 없는 항목은 건너뜀):
   - 연결된 이슈의 할 일을 충족하는가
   - 프론트가 API를 호출하면: 서버 실제 코드의 경로·필드명·상태코드·에러 형식과 일치하는가 (`docs/planning.md` 계약과도)
   - 권한 검사 누락(남의 리소스 접근), 비밀값 포함
   - 스택 PR이면 본문에 체인과 merge commit 경고가 있는가
3. `gh pr checks $ARGUMENTS` — 체크가 **비어 있으면 "CI 미실행"으로 간주**하고 리뷰에 적어라.
4. 로컬 테스트는 변경 영역만, 1분 안에 끝날 때만.
5. 게시: `gh pr review $ARGUMENTS --approve|--request-changes|--comment --body-file <파일>`.
   - 막는 문제(blocking)만 request-changes. 사소한 건 최대 3개만 "nit:"로.
   - 각 지적은 `파일:줄 — 문제 — 제안` 한 줄.
6. 결과 한 줄 보고.
