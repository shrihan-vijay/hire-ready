from fastapi import APIRouter

from app.api.resume import router as resume_router

router = APIRouter()


@router.get("/health")
def health_check():
    return {
        "status": "ok",
        "message": "HireReady backend is running",
    }


router.include_router(resume_router, prefix="/resume", tags=["resume"])
