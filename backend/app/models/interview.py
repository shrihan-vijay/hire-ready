from pydantic import BaseModel


class GenerateQuestionsRequest(BaseModel):
    job_description: str
    file_id: str | None = None


class InterviewQuestion(BaseModel):
    question: str
    category: str  # "behavioral" | "technical"
    hint: str


class GenerateQuestionsResponse(BaseModel):
    questions: list[InterviewQuestion]


class FeedbackRequest(BaseModel):
    question: str
    user_answer: str
    file_id: str | None = None


class FeedbackResponse(BaseModel):
    feedback: str
