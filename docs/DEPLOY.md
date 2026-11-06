# 배포 · 데모 데이터 (#13)

| 무엇 | 어디 | 설정 파일 |
|---|---|---|
| 서버 (`server/`, FastAPI) | Render 무료 웹 서비스 | `render.yaml` |
| 앱 (`app/`, Vite) | Vercel | 없음 (자동 인식) |

## 1. 데모 데이터 (로컬)

`server/`에서 실행합니다. 오늘 날짜는 비워 두고, 오늘 이전 날짜 10개에 완성된 릴스를 채웁니다. 이미 기록이 있는 날짜는 건너뜁니다.

```bash
# 자동 생성 샘플 사진(직접 그린 그라데이션)으로
.venv/Scripts/python -m app.seed

# 발표용: 팀이 직접 찍은 사진·영상 폴더로 (jpg·png·webp·gif·mp4·mov·webm)
.venv/Scripts/python -m app.seed --photos ../demo

# 장면 구성을 Claude로 (ANTHROPIC_API_KEY 필요, 기록당 API 1회 호출)
.venv/Scripts/python -m app.seed --photos ../demo --ai
```

처음부터 다시 하려면 서버를 끄고 `server/haru.db`와 `server/media/`를 지운 뒤 다시 실행합니다.

> 사진은 **팀이 직접 찍은 것만** 씁니다(대회 출처 규칙). 아이폰 사진은 HEIC라 서버가 받지 않으니 JPG로 내보내 주세요. 영상은 Chrome 재생을 위해 mp4(H.264)를 권장합니다.

## 2. 서버 → Render

1. https://render.com 에 GitHub 계정으로 로그인 → **New → Blueprint** → 이 저장소 선택. `render.yaml`이 자동으로 읽힙니다.
2. 환경변수 입력:
   - `ANTHROPIC_API_KEY` — Claude API 키 (비우면 AI 없이 스텁으로 생성)
   - `ALLOWED_ORIGINS` — 3단계에서 받은 Vercel 주소 (예: `https://haru-reels.vercel.app`). 처음엔 비워 두고 3단계 후에 채워도 됩니다.
3. 배포가 끝나면 `https://<서비스이름>.onrender.com/api/health`가 `{"ok":true}`인지 확인합니다.

**무료 플랜 주의**
- 디스크가 재시작·재배포 때 지워집니다. 그래서 시작 명령에서 `python -m app.seed --if-empty`로 **DB가 비어 있으면 샘플 데모 데이터를 다시 채웁니다**. 발표 중에 만든 기록도 재시작하면 사라집니다.
- 15분 동안 요청이 없으면 잠들고, 다음 요청에 깨어나는 데 1분 가까이 걸립니다. **발표 5분 전에 앱을 한 번 열어 깨워 두세요.**
- 팀 사진으로 시드한 상태를 유지하려면 유료 플랜 + Persistent Disk를 붙이고 `DATABASE_PATH`·`MEDIA_DIR`를 디스크 경로로 지정해야 합니다(선택).

## 3. 앱 → Vercel

1. https://vercel.com 에 GitHub 계정으로 로그인 → **Add New → Project** → 이 저장소 선택.
2. **Root Directory**를 `app`으로 지정합니다(Framework는 Vite로 자동 인식).
3. 환경변수 `VITE_API_BASE` = 2단계의 서버 주소 (예: `https://haru-reels-api.onrender.com`, 끝에 `/` 없이).
4. 배포 후 받은 주소를 Render의 `ALLOWED_ORIGINS`에 넣고 Render를 재배포합니다.
5. 앱을 열어 오른쪽 위가 "서버 연결됨"이고 달력에 썸네일이 보이면 끝. 주소는 `README.md`의 배포 주소에 적어 주세요.

`main`에 병합할 때마다 두 곳 모두 자동으로 다시 배포됩니다.
