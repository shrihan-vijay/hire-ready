import uuid

from fastapi import HTTPException, UploadFile

from app.core.supabase import get_supabase_admin
from app.services.chunker_service import chunk_text
from app.services.embedder_service import embed_and_store
from app.services.parser_service import detect_sections, extract_text

MAX_FILE_SIZE = 5 * 1024 * 1024
ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
STORAGE_BUCKET = "resumes"


async def save_resume(file: UploadFile) -> dict:
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Only PDF and DOCX files are accepted.")

    content = await file.read()

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File size must be under 5 MB.")

    ext = ".pdf" if file.content_type == "application/pdf" else ".docx"
    file_id = str(uuid.uuid4())
    storage_path = f"{file_id}{ext}"

    try:
        get_supabase_admin().storage.from_(STORAGE_BUCKET).upload(
            path=storage_path,
            file=content,
            file_options={"content-type": file.content_type},
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"File storage failed: {exc}")

    try:
        text = extract_text(content, file.content_type)
    except Exception:
        text = ""

    chunks = chunk_text(text)
    chunk_count = embed_and_store(file_id, file.filename or storage_path, chunks)

    return {
        "filename": file.filename or storage_path,
        "file_id": file_id,
        "size": len(content),
        "word_count": len(text.split()),
        "chunk_count": chunk_count,
        "sections": detect_sections(text),
    }
