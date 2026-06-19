import os
import uuid

from fastapi import HTTPException, UploadFile

UPLOAD_DIR = "uploads"
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB
ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


async def save_resume(file: UploadFile) -> dict:
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Only PDF and DOCX files are accepted.")

    content = await file.read()

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File size must be under 5 MB.")

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    ext = ".pdf" if file.content_type == "application/pdf" else ".docx"
    saved_filename = f"{uuid.uuid4()}{ext}"

    with open(os.path.join(UPLOAD_DIR, saved_filename), "wb") as f:
        f.write(content)

    return {
        "filename": file.filename or saved_filename,
        "saved_as": saved_filename,
        "size": len(content),
    }
