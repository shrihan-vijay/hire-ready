import os
import uuid

from fastapi import HTTPException, UploadFile

from app.services.chunker_service import chunk_text
from app.services.embedder_service import embed_and_store
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

    # Parse
    try:
        text = extract_text(filepath, file.content_type)
    except Exception:
        text = ""

    with open(os.path.join(UPLOAD_DIR, f"{file_id}.txt"), "w", encoding="utf-8") as f:
        f.write(text)

    # Chunk + embed
    chunks = chunk_text(text)
    chunk_count = embed_and_store(file_id, file.filename or saved_filename, chunks)

    return {
        "filename": file.filename or saved_filename,
        "file_id": file_id,
        "size": len(content),
        "word_count": len(text.split()),
        "chunk_count": chunk_count,
        "sections": detect_sections(text),
    }
