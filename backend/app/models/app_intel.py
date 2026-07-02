from pydantic import BaseModel


class RunRequest(BaseModel):
    job_description: str
    file_id: str | None = None
