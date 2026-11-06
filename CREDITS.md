# 출처 (CREDITS)

> 대회 규칙: **참고한 코드는 출처를 명시해야 합니다.**
> 외부 코드·스니펫·튜토리얼·이미지·폰트·데이터·프롬프트를 참고하거나 가져왔다면, **그 코드를 커밋할 때 같은 커밋에서** 아래 표에 한 줄 추가하세요.
> 코드에도 해당 부분 위에 `// 출처: <URL>` 주석을 남깁니다.

## 참고한 코드 · 자료

| 무엇을 | 출처 (URL) | 라이선스 | 어디에 썼나 (파일) | 추가한 사람 |
|---|---|---|---|---|
| 기록 작성 화면 레이아웃 (일기 입력 · 스타일 태그 칩 · 사진/동영상 추가 버튼) | vStory 앱 화면 (디자인 참고, 코드 미사용) — URL 추가 필요 | — | `app/src/components/EntryForm.tsx` | @k2hop1213 |
| 달력 홈 디자인 (그라데이션 패널 · 큰 연도 · 오늘 날짜 원) — "Calendar 2022 (One Page Calendar)" by Agensip (디자이너 Laude Pirera Ardi), 디자인만 참고·에셋/코드 미사용 | 원본: https://agensip.gumroad.com/l/calendar2022 · 소개: https://freebiesbug.com/figma-freebies/one-page-calendar/ | 명시 없음 (무료 배포) | `app/src/components/CalendarPanel.tsx`, `app/src/App.tsx` | @sijin2170 |
| 예: 카드 뒤집기 애니메이션 | https://example.com/... | MIT | `app/src/components/Card.tsx` | @k2hop1213 |

## 사용한 라이브러리 · 프레임워크

| 이름 | 용도 | 라이선스 | 링크 |
|---|---|---|---|
| Pretendard (가변 폰트, dynamic subset) | 웹 전체 기본 폰트 (`app/src/index.css`) | OFL-1.1 | https://github.com/orioncactus/pretendard |
| create-vite (`react-ts` 템플릿) | `app/` 초기 골격 생성 | MIT | https://github.com/vitejs/vite/tree/main/packages/create-vite |
| React | UI | MIT | https://react.dev |
| Vite | 개발 서버·번들러 | MIT | https://vite.dev |
| Tailwind CSS | 스타일 | MIT | https://tailwindcss.com |
| Vitest · Testing Library · jsdom | 프론트 테스트 | MIT | https://vitest.dev · https://testing-library.com |
| oxlint | 프론트 린트 | MIT | https://oxc.rs |
| FastAPI · Uvicorn | 백엔드 API 서버 | MIT · BSD-3 | https://fastapi.tiangolo.com · https://www.uvicorn.org |
| python-multipart · python-dotenv | 업로드 처리 · 환경변수 | Apache-2.0 · BSD-3 | https://github.com/Kludex/python-multipart · https://github.com/theskumar/python-dotenv |
| Anthropic Python SDK | Claude API 호출 | MIT | https://github.com/anthropics/anthropic-sdk-python |
| Pillow | 업로드 사진을 Claude에 보내기 전 크기 축소·JPEG 변환 (`server/app/reel_ai.py`) | MIT-CMU (HPND) | https://python-pillow.org |
| pytest · httpx · Ruff | 백엔드 테스트·린트 | MIT · BSD-3 · MIT | https://pytest.org · https://www.python-httpx.org · https://docs.astral.sh/ruff |

## 사용한 AI 도구 · API

| 이름 | 용도 |
|---|---|
| Claude Code (Anthropic) | 개발 보조 (바이브코딩) |

## 협업 환경

- `.github/` 템플릿·CI, `CONTRIBUTING.md`의 브랜치·병합 규칙, `.claude/commands/catchup.md`는 팀 내부 자료인 **github-collab-kit**(FogApp 프로젝트에서 쓴 협업 방식)을 이 대회에 맞게 고쳐 사용했습니다.
