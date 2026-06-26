from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.core.auth import get_current_user
from app.models.resume import AnalyzeRequest, AnalyzeResponse, FetchJDRequest, FetchJDResponse, ResumeFile, ResumeUploadResponse
from app.services.embedder_service import delete_chunks, query_resume
from app.services.history_service import delete_analysis_entry, delete_resume_record, get_user_history, save_analysis_result, save_upload_record
from app.core.config import GITHUB_TOKEN
from app.services.github_connection_service import get_github_connection
from app.services.github_service import fetch_github_profile
from app.services.jd_fetcher_service import fetch_jd_from_url
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
    jd_words = body.job_description.strip().split()
    if len(jd_words) < 20:
        raise HTTPException(
            status_code=422,
            detail="Job description is too short to score against. Please paste a complete job description describing the role and its requirements.",
        )

    chunks = query_resume(body.file_id, body.job_description)
    if not chunks:
        raise HTTPException(status_code=404, detail="No resume data found for this file_id.")

    github_context = None
    if user:
        # Logged-in: use their OAuth-connected GitHub account automatically
        connection = get_github_connection(user["id"])
        if connection:
            github_context = await fetch_github_profile(
                connection["github_username"], connection["github_token"]
            )
    elif body.github_username and body.github_username.strip() and GITHUB_TOKEN:
        # Guest: manual username with the server PAT
        github_context = await fetch_github_profile(
            body.github_username.strip().lstrip("@"), GITHUB_TOKEN
        )

    result = analyze_resume(chunks, body.job_description, github_context)
    result["github_enriched"] = github_context is not None

    if user:
        save_analysis_result(
            body.file_id,
            result["score"],
            result["matched_skills"],
            result["missing_skills"],
            body.job_description,
            result.get("summary", ""),
        )
    return AnalyzeResponse(**result)


@router.post("/fetch-jd", response_model=FetchJDResponse)
async def fetch_jd(body: FetchJDRequest):
    result = await fetch_jd_from_url(body.url)
    return FetchJDResponse(**result)


@router.delete("/history/{file_id}/score", status_code=204)
async def delete_score(file_id: str, at: str, user: dict = Depends(get_current_user)):
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    delete_analysis_entry(user["id"], file_id, at)


@router.delete("/history/{file_id}", status_code=204)
async def delete_history(file_id: str, user: dict = Depends(get_current_user)):
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    delete_resume_record(user["id"], file_id)
    delete_chunks(file_id)


@router.get("/history", response_model=list[ResumeFile])
async def history(user: dict = Depends(get_current_user)):
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return get_user_history(user["id"])
