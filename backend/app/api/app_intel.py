import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.models.app_intel import RunRequest
from app.services.app_intel_service import stream_pipeline
from app.services.embedder_service import query_resume

router = APIRouter()


@router.post("/run")
async def run_pipeline(body: RunRequest):
    if len(body.job_description.strip().split()) < 20:
        raise HTTPException(status_code=422, detail="Job description is too short.")

    chunks = query_resume(body.file_id, body.job_description) if body.file_id else []

    async def event_stream():
        try:
            async for node_name, output in stream_pipeline(body.job_description, chunks):
                yield f"data: {json.dumps({'step': node_name, 'data': output})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
