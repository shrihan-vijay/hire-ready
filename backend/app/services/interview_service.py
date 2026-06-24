import json
import os

from groq import Groq

_client: Groq | None = None


def _get_client() -> Groq:
    global _client
    if _client is None:
        _client = Groq(api_key=os.getenv("GROQ_API_KEY"))
    return _client


def generate_questions(resume_chunks: list[str], job_description: str) -> list[dict]:
    resume_text = "\n\n---\n\n".join(resume_chunks) if resume_chunks else ""

    context = f"JOB DESCRIPTION:\n{job_description}"
    if resume_text:
        context = f"CANDIDATE RESUME:\n{resume_text}\n\n{context}"
        tailoring = "Tailor behavioral questions to the candidate's actual background and the role. Technical questions should target the specific stack and responsibilities in the JD."
    else:
        tailoring = "Base behavioral questions on the culture and role implied by the JD. Technical questions should target the specific stack and responsibilities."

    prompt = f"""You are an expert technical interviewer preparing a candidate for a job interview.

{context}

{tailoring}

Generate exactly 8 interview questions: 4 behavioral and 4 technical. Return ONLY a JSON array, no markdown, no code blocks:
[
  {{"question": "...", "category": "behavioral", "hint": "...one sentence coaching tip for answering this..."}},
  {{"question": "...", "category": "technical", "hint": "...one sentence on what the interviewer is really testing..."}}
]

Make questions specific — not generic. The behavioral questions should feel personal to this role and company. The technical questions should reference actual tools, languages, or systems from the JD."""

    response = _get_client().chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.5,
    )

    raw = response.choices[0].message.content.strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        start = raw.find("[")
        end = raw.rfind("]") + 1
        return json.loads(raw[start:end])


def get_feedback(question: str, user_answer: str, resume_chunks: list[str]) -> str:
    resume_section = ""
    if resume_chunks:
        resume_text = "\n---\n".join(resume_chunks[:3])
        resume_section = f"\nCANDIDATE RESUME CONTEXT:\n{resume_text}\n"

    prompt = f"""You are a brutally honest interview coach. Your job is to help candidates actually improve, not to make them feel good.

RULES:
- If the answer is blank, a single phrase like "don't know", "not sure", "I don't know", or fewer than 15 words of substance, do NOT give structured feedback. Instead write one direct sentence telling them this is not an answer and what they need to do instead. Example: "This isn't an answer — interviewers won't wait. Use the STAR format: describe a real Situation, the Task you faced, the Action you took, and the Result you achieved."
- Never open with hollow praise like "Great start!", "Good answer!", or "Nice response!" — these are meaningless if the answer is weak.
- If the answer has real substance, give honest, specific feedback. Acknowledge what works only if something genuinely does. Call out vagueness, missing specifics, or lack of measurable outcomes directly.
- Never soften a bad answer by burying criticism after excessive praise.
{resume_section}
INTERVIEW QUESTION: {question}

CANDIDATE'S ANSWER:
{user_answer}

If the answer has real substance (more than a few sentences with a real example), structure your feedback as:
1. Honest assessment of what actually worked (skip this if nothing did — don't invent positives)
2. What's missing or weak — be specific: no measurable result? No concrete example? Too vague? Say so.
3. One concrete rewrite suggestion or a specific experience from their resume they should reference instead

Keep the whole response under 200 words. Be direct. Be useful."""

    response = _get_client().chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
    )

    return response.choices[0].message.content.strip()
