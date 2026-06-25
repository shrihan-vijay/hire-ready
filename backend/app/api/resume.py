from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.core.auth import get_current_user
from app.models.resume import AnalyzeRequest, AnalyzeResponse, HistoryItem, ResumeUploadResponse
from app.services.embedder_service import query_resume
from app.services.history_service import get_user_history, save_analysis_result, save_upload_record
from app.services.llm_service import analyze_resume
from app.services.resume_service import save_resume

router = APIRouter()


@router.post("/upload", response_model=ResumeUploadResponse)
async def upload_resume(
    file: UploadFile = File(...),
    user: Optional[dict] = Depends(get_current_user),
):
    result = await save_resume(file)
    if user:
        save_upload_record(user["id"], result["file_id"], result["filename"])
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
async def analyze(
    body: AnalyzeRequest,
    user: Optional[dict] = Depends(get_current_user),
):
    chunks = query_resume(body.file_id, body.job_description)
    if not chunks:
        raise HTTPException(status_code=404, detail="No resume data found for this file_id.")
    result = analyze_resume(chunks, body.job_description)
    if user:
        save_analysis_result(
            body.file_id,
            result["score"],
            result["matched_skills"],
            result["missing_skills"],
            body.job_description,
        )
    return AnalyzeResponse(**result)


@router.get("/history", response_model=list[HistoryItem])
async def history(user: dict = Depends(get_current_user)):
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return get_user_history(user["id"])
