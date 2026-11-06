# 기획 (planning)

> 주제 발표 후 팀이 함께 채우는 문서. Claude는 라운드마다 **이 문서만** 읽고 상황을 파악합니다 — 짧고 최신으로 유지하세요.
> 여러 명이 동시에 고치면 충돌나니, 큰 변경은 PM이 `docs: planning 갱신` PR로 반영.

## 대회 정보
- 주제: **AI로 다시 쓰는 대학생활**
  - 예시: AI 캠퍼스 사주풀이, 교수님과 나의 궁합
  - 방향: 문제 해결을 넘어, **새로운 경험을 만드는 창의적인 웹**
- 규칙: 참고한 코드·자료는 **출처를 반드시 명시** → [`CREDITS.md`](../CREDITS.md)
- 형태: 웹
- 일정 / 마감:
- 제출물 (데모 URL, 영상, 발표 자료 등):
- 심사 기준:

## 아이디어 한 줄 요약
**하루릴스 (가칭)** — 대학생이 그날의 사진·동영상과 일기를 올리면 AI가 고른 스타일로 **세로 릴스를 자동으로 만들어 주고**, 달력에 쌓여 "릴스로 넘겨보는 대학생활 다이어리"가 된다.
기록이 귀찮은 일이 아니라 **매일 받는 결과물**이 되는 경험 → 주제의 "새로운 경험을 만드는 창의적인 웹".

## 핵심 기능 (MVP) — 데모에서 반드시 보여줄 것, 우선순위 순
- [ ] 1. **기록 작성 화면** (참고 이미지 구성, 모바일 하단 시트형)
  - 일기 입력칸 (여러 줄)
  - **스타일 태그** 칩 가로 스크롤, 1개 이상 선택: 🎞️ 감성 브이로그 · ⚡ 에너지 넘치는 · 📚 시험기간 생존기 · 🎉 축제·MT · 🌙 잔잔한 슬라이드쇼 · 😂 밈·유머 · 📼 레트로 필름
  - **사진·동영상 추가** 버튼 (1개 이상 필수, 미리보기 썸네일)
  - "릴스 만들기" 버튼
