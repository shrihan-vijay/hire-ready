from fastapi import APIRouter

from app.models.interview import (
    FeedbackRequest,
    FeedbackResponse,
    GenerateQuestionsRequest,
    GenerateQuestionsResponse,
    InterviewQuestion,
)
from app.services.embedder_service import query_resume
from app.services.interview_service import generate_questions, get_feedback

router = APIRouter()


@router.post("/questions", response_model=GenerateQuestionsResponse)
async def get_questions(body: GenerateQuestionsRequest):
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
