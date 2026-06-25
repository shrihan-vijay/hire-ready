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
    github_username: str | None = None


class AnalyzeResponse(BaseModel):
    score: int
    matched_skills: list[str]
    missing_skills: list[str]
    summary: str
    github_enriched: bool = False


class FetchJDRequest(BaseModel):
    url: str


class FetchJDResponse(BaseModel):
    text: str
    title: str | None = None


class HistoryItem(BaseModel):
    id: str
    file_id: str
    filename: str
    score: int | None
    matched_skills: list[str]
    missing_skills: list[str]
    jd_snippet: str | None
    uploaded_at: str