- [ ] 2. **AI 편집 플랜** — 일기 + 사진 + 태그(분위기 힌트)를 AI에 보내 [`docs/REELS_TEMPLATES.md`](REELS_TEMPLATES.md) §3 스키마의 편집 플랜을 받음: 템플릿 4종(`emotional`·`montage`·`review`·`closeup`) 중 선택, 클립 순서, 자막, 고정 텍스트, 플래시 몽타주
- [ ] 3. **mp4 합성 + 재생** — 브라우저가 편집 플랜대로 **720×1280 / 30fps mp4**를 합성(#28 WebCodecs) → 서버에 업로드. 규칙은 스펙 그대로: 하드 컷, 사진 1.00→1.05 확대, 템플릿별 텍스트, 공통 색 보정, 무료 BGM. 웹은 그 mp4를 재생·저장
- [ ] 4. **달력 홈** — 월 달력, 릴스 있는 날은 썸네일로 표시, 날짜 탭 → 그날 릴스 재생 / 빈 날짜 탭 → 기록 작성
- [ ] 5. 모바일·PC 둘 다 되는 반응형 웹

## 시간 남으면
- 같은 기록으로 다른 스타일 재생성
- 한 달 모아보기 릴스 ("11월의 나")

## 하지 않는 것 (범위 밖)
- 로그인·회원가입 (데모 사용자 1명 고정)
- 인스타 등 SNS 자동 업로드, 친구·피드·댓글
- 네이티브 앱 (반응형 웹으로 대체)
- 서버 ffmpeg 렌더링 (무료 서버에서 수 분 — 브라우저 합성으로 대체)
- 전환 효과·텍스트 등장 애니메이션 (스펙상 하드 컷·즉시 표시)

## 데모 시나리오 (발표 순서대로)
1. 달력 홈: 발표 전에 팀 사진으로 직접 만들어 둔 날짜들 → 하나 눌러 릴스(mp4) 재생 (첫인상)
2. 오늘 날짜 탭 → 축제 사진 4장 + 짧은 일기 + 태그 🎉 축제·MT 선택 → 릴스 만들기
3. 생성 중 화면 ("AI 편집 중 → 영상 합치는 중 n%") → 완성된 mp4 재생: AI가 고른 템플릿·자막, 하드 컷
4. (시간 되면) 같은 기록을 🌙 잔잔한 슬라이드쇼로 다시 만들어 분위기 차이 보여주기
5. 달력으로 돌아와 오늘 칸이 채워진 것 확인 → "한 학기가 릴스로 남는다"로 마무리

## 기술 스택 (제안 — 팀 확인 필요)
- Frontend (`app/`): React + TypeScript + Vite, Tailwind CSS. 릴스 플레이어는 CSS 애니메이션/Framer Motion
- Backend (`server/`): Python FastAPI, 업로드 파일은 로컬 디스크, 데이터는 SQLite
- AI: Claude API `claude-opus-5-5` (사진 이해 + 장면 구성 JSON 생성) — 학교 BAZE API Gateway 경유 (`server/.env`: `ANTHROPIC_BASE_URL`·`ANTHROPIC_AUTH_TOKEN`)
- 배포: app → Vercel, server → Render (또는 데모는 로컬 + 터널)

## 역할 분담
| 영역 | 담당 | 주요 이슈 |
|---|---|---|
| PM & Infra | @k2hop1213 | #5 골격 → #11 릴스 플레이어 → #13 시드·배포 → #14 발표 |
| Frontend | @sijin2170 | #9 달력 홈 · #10 작성 화면 → #12 생성·재생 연결 |
| Backend · AI | @songkh1201 | #6 고정 데이터 API → #7 저장·조회 → #8 Claude 장면 생성 |

> 순서: **#5 먼저** → 끝나면 #6 · #9 · #10 · #11 동시 진행 (프론트는 #6 고정 데이터로 개발)

## API 계약 (프론트 ↔ 백엔드, 단일 출처)
```
GET  /api/styles
  → 200 { "styles": [ { "id": "festival", "label": "축제·MT", "emoji": "🎉" } ] }

POST /api/entries        (multipart/form-data)
  date: "2026-11-06"   diary: "..."   tags: "festival" (여러 개면 같은 키 반복: tags=festival&tags=calm)
  files: 이미지/동영상 1~10개 (같은 키 반복)
  → 202 { "id": "e_123", "date": "2026-11-06", "status": "processing" }
  | 400 { "error": "no_media" | "no_tag" | "invalid_date" | "too_many_media"
          | "invalid_media" (허용 형식 아님: jpg·jpeg·png·gif·webp·mp4·mov·webm만. SVG·HEIC 불가) | "file_too_large" (개당 50MB 초과) }
  | 409 { "error": "already_exists" }        ← 하루 1개. 단 status가 failed인 날은 다시 POST하면 덮어씀(새 id)
  | 400 { "error": "invalid_request" }       ← 필드 타입 오류 등 (모든 API 공통, 422 대신)

GET  /api/entries?month=2026-11
  → 200 { "entries": [ { "id", "date", "status", "thumbnailUrl": "/media/.." | null } ] }   ← done일 때만 썸네일
  | 400 { "error": "invalid_date" }         ← month가 YYYY-MM 형식이 아님

GET  /api/entries/{id}
  → 200 { "id", "date", "diary", "tags": [..], "status": "processing" | "done" | "failed",
          "reel": null | {                               ← done = AI 편집 플랜 완성 (영상은 브라우저가 합쳐서 업로드)
            "template": "emotional" | "montage" | "review" | "closeup",
            "clipDuration": 1.0,                         ← 초. 템플릿 기본값 (emotional 2.5 · montage/review 1.0 · closeup 0.8)
            "bgmBpm": 120,
            "fixedText": null | { "title": "INCHEON [송도]", "subtitle": "중간고사 끝난 날" },
            "clips": [ { "mediaUrl": "/media/..", "type": "image" | "video",
                         "caption": "드디어 시험 끝" | null, "captionEn": "Finally, exams are over" | null } ],
            "flashMontage": null | { "startIndex": 3, "mediaUrls": ["/media/..", ..] },
            "videoUrl": "/media/..mp4" | null           ← 합친 영상 720×1280·30fps (#28). null이면 아직 안 합침
          } }
  | 404 { "error": "not_found" }

POST /api/entries/{id}/video   (multipart: file = video/mp4 | video/webm)   ← #27
  → 200 { "videoUrl": "/media/<uuid>.mp4" }
  | 400 { "error": "no_media" | "invalid_media" | "file_too_large" } | 404 not_found | 409 { "error": "not_ready" }
```
- 프론트는 생성 후 `GET /api/entries/{id}`를 2초 간격으로 확인 (status가 done/failed가 될 때까지). 렌더링 규칙 상세는 [`docs/REELS_TEMPLATES.md`](REELS_TEMPLATES.md)
- 서버 보정(#31): `clipDuration`은 항상 템플릿 기본값, 총 길이는 10~30초로 클립을 반복·잘라 맞춤, 올린 미디어는 모두 한 번 이상 사용, `caption`은 emotional·review만(15자), `captionEn`·`flashMontage`는 emotional만(몽타주는 사진 6장 이상일 때만, 아니면 null), closeup의 `fixedText.title`은 `\n` 3줄·`subtitle`은 null
- `tags`는 그대로 받되 **분위기 힌트**로만 쓴다(템플릿 선택·자막 말투). 전환 효과에는 영향 없음 (하드 컷 고정)
- 업로드 파일은 `GET /media/{파일명}`으로 서빙. `mediaUrl`·`thumbnailUrl`은 상대 경로 → 프론트는 `mediaUrl()`(`app/src/lib/api.ts`)로 `API_BASE`를 붙여 쓴다

## 타임라인
| 시각 | 목표 |
|---|---|
| T+1h | 골격 + CI 초록 |
| 마감 -2h | 기능 동결, 버그 수정만 |
| 마감 -1h | 데모 리허설, 발표 자료 |

## 결정 기록
- (11/06) 아이디어 확정: 사진+일기 → AI 릴스 + 달력 다이어리
- (11/06) ~~MVP 릴스는 영상 인코딩 대신 장면 JSON + 웹 플레이어~~ → 하나의 mp4로 (아래 #27)
- (11/06) 작성 화면 레이아웃은 vStory 앱 화면을 참고 → CREDITS.md 기록
- (11/06) 릴스를 하나의 MP4로 합침(#27) — 서버 ffmpeg는 무료 서버에서 수 분이라 **브라우저에서 합성**: 캔버스에 프레임마다 그려 WebCodecs로 H.264 인코딩(지원 안 되면 실시간 녹화) → 서버에 업로드
- (11/06) Claude 호출은 학교 제공 BAZE API Gateway(Claude 호환 `/v1/gateway/claude`) 키로 — Anthropic 크레딧 없이 사용. 실측: 사진 2장 약 5초, 약 4.7k 토큰
- (11/06) 릴스 제작 방식을 `docs/REELS_TEMPLATES.md`(실제 릴스 5개 분석 스펙)로 통일 — 템플릿 4종·하드 컷·720×1280. 합성은 #27의 브라우저 방식 위에서 구현
- (11/06) 데모 시드 기록 10개 제거 — 발표 때 팀 사진으로 직접 만든 기록만 표시
- (11/06) 스타일 태그 7개는 유지하되 템플릿 선택·자막 말투의 분위기 힌트로만 사용
