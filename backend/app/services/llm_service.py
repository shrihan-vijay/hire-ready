import json
import os
from typing import Optional

from groq import Groq

_client: Groq | None = None


def _get_client() -> Groq:
    global _client
    if _client is None:
        _client = Groq(api_key=os.getenv("GROQ_API_KEY"))
    return _client


def _format_github_section(ctx: dict) -> str:
    lines = [f"\nGITHUB PROFILE (@{ctx['username']}) — real project evidence to supplement the resume:"]
    for repo in ctx.get("repos", []):
        line = f"  • {repo['name']}"
        if repo["language"]:
            line += f" [{repo['language']}]"
        if repo["description"]:
            line += f" — {repo['description']}"
        if repo["topics"]:
            line += f" | tags: {', '.join(repo['topics'][:6])}"
        lines.append(line)
        if repo.get("readme"):
            lines.append(f"    README: {repo['readme'][:200]}")
    lines.append(
        "If GitHub demonstrates skills not explicitly stated in the resume, "
        "factor that evidence into the score and matched_skills.\n"
    )
    return "\n".join(lines)


def analyze_resume(
    chunks: list[str],
    job_description: str,
    github_context: Optional[dict] = None,
) -> dict:
    resume_text = "\n\n---\n\n".join(chunks)
    github_section = _format_github_section(github_context) if github_context else ""

    prompt = f"""You are an ATS (Applicant Tracking System) expert. Analyze how well the resume matches the job description across TWO dimensions: skills and qualifications.

RESUME SECTIONS:
{resume_text}
{github_section}
JOB DESCRIPTION:
{job_description}

Scoring rules:
- Factor in BOTH technical skills/keywords AND stated qualifications (years of experience, degree requirements, seniority level, certifications).
- If the JD explicitly requires e.g. "5+ years" and the resume clearly shows less, lower the score meaningfully.
- If the JD requires a specific degree or certification and the resume doesn't show it, factor this in.
- Only penalise for qualifications that are explicitly stated in the JD — do not invent requirements.
- If the JD does not state a qualification (e.g. no degree requirement mentioned), do not penalise for it.

Degree/graduation rules (critical — read carefully):
- If the JD states a degree must be completed BY a specific date or window (e.g. "graduating by December 2027", "completed by June 2028", "class of 2026-2027"), compare that deadline against the candidate's expected graduation date shown in the resume.
- If the resume shows an in-progress degree with a graduation date that falls ON or BEFORE the JD's deadline, the requirement IS met — do NOT flag it as a gap.
- Only flag a degree gap if: (a) no degree is shown at all, (b) the graduation date is clearly AFTER the JD's deadline, or (c) the wrong field of study is required and not present.
- Do not flag "currently enrolled" or "in progress" as a gap if the timeline is compatible.

qualification_gaps: list each stated JD requirement that the resume does not clearly satisfy. Return an empty list if all stated qualifications appear to be met or if the JD specifies none.

Respond with a JSON object in this exact format (no markdown, no code blocks, just raw JSON):
{{
  "score": <integer 0-100>,
  "matched_skills": [<skills/keywords present in both resume/GitHub and JD>],
  "missing_skills": [<important skills/keywords in JD but absent from resume and GitHub>],
  "qualification_gaps": [<stated JD qualifications the resume does not clearly meet>],
  "summary": "<2-3 sentence plain-English summary of the match, noting any key qualification gaps>"
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


def is_valid_job_description(text: str) -> bool:
    # Sample beginning + middle so we see actual JD content even if the page
    # leads with application form boilerplate (which can fool a short prefix check)
    sample = text[:2000] + ("\n\n...\n\n" + text[len(text)//2: len(text)//2 + 1000] if len(text) > 3000 else "")
    response = _get_client().chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{
            "role": "user",
            "content": (
                "Does the following text contain a real job description or job posting "
                "(with responsibilities, requirements, or role details)? "
                "Reply with only 'yes' or 'no'.\n\n" + sample
            ),
        }],
        temperature=0,
        max_tokens=3,
    )
    return response.choices[0].message.content.strip().lower().startswith("y")
