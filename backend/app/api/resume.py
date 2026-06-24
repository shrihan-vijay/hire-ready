from fastapi import APIRouter, File, HTTPException, UploadFile

from app.models.resume import AnalyzeRequest, AnalyzeResponse, ResumeUploadResponse
from app.services.embedder_service import query_resume
from app.services.llm_service import analyze_resume
from app.services.resume_service import save_resume

router = APIRouter()


@router.post("/upload", response_model=ResumeUploadResponse)
async def upload_resume(file: UploadFile = File(...)):
    result = await save_resume(file)
    return ResumeUploadResponse(
        filename=result["filename"],
        file_id=result["file_id"],
        size=result["size"],
        word_count=result["word_count"],
        chunk_count=result["chunk_count"],
        sections=result["sections"],
        message="Resume uploaded, parsed, and embedded successfully",
    )


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze(body: AnalyzeRequest):
    chunks = query_resume(body.file_id, body.job_description)
    if not chunks:
        raise HTTPException(status_code=404, detail="No resume data found for this file_id.")
    result = analyze_resume(chunks, body.job_description)
    return AnalyzeResponse(**result)
