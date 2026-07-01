import json
import os
import uuid
from typing import Any

from groq import Groq

_client: Groq | None = None
_sessions: dict[str, dict[str, Any]] = {}

_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "ask_followup",
            "description": "The answer was vague, missing a concrete example, or dodged the question. Ask one sharply focused follow-up.",
            "parameters": {
                "type": "object",
                "properties": {
                    "followup": {
                        "type": "string",
                        "description": "A single focused follow-up question, max 25 words.",
                    }
                },
                "required": ["followup"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "advance_to_next",
            "description": "The answer was substantive enough. Move to the next question.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "end_interview",
            "description": "All questions have been covered. End the interview and generate the debrief.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
]


def _get_client() -> Groq:
    global _client
    if _client is None:
        _client = Groq(api_key=os.getenv("GROQ_API_KEY"))
    return _client


def start_session(job_description: str, file_id: str | None, resume_chunks: list[str]) -> dict:
    from app.services.interview_service import generate_questions

    raw = generate_questions(resume_chunks, job_description)
    behavioral = [q for q in raw if q["category"] == "behavioral"][:3]
    technical = [q for q in raw if q["category"] == "technical"][:2]
    # Interleave for natural interview flow
    questions = [behavioral[0], technical[0], behavioral[1], technical[1], behavioral[2]]

    session_id = str(uuid.uuid4())
    first_q = questions[0]

    _sessions[session_id] = {
        "questions": questions,
        "question_index": 0,
        "history": [],
        "current_turn": _init_turn(first_q),
        "job_description": job_description,
        "status": "active",
    }

    return {
        "session_id": session_id,
        "question": {"text": first_q["question"], "category": first_q["category"], "hint": first_q["hint"]},
        "question_number": 1,
        "total_questions": len(questions),
    }


def process_answer(session_id: str, answer: str) -> dict:
    if session_id not in _sessions:
        raise ValueError("Session not found")
    session = _sessions[session_id]
    if session["status"] != "active":
        raise ValueError("Interview is already complete")

    turn = session["current_turn"]
    is_last = session["question_index"] == len(session["questions"]) - 1

    if turn["primary_answer"] is None:
        turn["primary_answer"] = answer
        action = _agent_decide(turn, session["job_description"], is_last)
    else:
        turn["followup_answer"] = answer
        action = "end" if is_last else "advance"

    if action == "followup":
        return {"type": "followup", "followup": turn["followup_question"]}

    session["history"].append(dict(turn))
    session["question_index"] += 1

    if action == "end" or session["question_index"] >= len(session["questions"]):
        debrief = _generate_debrief(session)
        session["status"] = "complete"
        return {"type": "debrief", "debrief": debrief}

    next_q = session["questions"][session["question_index"]]
    session["current_turn"] = _init_turn(next_q)
    return {
        "type": "next_question",
        "question": {"text": next_q["question"], "category": next_q["category"], "hint": next_q["hint"]},
        "question_number": session["question_index"] + 1,
        "total_questions": len(session["questions"]),
    }


def _init_turn(q: dict) -> dict:
    return {
        "question": q["question"],
        "category": q["category"],
        "hint": q["hint"],
        "primary_answer": None,
        "followup_question": None,
        "followup_answer": None,
    }


def _agent_decide(turn: dict, job_description: str, is_last: bool) -> str:
    if is_last:
        tools = [t for t in _TOOLS if t["function"]["name"] in ("ask_followup", "end_interview")]
        advance_tool = "end_interview"
    else:
        tools = [t for t in _TOOLS if t["function"]["name"] in ("ask_followup", "advance_to_next")]
        advance_tool = "advance_to_next"

    prompt = f"""You are a senior interviewer evaluating a candidate's response.

Question asked: {turn['question']}

Candidate's answer:
{turn['primary_answer']}

Decide:
- Call ask_followup ONLY if the answer is genuinely vague, missing a concrete example, or avoided the actual question. The follow-up must be sharply targeted (e.g. "What was the measurable outcome?" or "What was your specific contribution vs the team's?").
- Call {advance_tool} if the answer had real substance, even if imperfect. Don't probe just to be thorough."""

    try:
        response = _get_client().chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            tools=tools,
            tool_choice="required",
            temperature=0.2,
        )
        tool_calls = response.choices[0].message.tool_calls
        if not tool_calls:
            return "end" if is_last else "advance"

        tool_name = tool_calls[0].function.name
        if tool_name == "ask_followup":
            args = json.loads(tool_calls[0].function.arguments)
            turn["followup_question"] = args["followup"]
            return "followup"
        elif tool_name == "end_interview":
            return "end"
        else:
            return "advance"
    except Exception:
        return "end" if is_last else "advance"


def _generate_debrief(session: dict) -> dict:
    parts = []
    for i, turn in enumerate(session["history"], 1):
        part = f"Q{i} [{turn['category']}]: {turn['question']}\nAnswer: {turn['primary_answer']}"
        if turn["followup_question"]:
            part += f"\nFollow-up: {turn['followup_question']}\nAnswer: {turn['followup_answer'] or '(no answer)'}"
        parts.append(part)

    prompt = f"""You are a senior hiring manager who just conducted a mock interview. Evaluate the candidate honestly.

Job Description (excerpt):
{session['job_description'][:600]}

Interview Transcript:
{chr(10).join(parts)}

Return ONLY valid JSON, no markdown, no code fences:
{{
  "overall_score": <integer 0-100>,
  "hire_recommendation": "<Strong Yes | Yes | Maybe | No>",
  "overall_assessment": "<2-3 honest sentences>",
  "strengths": ["<strength1>", "<strength2>"],
  "improvements": ["<improvement1>", "<improvement2>"],
  "per_question": [
    {{
      "question": "<exact question text>",
      "score": <integer 0-100>,
      "feedback": "<1-2 honest sentences>"
    }}
  ]
}}

Be direct. Only score above 80 if answers had concrete examples and measurable outcomes."""

    response = _get_client().chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.1,
    )
    raw = response.choices[0].message.content.strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        start = raw.find("{")
        end = raw.rfind("}") + 1
        return json.loads(raw[start:end])
