# CLAUDE.md
> ⚠️ 이 파일은 **모든 메시지마다 토큰을 먹습니다.** 짧게 유지하고, 긴 설명은 `docs/`로.

3인 팀이 바이브코딩대회 결과물을 만드는 저장소입니다. 팀원 각자가 Claude Code로 작업합니다.

## 프로젝트
- 주제: **AI로 다시 쓰는 대학생활** (예: AI 캠퍼스 사주풀이, 교수님과 나의 궁합) — 문제 해결을 넘어 새로운 경험을 만드는 창의적인 웹
- 아이디어: **하루릴스** — 사진·일기 + 스타일 태그 → AI 릴스(장면 JSON + 웹 플레이어) → 달력 다이어리. 상세·API 계약은 `docs/planning.md`
- 스택: `app/` React 19 + TS + Vite + Tailwind v4 (테스트 Vitest, 린트 oxlint) · `server/` FastAPI (Python 3.13, 테스트 pytest, 린트 ruff) · Claude API
- 폴더: `app/` = 프론트, `server/` = 백엔드·AI, `docs/` = 기획
- 실행: `cd server && .venv/Scripts/python -m uvicorn app.main:app --reload` (8000) + `cd app && npm run dev` (5173, /api·/media는 8000으로 프록시)
- 테스트: `cd app && npm test` · `cd server && .venv/Scripts/python -m pytest -q`
- 린트: `cd app && npm run lint` · `cd server && .venv/Scripts/python -m ruff check .`

## 출처 표기 (대회 규칙, 필수)
- 외부 코드·스니펫·튜토리얼·이미지·폰트·데이터를 참고하면 **같은 커밋에서** `CREDITS.md`에 추가하고 해당 코드 위에 `// 출처: <URL>` 주석. 출처를 모르는 코드는 넣지 않는다.

## 작업 원칙 (토큰 절약)
- 현재 상황의 단일 출처는 `docs/planning.md`. `CONTRIBUTING.md`·`docs/REFERENCE.md`는 필요할 때만 연다.
- 레포 전체를 훑지 마라. 지정된 파일·이슈 범위만 읽고, 위치를 모르면 Grep으로 좁혀라. 큰 파일은 필요한 부분만.
- 설명보다 코드. 응답 끝 요약은 **3줄 이내**: 변경 파일 / 검증 결과 / 남은 일.
- 테스트·린트는 변경 영역만. 고치지 않은 채 같은 명령을 반복 실행하지 마라.
- 같은 실패에 수정 시도 **2회 넘게 반복 금지** → 멈추고 원인 가설 + 질문.
- 파일 3개 이상 바꾸는 작업은 계획 5줄을 먼저 보여주고 OK를 받은 뒤 구현.
- 새 의존성 추가, 폴더 구조 변경, API 계약 변경은 먼저 물어봐라.
- 서브에이전트(Agent)는 사용자가 요청할 때만.

## 협업 규칙 요약 (상세: CONTRIBUTING.md)
- `main`에 직접 push 금지. `main`에서 `feat|fix/<영역>-<설명>` 브랜치를 따서 PR로만 병합.
- 커밋: `<타입>: <요약> (#이슈번호)`, PR 제목: `[타입] 요약 (#이슈번호)`, PR 본문은 템플릿을 채울 것.
- 스택 PR(base가 다른 feature 브랜치)이면 PR 설명에 체인과 "Create a merge commit(squash 금지)" 경고를 넣을 것.
- API 키·`.env`는 절대 커밋하지 않는다. 새 환경변수는 `.env.example`에 키 이름만 추가.
- 프론트↔백엔드 API를 바꾸면 `docs/planning.md`의 API 계약도 같이 고칠 것. 구현 전에는 실제 서버 코드로 재확인.

## 커맨드
`/catchup` 라운드 시작 · `/task <이슈>` 구현 · `/review <PR>` 리뷰 · `/kickoff <주제>` 주제 발표 직후 1회 (사용법: `docs/PROMPTING.md`)
