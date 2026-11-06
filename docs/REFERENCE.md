# 5인 팀 GitHub 협업 셋업 가이드
### FogApp 프로젝트에서 실제로 쓴 방식 (Claude Code 팀원 활용 포함)

---

## 1. 팀 구조 — 트랙별 2인 페어링

5명을 **5개 트랙**으로 나누고, 트랙마다 **오너 1명 + 짝 리뷰어 1명**을 지정했습니다.

| 트랙 | 오너 | 짝 리뷰어 | 브랜치 접두어 |
|---|---|---|---|
| PM & Backend (서버·API) | A | B | `feat/api-*` |
| Mobile Frontend (앱 UI) | C | D | `feat/ui-*` |
| Map & Location | E | C | `feat/map-*` |
| Social & Matching | D | C | `feat/social-*` |
| DevOps & Data (인프라) | B | A | `feat/infra-*` |

**포인트**: 짝을 서로 겹치게 짜서(A↔B, C↔D처럼 페어를 순환) 한쪽이 자리를 비워도 리뷰가 막히지 않게 했습니다. PM이 `main`/`dev` 병합의 최종 관리자를 겸했습니다.

이 구조를 `.github/CODEOWNERS`에 그대로 옮기면 **PR을 올리는 순간 자동으로 적절한 리뷰어가 요청**됩니다:

```
# 기본 소유자 (세부 규칙 미매칭 시): PM + 짝
*                    @PM_ID @짝_ID

# 백엔드 — 오너A (짝: 오너B)
/server/             @오너A_ID @오너B_ID

# 모바일 프론트 — 오너C (짝: 오너D)
/app/                @오너C_ID @오너D_ID

# 인프라 — 오너B (짝: 오너A)
/.github/            @오너B_ID @오너A_ID
/docker-compose.yml  @오너B_ID @오너A_ID

# 문서 — PM (짝: 오너C)
/docs/               @PM_ID @오너C_ID
/README.md           @PM_ID @오너C_ID
```

> GitHub은 PR 작성자 본인을 리뷰어로 자동 지정하지 않습니다. 그래서 "오너가 자기 영역을 작업 → 짝이 자동 리뷰어로 붙는다" 구조가 자연스럽게 성립합니다. 규칙은 **마지막 매칭 우선**이라 세부 경로를 아래쪽에 적을수록 우선순위가 높습니다.

---

## 2. 브랜치 전략

```
main  ← 배포/제출용 안정 버전. 직접 push 금지
  ↑ (dev → main: 검증 끝난 dev를 승격)
dev   ← 통합 테스트. 각자 작업을 모으는 곳
  ↑ (feat/* → dev, fix/* → dev)
feat/영역-설명   fix/영역-설명   ← 개인 작업 브랜치
```

브랜치 이름: `<타입>/<영역>-<설명>` (예: `feat/social-matching`, `fix/auth-token-expire`)

### 병합 방식 — 여기가 가장 중요하고 가장 자주 틀리는 부분

| 상황 | 소스 브랜치가 병합 후에도 살아있나 | 병합 방식 |
|---|---|---|
| `feat/* → dev` | ❌ 병합 후 삭제 | **Squash and merge** |
| `dev → main` (릴리스 승격) | ✅ dev는 계속 씀 | 🚨 **Create a merge commit** |
| **스택 PR** (base가 다른 feature 브랜치) | ✅ 위에 PR이 매달려 있음 | 🚨 **Create a merge commit** |

**판단 기준은 딱 하나: squash는 소스 브랜치를 버릴 때만.**
병합 후에도 그 브랜치를 계속 쓴다면(dev, 혹은 그 위에 다른 PR이 스택돼 있는 feature 브랜치) squash가 커밋 이력을 압축해 새 커밋 ID를 만들어버리고, git이 원본 브랜치와의 공통 조상을 못 찾아 다음 병합에서 "내용은 같은데 충돌"이 납니다. 이 팀은 이걸 **실제로 여러 번 겪고 나서** 규칙으로 명문화했습니다.

**스택 PR**(예: `dev ← A(#87) ← B(#89) ← C(#91)`)은 여러 명이 동시에 진행 중인 큰 기능 위에 이어서 작업할 때 자연스럽게 생깁니다. PR 설명에 체인을 명시하고 "병합 시 Create a merge commit(squash 금지)"를 굵게 써두면 병합 담당자가 실수하지 않습니다.

