from pydantic import BaseModel


class ResumeUploadResponse(BaseModel):
    filename: str
    size: int
    message: str
