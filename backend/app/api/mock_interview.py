from fastapi import APIRouter, HTTPException

from app.models.mock_interview import StartSessionRequest, SubmitAnswerRequest
from app.services.embedder_service import query_resume
from app.services.mock_interview_service import process_answer, start_session

router = APIRouter()


@router.post("/start")
async def start_mock_interview(body: StartSessionRequest):
    if len(body.job_description.strip().split()) < 20:
        raise HTTPException(status_code=422, detail="Job description is too short.")
    chunks = query_resume(body.file_id, body.job_description) if body.file_id else []
    return start_session(body.job_description, body.file_id, chunks)


@router.post("/answer")
async def submit_answer(body: SubmitAnswerRequest):
    try:
        return process_answer(body.session_id, body.answer)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
