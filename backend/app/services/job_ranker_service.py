import asyncio
import json
from typing import AsyncIterator

from fastapi import HTTPException

from app.services.embedder_service import query_resume
from app.services.jd_fetcher_service import fetch_jd_from_url
from app.services.llm_service import analyze_resume

_MIN_JD_WORDS = 50


async def _score_url(file_id: str | None, url: str) -> dict:
    try:
        jd_data = await fetch_jd_from_url(url)
        jd_text = jd_data.get("text", "")
        title = jd_data.get("title") or url

        if len(jd_text.strip().split()) < _MIN_JD_WORDS:
            return {
                "url": url, "title": title, "ok": False,
                "error": "Could not extract the job description from this URL. The page may require login or use heavy JavaScript rendering. Try the single JD flow and paste the text directly.",
            }

        chunks = await asyncio.to_thread(query_resume, file_id, jd_text) if file_id else []
        result = await asyncio.to_thread(analyze_resume, chunks, jd_text)

        return {
            "url": url,
            "title": title,
            "ok": True,
            "score": result["score"],
            "matched_skills": result["matched_skills"],
            "missing_skills": result["missing_skills"],
            "summary": result["summary"],
            "jd_snippet": jd_text[:300],
        }
    except HTTPException as e:
        return {"url": url, "title": url, "ok": False, "error": e.detail}
    except json.JSONDecodeError:
        return {
            "url": url, "title": url, "ok": False,
            "error": "Could not parse the job description from this URL. The page content may be too sparse or in an unsupported format.",
        }
    except Exception as e:
        return {"url": url, "title": url, "ok": False, "error": str(e)}


async def stream_rankings(file_id: str | None, urls: list[str]) -> AsyncIterator[dict]:
    tasks = [asyncio.create_task(_score_url(file_id, url)) for url in urls]
    for future in asyncio.as_completed(tasks):
        result = await future
        yield result
