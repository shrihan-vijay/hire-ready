from pydantic import BaseModel


class StartSessionRequest(BaseModel):
    job_description: str
    file_id: str | None = None


class QuestionPayload(BaseModel):
    text: str
    category: str
    hint: str


class StartSessionResponse(BaseModel):
    session_id: str
    question: QuestionPayload
    question_number: int
    total_questions: int


class SubmitAnswerRequest(BaseModel):
    session_id: str
    answer: str
