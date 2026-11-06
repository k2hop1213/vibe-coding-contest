---
description: 라운드 시작 — 최신화, 내 리뷰 요청·이슈 확인, 가장 급한 일 하나 처리
---
GitHub 아이디는 `@me`로 자동 인식되니 따로 확인할 필요 없다.

1. **최신화 (문서는 바뀐 것만 읽기)**
   ```bash
   git switch -q main && B=$(git rev-parse HEAD) && git pull -q origin main && git diff --stat $B HEAD -- docs/planning.md CONTRIBUTING.md CLAUDE.md
   ```
   출력에 파일이 있을 때만 그 파일을 읽어라. 이번 세션에서 `docs/planning.md`를 아직 안 읽었다면 그것만 읽어라.
2. **할 일 조회 (출력 최소화)**
   ```bash
   gh pr list --search "review-requested:@me" --state open --json number,title,headRefName
   gh pr list --author @me --state open --json number,title,reviewDecision
   gh issue list --assignee @me --state open --json number,title,labels
   ```
3. 우선순위: ① 내게 온 리뷰 → `.claude/commands/review.md` 절차 ② 내 PR이 CHANGES_REQUESTED → 지적을 재현·확인 후 수정, 무엇을 고쳤는지 코멘트 ③ 할당 이슈 중 선행 작업이 풀린 것 하나 → `.claude/commands/task.md` 절차.
   **한 라운드에 한 가지만** 끝내고 멈춰라.
4. 마지막에 한국어 3줄 요약. 할 게 없으면 "새로 할 일 없음" 한 줄.
