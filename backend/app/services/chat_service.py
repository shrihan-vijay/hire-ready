import os
from typing import Generator

from groq import Groq

from app.models.chat import ChatMessage

_client: Groq | None = None


def _get_client() -> Groq:
    global _client
    if _client is None:
        _client = Groq(api_key=os.getenv("GROQ_API_KEY"))
    return _client


def _build_system_prompt(resume_chunks: list[str], job_description: str | None) -> str:
    has_resume = bool(resume_chunks)
    parts = [
        "You are HireReady's career AI assistant. Help users with: understanding their ATS score, "
        "improving their resume for specific roles, interview preparation, and job search strategy. "
        "Be concise, direct, and actionable — no hollow praise. "
        "If asked about something completely unrelated to careers, politely redirect back to career topics."
    ]
    if has_resume:
        resume_text = "\n\n---\n\n".join(resume_chunks)
        parts.append(f"\nUSER'S RESUME (relevant sections):\n{resume_text}")
    else:
        parts.append(
            "\nNO RESUME LOADED: The user has not uploaded or selected a resume in this session. "
            "If they ask about their specific resume content (gaps, formatting, skills, etc.), "
            "tell them to upload a resume or click 'Use previous resume' in the upload card on the Home page — "
            "do NOT ask them to paste or share their resume in chat. "
            "You can still answer general career, job search, and interview questions without a resume."
        )
    if job_description:
        parts.append(f"\nTARGET JOB DESCRIPTION:\n{job_description[:1500]}")
    return "\n".join(parts)


def stream_chat(
    messages: list[ChatMessage],
    resume_chunks: list[str],
    job_description: str | None,
) -> Generator[str, None, None]:
    system_prompt = _build_system_prompt(resume_chunks, job_description)
    groq_messages: list[dict] = [{"role": "system", "content": system_prompt}]
    groq_messages += [{"role": m.role, "content": m.content} for m in messages]

    stream = _get_client().chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=groq_messages,
        stream=True,
        temperature=0.7,
        max_tokens=1024,
    )

    for chunk in stream:
        content = chunk.choices[0].delta.content
        if content:
            yield content