---

## 3. CI 설정 — "변경 영역 감지 + 실행" 패턴

핵심 아이디어 2가지:

**(1) `Detect changes` job으로 관련 없는 검사를 건너뛴다.**

```yaml
jobs:
  changes:
    name: Detect changes
    outputs:
      app: ${{ steps.filter.outputs.app }}
      server: ${{ steps.filter.outputs.server }}
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            app:
              - 'app/**'
            server:
              - 'server/**'

  app_tests:
    needs: changes
    if: ${{ needs.changes.outputs.app == 'true' }}
    ...
  server_tests:
    needs: changes
    if: ${{ needs.changes.outputs.server == 'true' }}
    ...
```

앱만 고친 PR은 서버 테스트가 스킵되고, 반대도 마찬가지 — 여러 트랙이 동시에 PR을 올려도 CI 대기열이 안 밀립니다.

**(2) `pull_request` 트리거에 `branches` 필터를 걸지 않는다.**

```yaml
on:
  push:
    branches: [main, dev]
  pull_request:
    # ⚠️ branches 필터를 두지 않는다. base를 main·dev로 제한하면
    # 스택 PR(base가 다른 feature 브랜치)에서 CI가 아예 안 돈다.
    # 체크 목록이 비어 있어 "통과"로 오해하기 쉽지만 실은 실행조차 안 된 것이다.
```

이 팀이 실제로 겪은 사고입니다: `pull_request: branches: [main, dev]`로 걸어뒀다가, base가 feature 브랜치인 스택 PR에서 `flutter analyze`도 테스트도 **한 번도 실행되지 않은 채** 체크 목록만 비어 있는 상태로 리뷰가 진행됐습니다. "체크가 비어 있는 것"과 "초록인 것"은 다릅니다 — 비어 있으면 아무것도 검증 안 된 것입니다. 이후 트리거에서 `branches` 필터를 완전히 제거해서 base가 뭐든 모든 PR에서 돌게 했고, (1)의 변경 감지 덕분에 비용은 거의 늘지 않았습니다.

**(3) 컨테이너/서버가 있다면 "빌드 성공 ≠ 동작"까지 검증한다.**

이 프로젝트는 서버 이미지를 실제로 `docker compose up`으로 띄우고, 헬스체크 엔드포인트를 curl로 때리고, 볼륨 마운트 지점이 코드의 설정값과 실제로 일치하는지(`docker inspect`)까지 CI에서 확인했습니다. 빌드만 통과하고 런타임에 깨지는 클래스의 버그를 잡기 위함입니다.

---

## 4. 이슈 / PR 템플릿

### 이슈 본문

```markdown
## 📌 무엇을 (What)
## 🎯 왜 (Why)
## ✅ 할 일 (To-do)
- [ ] ...
## 🔗 서버 계약 (있다면)
GET /api/xxx → { ... }  ← API 스펙을 이슈에 미리 박아두면 프론트/백엔드 조율 비용이 크게 줄어든다
## 🔁 선행 작업 (Depends on)
- #이슈번호
```

### PR 본문

```markdown
## 🔗 관련 이슈
Closes #12

## ✨ 작업 내용
## 🧪 검증 상태
(로컬에서 뭘 확인했고, 못 한 건 CI로 확인한다는 걸 솔직하게 명시)

## ✅ 체크리스트
- [ ] 관련 이슈 연결
- [ ] 로컬 검증 통과
- [ ] CI 통과 확인
- [ ] 리뷰어 승인
```

스택 PR이면 PR 상단에 체인 다이어그램과 병합 방식 경고를 반드시 넣습니다:

```markdown
## ⚠️ 스택 PR입니다
dev ← feat/A (#87) ← feat/B (#89, 이 PR)
**병합 시 Create a merge commit** (squash 금지)
```

---

## 5. AI(Claude Code) 팀원 운영 방식 — 이게 이 사례의 핵심

이 팀은 5명 각자가 자기 계정으로 Claude Code를 붙여 작업했습니다. 매 세션 시작 시 다음을 반복 요청하는 방식으로 운영했습니다:

> "최신 main을 pull하고 문서를 읽어서 내 할 일을 파악한 뒤, 가장 먼저 해야 할 일을 수행하고, 리뷰할 것도 있으면 리뷰해줘."

