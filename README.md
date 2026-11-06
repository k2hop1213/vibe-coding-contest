# 바이브코딩대회 — [프로젝트명]

> 대회 주제: **AI로 다시 쓰는 대학생활** — 문제 해결을 넘어, 새로운 경험을 만드는 창의적인 웹
>
> 참고한 코드·자료의 출처: [CREDITS.md](CREDITS.md)

## 팀

| 역할 | 이름 | GitHub |
|---|---|---|
| PM & Infra | [이름] | [@k2hop1213](https://github.com/k2hop1213) |
| Frontend | [이름] | [@sijin2170](https://github.com/sijin2170) |
| Backend · AI | [이름] | [@songkh1201](https://github.com/songkh1201) |

## 배포 주소

- 앱: https://haru-reels.vercel.app
- 서버: https://haru-reels-api.onrender.com (무료 플랜 — 15분 미사용 시 잠듦, 첫 요청 최대 1분)

배포 방법은 [docs/DEPLOY.md](docs/DEPLOY.md).

## 시작하기

```bash
git clone https://github.com/k2hop1213/vibe-coding-contest.git
cd vibe-coding-contest
cp .env.example .env   # 실제 키 값 채우기 (커밋 금지)
```

- 협업 규칙: [CONTRIBUTING.md](CONTRIBUTING.md) — **작업 전 필독**
- 기획/할 일: [docs/planning.md](docs/planning.md)
- Claude Code 프롬프트 요령(크레딧 절약): [docs/PROMPTING.md](docs/PROMPTING.md)

### Claude Code 커맨드

| 언제 | 누가 | 입력 |
|---|---|---|
| 주제 발표 직후 1회 | PM | `/kickoff <주제 원문>` |
| 매 라운드 시작 | 전원 | `/catchup` |
| 이슈 하나 작업 | 전원 | `/task 12` |
| PR 하나 리뷰 | 전원 | `/review 34` |

PR을 올렸으면 `/clear` 후 다음 작업 — 한 세션에 한 이슈.

## 로컬 실행

준비물: Node.js 24 LTS 이상, Python 3.13 이상

```bash
# 서버 (터미널 1)
cd server
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements-dev.txt   # macOS/Linux: .venv/bin/python
.venv/Scripts/python -m uvicorn app.main:app --reload         # http://localhost:8000/api/health
```

```bash
# 앱 (터미널 2)
cd app
npm install
npm run dev                                                   # http://localhost:5173
```

화면 오른쪽 위에 "서버 연결됨"이 보이면 둘 다 정상입니다.

달력이 비어 있으면 데모 데이터를 채우세요: `cd server && .venv/Scripts/python -m app.seed` (자세한 옵션은 [docs/DEPLOY.md](docs/DEPLOY.md)).

## 폴더 구조

```
app/      프론트엔드 — React + TypeScript + Vite + Tailwind
  src/lib/api.ts   API 호출 (개발: vite 프록시 / 배포: VITE_API_BASE)
server/   백엔드 · AI — FastAPI
  app/main.py      API 진입점
  tests/           pytest
docs/     기획(planning.md) · 참고 문서
```
