import json
from typing import Optional

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.core.auth import get_current_user
from app.models.chat import ChatRequest
from app.services.chat_service import stream_chat
from app.services.embedder_service import query_resume

router = APIRouter()


@router.post("/")
async def chat(
    body: ChatRequest,
    user: Optional[dict] = Depends(get_current_user),
):
    resume_chunks: list[str] = []
    if body.file_id and body.messages:
        query = body.messages[-1].content
        resume_chunks = query_resume(body.file_id, query)

    def generate():
        for token in stream_chat(body.messages, resume_chunks, body.job_description):
            yield f"data: {json.dumps({'token': token})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
