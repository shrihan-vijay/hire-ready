from fastapi import APIRouter, File, HTTPException, UploadFile

from app.models.interview import (
    FeedbackRequest,
    FeedbackResponse,
    GenerateQuestionsRequest,
    GenerateQuestionsResponse,
    InterviewQuestion,
)
from app.services.embedder_service import query_resume
from app.services.interview_service import generate_questions, get_feedback, transcribe_audio
from app.services.llm_service import is_valid_job_description

router = APIRouter()


@router.post("/questions", response_model=GenerateQuestionsResponse)
async def get_questions(body: GenerateQuestionsRequest):
    if len(body.job_description.strip().split()) < 20:
        raise HTTPException(status_code=422, detail="Job description is too short to generate meaningful questions.")
    if not is_valid_job_description(body.job_description):
        raise HTTPException(status_code=422, detail="This doesn't look like a real job description. Please paste an actual job posting.")
    chunks = query_resume(body.file_id, body.job_description) if body.file_id else []
    questions = generate_questions(chunks, body.job_description)
    return GenerateQuestionsResponse(
        questions=[InterviewQuestion(**q) for q in questions]
    )


@router.post("/feedback", response_model=FeedbackResponse)
async def get_feedback_endpoint(body: FeedbackRequest):
    chunks = query_resume(body.file_id, body.question) if body.file_id else []
    feedback = get_feedback(body.question, body.user_answer, chunks)
    return FeedbackResponse(feedback=feedback)


@router.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    content = await file.read()
    content_type = (file.content_type or "audio/webm").split(";")[0]
    filename = file.filename or "recording.webm"
    text = transcribe_audio(content, filename, content_type)
    return {"text": text}
