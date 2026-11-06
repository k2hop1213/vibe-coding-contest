import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.mock import SAMPLE_MEDIA_DIR
from app.mock import router as mock_router

load_dotenv()

app = FastAPI(title="하루릴스 API")

# 개발: Vite(5173). 배포: ALLOWED_ORIGINS="https://xxx.vercel.app,..."
origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in origins if o.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict:
    return {"ok": True}


# #6 고정 데이터 API (실제 저장 #7 · AI 생성 #8이 붙으면 교체)
app.include_router(mock_router)
# 샘플 릴스 이미지. #7에서 업로드 파일용 /media 마운트를 추가할 때 이 줄보다 아래에 둘 것
app.mount("/media/sample", StaticFiles(directory=SAMPLE_MEDIA_DIR), name="sample_media")
