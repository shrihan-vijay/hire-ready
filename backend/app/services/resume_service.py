import os
import uuid

from fastapi import HTTPException, UploadFile

from app.services.parser_service import detect_sections, extract_text

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
    file_id = str(uuid.uuid4())
    saved_filename = f"{file_id}{ext}"
    filepath = os.path.join(UPLOAD_DIR, saved_filename)

    with open(filepath, "wb") as f:
        f.write(content)

    # Extract text and save alongside the original file
    try:
        text = extract_text(filepath, file.content_type)
    except Exception:
        text = ""

    text_path = os.path.join(UPLOAD_DIR, f"{file_id}.txt")
    with open(text_path, "w", encoding="utf-8") as f:
        f.write(text)

    return {
        "filename": file.filename or saved_filename,
        "file_id": file_id,
        "saved_as": saved_filename,
        "size": len(content),
        "word_count": len(text.split()),
        "sections": detect_sections(text),
    }
