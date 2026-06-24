import json
import os

from groq import Groq

_client: Groq | None = None


def _get_client() -> Groq:
    global _client
    if _client is None:
        _client = Groq(api_key=os.getenv("GROQ_API_KEY"))
    return _client


def analyze_resume(chunks: list[str], job_description: str) -> dict:
    resume_text = "\n\n---\n\n".join(chunks)

    prompt = f"""You are an ATS (Applicant Tracking System) expert. Analyze how well the resume matches the job description.

RESUME SECTIONS:
{resume_text}

JOB DESCRIPTION:
{job_description}

Respond with a JSON object in this exact format (no markdown, no code blocks, just raw JSON):
{{
  "score": <integer 0-100>,
  "matched_skills": [<list of skills/keywords present in both resume and JD>],
  "missing_skills": [<list of important skills/keywords in JD but missing from resume>],
  "summary": "<2-3 sentence plain-English summary of the match>"
}}"""

    response = _get_client().chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
    )

    raw = response.choices[0].message.content.strip()

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        start = raw.find("{")
        end = raw.rfind("}") + 1
        return json.loads(raw[start:end])
