import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app import entries, styles
from app.config import media_dir

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


@app.exception_handler(RequestValidationError)
async def validation_error(_: Request, __: RequestValidationError) -> JSONResponse:
    """FastAPI 기본 422 {detail: [...]} 대신 계약의 에러 형식으로 통일"""
    return JSONResponse(status_code=400, content={"error": "invalid_request"})


@app.get("/api/health")
def health() -> dict:
    return {"ok": True}


app.include_router(styles.router)
app.include_router(entries.router)

# 샘플 이미지(시드 데이터 #13용). 더 구체적인 경로라 /media보다 먼저 마운트한다
SAMPLE_MEDIA_DIR = Path(__file__).parent / "sample_media"
app.mount("/media/sample", StaticFiles(directory=SAMPLE_MEDIA_DIR), name="sample_media")
# 업로드 파일
media_dir().mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=media_dir()), name="media")
