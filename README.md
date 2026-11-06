# 바이브코딩대회 — [프로젝트명]

> 대회 주제: **(발표 후 기입)**

## 팀

| 역할 | 이름 | GitHub |
|---|---|---|
| PM & Infra | [이름] | [@k2hop1213](https://github.com/k2hop1213) |
| Frontend | [이름] | @TEAMMATE_B |
| Backend · AI | [이름] | @TEAMMATE_C |

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

## 폴더 구조 (스택 확정 후 갱신)

```
app/      프론트엔드
server/   백엔드 · AI 연동
docs/     기획 · 참고 문서
```
