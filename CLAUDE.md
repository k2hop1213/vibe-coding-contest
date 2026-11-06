# CLAUDE.md

3인 팀이 바이브코딩대회 결과물을 만드는 저장소입니다. 팀원 각자가 Claude Code로 작업합니다.

- 작업 전 `CONTRIBUTING.md`(협업 규칙)와 `docs/planning.md`(기획·API 계약)를 읽을 것.
- `main`에 직접 push 금지. `main`에서 `feat/<영역>-<설명>` 브랜치를 따서 PR로만 병합.
- 커밋: `<타입>: <요약> (#이슈번호)`, PR 제목: `[타입] 요약 (#이슈번호)`, PR 본문은 템플릿을 채울 것.
- 스택 PR(base가 다른 feature 브랜치)이면 PR 설명에 체인과 "Create a merge commit(squash 금지)" 경고를 넣을 것.
- API 키·`.env`는 절대 커밋하지 않는다. 새 환경변수는 `.env.example`에 키 이름만 추가.
- 프론트↔백엔드 API를 바꾸면 `docs/planning.md`의 API 계약도 같이 고칠 것.
- 세션 시작 루틴: `/catchup`
