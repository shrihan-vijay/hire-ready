import json
import os
from typing import Any, AsyncIterator, TypedDict

from groq import Groq
from langgraph.graph import END, START, StateGraph

_client: Groq | None = None


def _get_client() -> Groq:
    global _client
    if _client is None:
        _client = Groq(api_key=os.getenv("GROQ_API_KEY"))
    return _client


def _parse_json(raw: str) -> dict:
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        s, e = raw.find("{"), raw.rfind("}") + 1
        return json.loads(raw[s:e])


class AppIntelState(TypedDict):
    job_description: str
    resume_chunks: list[str]
    company_name: str
    tech_stack: list[str]
    culture_signals: list[str]
    key_themes: list[str]
    role_context: str
    bullet_suggestions: list[dict]
    strategic_questions: list[dict]


def _researcher(state: AppIntelState) -> dict[str, Any]:
    prompt = f"""Analyze this job description and extract company and role intelligence.

JOB DESCRIPTION:
{state["job_description"]}

Return ONLY valid JSON (no markdown, no explanation):
{{
  "company_name": "<company name, or 'Unknown' if not mentioned>",
  "tech_stack": ["<every technology, tool, language, or framework mentioned>"],
  "culture_signals": ["<phrases that reveal how the team works, values, or culture>"],
  "key_themes": ["<what this company clearly prioritizes, e.g. scale, reliability, speed>"],
  "role_context": "<2-3 sentences: what kind of person succeeds here and what the role is really about>"
}}"""

    response = _get_client().chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
    )
    parsed = _parse_json(response.choices[0].message.content.strip())
    return {
        "company_name": parsed.get("company_name", "Unknown"),
        "tech_stack": parsed.get("tech_stack", []),
        "culture_signals": parsed.get("culture_signals", []),
        "key_themes": parsed.get("key_themes", []),
        "role_context": parsed.get("role_context", ""),
    }


def _optimizer(state: AppIntelState) -> dict[str, Any]:
    resume_text = "\n\n---\n\n".join(state["resume_chunks"]) if state["resume_chunks"] else "No resume provided."
    prompt = f"""You are a resume coach helping a candidate tailor their resume for a specific company.

COMPANY INTELLIGENCE:
Company: {state["company_name"]}
Tech Stack: {", ".join(state["tech_stack"])}
Culture: {", ".join(state["culture_signals"])}
Key Themes: {", ".join(state["key_themes"])}
Role Context: {state["role_context"]}

JOB DESCRIPTION (excerpt):
{state["job_description"][:1000]}

CANDIDATE'S RESUME:
{resume_text[:2000]}

Suggest 4 specific bullet point improvements. For each, reference actual resume content and show a concrete rewrite that mirrors the company's language and priorities. If no resume is provided, create hypothetical improvements based on common experience for this role.

Return ONLY valid JSON:
{{
  "bullet_suggestions": [
    {{
      "original": "<current bullet from the resume, or a generic placeholder if no resume>",
      "improved": "<rewritten bullet>",
      "reason": "<one sentence: why this version fits the company better>"
    }}
  ]
}}"""

    response = _get_client().chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
    )
    parsed = _parse_json(response.choices[0].message.content.strip())
    return {"bullet_suggestions": parsed.get("bullet_suggestions", [])}


def _strategist(state: AppIntelState) -> dict[str, Any]:
    resume_text = "\n\n---\n\n".join(state["resume_chunks"]) if state["resume_chunks"] else "No resume provided."
    prompt = f"""You are a senior interview coach preparing a candidate for a specific company.

COMPANY INTELLIGENCE:
Company: {state["company_name"]}
Culture: {", ".join(state["culture_signals"])}
Key Themes: {", ".join(state["key_themes"])}
Role Context: {state["role_context"]}

JOB DESCRIPTION (excerpt):
{state["job_description"][:800]}

CANDIDATE'S BACKGROUND:
{resume_text[:1000]}

Generate 5 interview questions this specific company is likely to ask, grounded in their actual priorities — not generic questions. Include what the interviewer is really trying to assess beneath the surface.

Return ONLY valid JSON:
{{
  "strategic_questions": [
    {{
      "question": "<the interview question>",
      "why_theyll_ask": "<one sentence: what they're really trying to assess>",
      "category": "<technical|behavioral|situational>"
    }}
  ]
}}"""

    response = _get_client().chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
    )
    parsed = _parse_json(response.choices[0].message.content.strip())
    return {"strategic_questions": parsed.get("strategic_questions", [])}


def _build_graph():
    builder = StateGraph(AppIntelState)
    builder.add_node("researcher", _researcher)
    builder.add_node("optimizer", _optimizer)
    builder.add_node("strategist", _strategist)
    builder.add_edge(START, "researcher")
    builder.add_edge("researcher", "optimizer")
    builder.add_edge("optimizer", "strategist")
    builder.add_edge("strategist", END)
    return builder.compile()


_graph = _build_graph()


async def stream_pipeline(
    job_description: str, resume_chunks: list[str]
) -> AsyncIterator[tuple[str, dict]]:
    initial: AppIntelState = {
        "job_description": job_description,
        "resume_chunks": resume_chunks,
        "company_name": "",
        "tech_stack": [],
        "culture_signals": [],
        "key_themes": [],
        "role_context": "",
        "bullet_suggestions": [],
        "strategic_questions": [],
    }
    async for chunk in _graph.astream(initial):
        node_name = next(iter(chunk))
        yield node_name, chunk[node_name]
