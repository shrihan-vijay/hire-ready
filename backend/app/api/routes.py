from fastapi import APIRouter

from app.api.resume import router as resume_router
from app.api.interview import router as interview_router
from app.api.github_auth import router as github_auth_router
from app.api.chat import router as chat_router

router = APIRouter()


@router.get("/health")
def health_check():
    return {
        "status": "ok",
        "message": "HireReady backend is running",
    }


router.include_router(resume_router, prefix="/resume", tags=["resume"])
router.include_router(interview_router, prefix="/interview", tags=["interview"])
router.include_router(github_auth_router, prefix="/auth/github", tags=["auth"])
router.include_router(chat_router, prefix="/chat", tags=["chat"])
