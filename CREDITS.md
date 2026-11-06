# 출처 (CREDITS)

> 대회 규칙: **참고한 코드는 출처를 명시해야 합니다.**
> 외부 코드·스니펫·튜토리얼·이미지·폰트·데이터·프롬프트를 참고하거나 가져왔다면, **그 코드를 커밋할 때 같은 커밋에서** 아래 표에 한 줄 추가하세요.
> 코드에도 해당 부분 위에 `// 출처: <URL>` 주석을 남깁니다.

## 참고한 코드 · 자료

| 무엇을 | 출처 (URL) | 라이선스 | 어디에 썼나 (파일) | 추가한 사람 |
|---|---|---|---|---|
| 달력 홈 디자인 (그라데이션 패널 · 큰 연도 · 오늘 날짜 원) — "One Page Calendar" by Laude Pirera Ardi, 디자인만 참고·에셋/코드 미사용 | https://freebiesbug.com/figma-freebies/one-page-calendar/ | 명시 없음 | `app/src/components/CalendarPanel.tsx`, `app/src/App.tsx` | @sijin2170 |
| 예: 카드 뒤집기 애니메이션 | https://example.com/... | MIT | `app/src/components/Card.tsx` | @k2hop1213 |

## 사용한 라이브러리 · 프레임워크

| 이름 | 용도 | 라이선스 | 링크 |
|---|---|---|---|
| create-vite (`react-ts` 템플릿) | `app/` 초기 골격 생성 | MIT | https://github.com/vitejs/vite/tree/main/packages/create-vite |
| React | UI | MIT | https://react.dev |
| Vite | 개발 서버·번들러 | MIT | https://vite.dev |
| Tailwind CSS | 스타일 | MIT | https://tailwindcss.com |
| Vitest · Testing Library · jsdom | 프론트 테스트 | MIT | https://vitest.dev · https://testing-library.com |
| oxlint | 프론트 린트 | MIT | https://oxc.rs |
| FastAPI · Uvicorn | 백엔드 API 서버 | MIT · BSD-3 | https://fastapi.tiangolo.com · https://www.uvicorn.org |
| python-multipart · python-dotenv | 업로드 처리 · 환경변수 | Apache-2.0 · BSD-3 | https://github.com/Kludex/python-multipart · https://github.com/theskumar/python-dotenv |
| Anthropic Python SDK | Claude API 호출 | MIT | https://github.com/anthropics/anthropic-sdk-python |
| pytest · httpx · Ruff | 백엔드 테스트·린트 | MIT · BSD-3 · MIT | https://pytest.org · https://www.python-httpx.org · https://docs.astral.sh/ruff |

## 사용한 AI 도구 · API

| 이름 | 용도 |
|---|---|
| Claude Code (Anthropic) | 개발 보조 (바이브코딩) |

## 협업 환경

- `.github/` 템플릿·CI, `CONTRIBUTING.md`의 브랜치·병합 규칙, `.claude/commands/catchup.md`는 팀 내부 자료인 **github-collab-kit**(FogApp 프로젝트에서 쓴 협업 방식)을 이 대회에 맞게 고쳐 사용했습니다.
