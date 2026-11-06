# 🤝 바이브코딩대회 협업 매뉴얼 (CONTRIBUTING)

> 3인 팀이 Issues와 Pull Requests로 협업하기 위한 규칙입니다.
> **작업을 시작하기 전에 이 문서를 먼저 읽어주세요.**

---

## 1. 전체 개발 흐름

```
① 이슈 생성          "무엇을 할지" 정의 (기능/버그)
      ↓
② 작업 브랜치 생성    feat/xxx 또는 fix/xxx  (main에서 분기)
      ↓
③ 코드 작성 + 커밋    작은 단위로 자주 커밋
      ↓
④ PR 생성 → main     작업 브랜치를 main으로 병합 요청
      ↓
⑤ 코드 리뷰          팀원 1명 이상 승인(Approve) + CI 확인
      ↓
⑥ main 병합 (데모/제출)
```

**핵심 원칙**: 3인 팀이라 `dev` 없이 `feat/* → main`으로 단순화했습니다.
`main`에 직접 push하지 않습니다 (브랜치 보호로 막혀 있음).

---

## 2. 브랜치 전략

| 브랜치 | 용도 | 병합 방향 |
|--------|------|-----------|
| `main` | 데모/제출용 안정 버전. 직접 작업 ❌ | — |
| `feat/*` | 새 기능 개발 | `feat/* → main` |
| `fix/*` | 버그 수정 | `fix/* → main` |
| `chore/*` | 설정·골격·문서 정비 | `chore/* → main` |

브랜치 이름: `<타입>/<영역>-<설명>` (예: `feat/api-login`, `fix/ui-button-crash`)

| 영역 키워드 | 담당 파트 |
|---|---|
| `ui` | 프론트엔드 · 화면 |
| `api` | 백엔드 · 서버 · AI 연동 |
| `infra` | CI · 배포 · 환경 설정 · 문서 |

> 대회 주제가 정해지면 위 영역을 실제 구성에 맞게 고치세요.

### 병합 방식 — 가장 중요한 규칙

| 상황 | 소스 브랜치가 병합 후에도 살아있나 | 병합 방식 |
|---|---|---|
| `feat/* → main` | ❌ 병합 후 삭제 | **Squash and merge** |
| **스택 PR** (base가 다른 feature 브랜치) | ✅ 위에 다른 PR이 매달려 있음 | 🚨 **Create a merge commit** |

**판단 기준: squash는 소스 브랜치를 버릴 때만.**
병합 후에도 그 브랜치를 계속 쓴다면(그 위에 다른 PR이 스택된 feature 브랜치) squash가 커밋 이력을 압축해 새 커밋 ID를 만들고, git이 원본과의 공통 조상을 못 찾아 다음 병합에서 "내용은 같은데 충돌"이 납니다.

**스택 PR**이란 PR의 base가 `main`이 아니라 다른 feature 브랜치인 경우입니다. 앞 작업이 끝나기 전에 이어서 작업할 때 생깁니다. PR 설명에 체인을 명시하고 병합 방식을 굵게 표시하세요:

```
⚠️ 스택 PR입니다: main ← feat/A (#12) ← feat/B (이 PR)
🚨 병합 시 Create a merge commit (squash 금지)
```

---

## 3. 이슈 사용법

**모든 작업은 이슈에서 시작합니다.**

- 제목: `[타입] 요약` (예: `[Feat] 로그인 화면 구현`)
- 담당자(Assignee)를 반드시 지정 — 보통 해당 영역 오너
- 템플릿은 `.github/ISSUE_TEMPLATE/`에 있음
- 착수할 때 이슈에 "지금 착수합니다" 코멘트를 남겨 중복 작업을 막습니다.

---

## 4. 커밋 규칙

```
<타입>: <한 줄 요약> (#이슈번호)
```

`feat`/`fix`/`docs`/`style`/`refactor`/`test`/`chore` — 작은 단위로 자주 커밋하세요.

---

## 5. PR 규칙

- 제목: `[타입] 요약 (#이슈번호)`
- 템플릿은 `.github/PULL_REQUEST_TEMPLATE.md`가 자동으로 채워줍니다.
- 병합 후 작업 브랜치는 삭제합니다(단, 스택 PR의 base 브랜치는 위에 다른 PR이 있으면 삭제 금지).

---

## 6. 코드 리뷰 규칙

- 대회 기간에는 PR이 올라오면 **가능한 한 바로** 확인합니다.
- **PR 설명을 그대로 믿지 말고, 실제 diff와 관련 코드를 대조해서 검증하세요.** 특히 API를 호출하는 프론트 코드는 실제 백엔드 응답 필드명·상태 코드를 확인할 것.
- AI가 생성한 코드도 똑같이 리뷰합니다 — "AI가 짰으니 맞겠지" 금지.
- 승인 기준: 이슈 요구사항 충족 / 다른 파트를 깨뜨리지 않음 / 민감 정보 미포함.

---

## 7. 담당자별 작업 영역

| 영역 | 담당자 | 브랜치 접두어 | GitHub |
|------|--------|---------------|--------|
| PM & Infra · 문서 | [이름] | `feat/infra-*` | [@k2hop1213](https://github.com/k2hop1213) |
| Frontend | [이름] | `feat/ui-*` | [@sijin2170](https://github.com/sijin2170) |
| Backend · AI | [이름] | `feat/api-*` | [@songkh1201](https://github.com/songkh1201) |

> PM(@k2hop1213)이 `main` 병합의 최종 관리자를 겸합니다.
> 이 표와 `.github/CODEOWNERS`는 항상 서로 일치해야 합니다.

---

## 8. 자주 하는 실수 & 주의사항

- **main에 직접 push 금지** → 반드시 PR로만
- **API 키, `.env`, 서비스 계정 키 커밋 금지** → `.gitignore`로 관리, 값은 `.env.example`에 키 이름만
- **거대한 PR 금지** → 기능 단위로 잘게 나누기
- **오래된 브랜치로 작업 금지** → 작업 전 항상 `git pull origin main`
- **CI 체크가 비어 있는 것과 초록인 것은 다릅니다** — 비어 있으면 아무것도 검증 안 된 것
- **출처 표기 (대회 규칙)** → 외부 코드·자료를 참고하면 같은 커밋에서 [`CREDITS.md`](CREDITS.md)에 추가하고 코드에 `// 출처: <URL>` 주석. 리뷰어는 출처 없는 "어디서 본 듯한" 코드를 반려합니다.

### 🔒 브랜치 보호 설정 (적용됨)

`main`에 다음이 설정되어 있습니다:
- ✅ Require a pull request before merging
- ✅ Require approvals (1명 이상)
- ✅ Do not allow bypassing the above settings
- ⏳ Require review from Code Owners — 팀원 아이디를 CODEOWNERS에 넣은 뒤 켜기

---

**질문이나 논의가 필요하면 Issues에 남겨주세요.**
