from pydantic import BaseModel


class ResumeUploadResponse(BaseModel):
    filename: str
    size: int
    word_count: int
    sections: list[str]
    message: str