이 한 프롬프트가 매번 다음을 자동으로 수행하게 만듭니다:
1. `git pull` + 문서(README/CONTRIBUTING/planning.md) 최신 상태 확인
2. `gh issue list --assignee <내ID> --state open` — 내 담당 이슈 확인
3. `gh pr list --search "review-requested:<내ID>"` — 나에게 온 리뷰 요청 확인
4. 리뷰 요청이 있으면: **실제 diff + 서버 소스 코드를 대조**해서 클라이언트-서버 계약이 정말 맞는지 검증 후 리뷰 게시 (PR 설명만 믿지 않음)
5. 내 이슈 중 가장 급한 것에 착수 → 로컬 검증(lint/test) → 커밋/PR

**중복 작업 방지 프로토콜**: 이슈 하나에 2명이 할당되는 경우가 잦았는데(교차 검증 목적), 거의 동시에 서로 다른 구현이 나오는 일이 여러 번 있었습니다. 그때마다:
- 착수 직후 이슈에 "지금 착수합니다" 코멘트를 남기는 컨벤션(완벽히 막지는 못했지만 관찰 가능하게는 함)
- 충돌이 확인되면 두 구현을 **실제로 비교**해서 더 나은 설계(예: 최소 노출 DTO를 쓴 쪽, N+1을 방지한 쪽)를 채택
- 진 쪽 PR은 닫되, 고유한 가치가 있으면 이긴 브랜치에 직접 push해서 포팅

**리뷰 원칙**: PR 설명이 "확인했다"고 적어도 리뷰어가 서버 응답 필드명, 상태 코드, 에러 바디 형식을 실제 코드에서 대조합니다. 이 과정에서 실제로 IDOR(권한 검사 누락) 같은 보안 이슈를 리뷰 단계에서 잡아낸 사례가 있었습니다.

---

## 6. 재사용 가능한 코드 설계 원칙 (백엔드가 있는 팀이라면)

- **최소 노출 DTO**: `User` 엔티티를 통째로 다른 모듈에 넘기지 말고, `UserSummary(id, nickname, profileImageUrl)` 같은 프로젝션을 만들어 여러 기능에서 재사용. 새 화면이 생길 때마다 "뭘 공개해도 되는지"를 다시 판단할 필요가 없어짐.
- **N+1 방지 배치 조회 패턴**을 한 번 만들면 계속 재사용: `Repository.findXxxIn(ids)` → `Map<id, T>`로 변환 → 목록에 매핑. 빈 컬렉션이면 `IN ()` SQL 에러가 나므로 조회 전 빈 컬렉션 가드.
- **기본값 오버로드 금지**: 인증 컨텍스트가 필요한 메서드에 "생략 가능한" 오버로드를 만들지 않기. 예를 들어 `Response.from(entity)` 처럼 편한 오버로드를 남겨두면, 나중에 누군가 그걸 써버려서 "항상 false/null"인 조용한 버그가 생김.

---

## 7. 다른 공모전에 적용할 때 체크리스트

- [ ] 팀원 수만큼 트랙을 나누고, 트랙마다 오너+짝 리뷰어를 순환으로 지정
- [ ] `.github/CODEOWNERS`에 경로별 오너+짝 매핑 (마지막 매칭 우선 규칙 숙지)
- [ ] `main`/`dev`/`feat/*`/`fix/*` 브랜치 전략 + **squash vs merge commit 판단 기준**을 CONTRIBUTING.md에 명문화
- [ ] Branch protection: `main`, `dev`에 "PR 필수", "승인 1명 이상" 설정
- [ ] CI: `Detect changes` job으로 변경 영역만 검사 + `pull_request` 트리거에 `branches` 필터 걸지 않기(스택 PR 대비)
- [ ] 이슈/PR 템플릿에 "서버 계약"·"검증 상태" 섹션 넣기
- [ ] 팀원마다 Claude Code(또는 동급 AI 코딩 에이전트) 세션에 "pull → 문서 확인 → 내 할 일 파악 → 착수 → 리뷰" 루틴을 반복 프롬프트로 등록
- [ ] 이슈 중복 할당이 발생하면 "먼저 착수 코멘트 → 충돌 시 비교 후 병합" 프로토콜을 팀 규칙으로 공유
