from fastapi import APIRouter, File, UploadFile

from app.models.resume import ResumeUploadResponse
from app.services.resume_service import save_resume

router = APIRouter()


@router.post("/upload", response_model=ResumeUploadResponse)
async def upload_resume(file: UploadFile = File(...)):
    result = await save_resume(file)
    return ResumeUploadResponse(
        filename=result["filename"],
        size=result["size"],
        word_count=result["word_count"],
        chunk_count=result["chunk_count"],
        sections=result["sections"],
        message="Resume uploaded, parsed, and embedded successfully",
    )
