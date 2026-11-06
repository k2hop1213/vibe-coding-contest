# 배포 (#13)

| 무엇 | 어디 | 설정 파일 |
|---|---|---|
| 서버 (`server/`, FastAPI) | Render 무료 웹 서비스 | `render.yaml` |
| 앱 (`app/`, Vite) | Vercel | 없음 (자동 인식) |

## 1. 데모용 사진

데모 시드 데이터(샘플 기록 10개)는 제거했습니다. 발표 때는 팀이 직접 찍은 사진·영상으로 그 자리에서 기록을 만듭니다.

> 사진은 **팀이 직접 찍은 것만** 씁니다(대회 출처 규칙). 아이폰 사진은 HEIC라 서버가 받지 않으니 JPG로 내보내 주세요. 영상은 Chrome 재생을 위해 mp4(H.264)를 권장합니다.

## 2. 서버 → Render

> BAZE 게이트웨이 지원(#22)이 `main`에 병합된 뒤에 배포하세요. 그 전에는 토큰을 넣어도 스텁으로 생성됩니다.

1. https://render.com 에 GitHub 계정으로 로그인 → **New → Blueprint** → 이 저장소 선택. `render.yaml`이 자동으로 읽힙니다.
2. 환경변수 입력:
   - `ANTHROPIC_AUTH_TOKEN` — 학교 BAZE 게이트웨이 키 (BAZE 사이트 > API Gateway에서 발급, 사용량은 발급한 계정으로 청구). 비우면 AI 없이 스텁으로 생성
   - `ANTHROPIC_BASE_URL`은 `render.yaml`에 게이트웨이 주소로 이미 들어 있습니다. **`ANTHROPIC_API_KEY`는 같이 넣지 마세요** — 둘 다 있으면 SDK 오류로 항상 스텁이 됩니다
   - `ALLOWED_ORIGINS` — 3단계에서 받은 Vercel 주소 (예: `https://haru-reels.vercel.app`). 처음엔 비워 두고 3단계 후에 채워도 됩니다.
3. 배포가 끝나면 `https://<서비스이름>.onrender.com/api/health`가 `{"ok":true}`인지 확인합니다.

**무료 플랜 주의**
- 디스크가 재시작·재배포 때 지워집니다. 발표 중에 만든 기록도 재시작하면 사라집니다.
- 15분 동안 요청이 없으면 잠들고, 다음 요청에 깨어나는 데 1분 가까이 걸립니다. **발표 5분 전에 앱을 한 번 열어 깨워 두세요.**
- 기록을 유지하려면 유료 플랜 + Persistent Disk를 붙이고 `DATABASE_PATH`·`MEDIA_DIR`를 디스크 경로로 지정해야 합니다(선택).

## 3. 앱 → Vercel

1. https://vercel.com 에 GitHub 계정으로 로그인 → **Add New → Project** → 이 저장소 선택.
2. **Root Directory**를 `app`으로 지정합니다(Framework는 Vite로 자동 인식).
3. 환경변수 `VITE_API_BASE` = 2단계의 서버 주소 (예: `https://haru-reels-api.onrender.com`, 끝에 `/` 없이).
4. 배포 후 받은 주소를 Render의 `ALLOWED_ORIGINS`에 넣고 Render를 재배포합니다. Blueprint 생성 때 비워 둔 변수는 만들어지지 않으므로 Render 서비스 → **Environment → Edit → Add variable**로 추가한 뒤 **Save, rebuild, and deploy**.
5. 앱을 열어 오른쪽 위에 아무 경고가 없으면 끝("서버를 깨우는 중…"이면 잠든 서버가 깨어나는 중 — 최대 1분, 깨어나면 달력이 자동으로 다시 불러와짐). 주소는 `README.md`의 배포 주소에 적어 주세요.

`main`에 병합할 때마다 두 곳 모두 자동으로 다시 배포됩니다.

## 현재 배포 (2026-11-06)

| | 주소 | 대시보드 |
|---|---|---|
| 앱 | https://haru-reels.vercel.app | Vercel 프로젝트 `haru-reels` (k2hop1213) |
| 서버 | https://haru-reels-api.onrender.com | Render Blueprint `haru-reels` → 서비스 `haru-reels-api` (k2hop1213) |
