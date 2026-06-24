from pydantic import BaseModel


class ResumeUploadResponse(BaseModel):
    filename: str
    file_id: str
    size: int
    word_count: int
    chunk_count: int
    sections: list[str]
    message: str


class AnalyzeRequest(BaseModel):
    file_id: str
    job_description: str


class AnalyzeResponse(BaseModel):
    score: int
    matched_skills: list[str]
    missing_skills: list[str]
    summary: str
