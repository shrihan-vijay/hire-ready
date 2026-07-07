from pydantic import BaseModel


class CreateApplicationRequest(BaseModel):
    company_name: str
    job_title: str
    job_url: str | None = None
    file_id: str | None = None
    score: int | None = None
    jd_snippet: str | None = None
    notes: str | None = None


class UpdateApplicationRequest(BaseModel):
    status: str | None = None
    notes: str | None = None


class Application(BaseModel):
    id: str
    company_name: str
    job_title: str
    job_url: str | None = None
    status: str
    file_id: str | None = None
    score: int | None = None
    jd_snippet: str | None = None
    notes: str | None = None
    created_at: str
    updated_at: str
