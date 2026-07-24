# Hire Ready

An AI Resume & Interview Copilot — a full-stack app for tailoring resumes to job descriptions and preparing smarter interview answers.

## Current Stack

**Frontend**
- React + TypeScript
- Vite (dev server on port 5173)
- React Router v7 for client-side navigation
- React Context (`ResumeContext`) for cross-page state persistence
- axios for HTTP, lucide-react for icons

**Backend**
- FastAPI (Python)
- python-multipart for file uploads
- pdfplumber + python-docx for parsing
- sentence-transformers (`all-MiniLM-L6-v2`) for local embeddings (lazy singleton, ~90MB one-time download)
- Supabase Postgres + pgvector (`resume_chunks` table, `match_resume_chunks` RPC) for vector storage — replaced local ChromaDB, which lost all embeddings on every Render container restart/redeploy
- Groq API (`llama-3.3-70b-versatile`) for ATS scoring, interview question generation, feedback, and chatbot streaming
- Groq Whisper (`whisper-large-v3`) for voice answer transcription
- Supabase for auth (JWT) + relational storage (`resume_files`, `resume_analyses`, `job_applications` tables) + file storage (`resumes` bucket)
- LangGraph for the Job Recon sequential multi-agent pipeline
- GitHub MCP server (`@modelcontextprotocol/server-github`) for GitHub profile enrichment
- CORS configured for localhost:5173 / 5174
- dotenv for environment config (`backend/.env`, gitignored)

**Key Groq note:** `llama3-8b-8192` is decommissioned — always use `llama-3.3-70b-versatile`.

## Folder Structure

```
backend/app/
  api/
    routes.py              # Main router, wires sub-routers
    resume.py              # /upload, /analyze, /history (GET+DELETE) endpoints
    interview.py           # /questions, /feedback, /transcribe endpoints
    mock_interview.py      # /mock-interview/start, /mock-interview/answer endpoints
    chat.py                # /chat SSE streaming endpoint
    github_auth.py         # GitHub OAuth connect/callback (origin-aware HMAC state)
    app_intel.py           # /app-intel/run — Job Recon sequential pipeline (SSE)
    applications.py        # /applications CRUD — application tracker
  services/
    resume_service.py      # Orchestrates: validate → upload to Supabase Storage → parse → chunk → embed
    parser_service.py      # Extracts text from PDF/DOCX via BytesIO (no disk writes)
    chunker_service.py     # Overlapping 200-word windows (40-word overlap)
    embedder_service.py    # Embeds chunks, stores/queries ChromaDB; delete_chunks()
    llm_service.py         # Groq: ATS scoring + is_valid_job_description() shared validator
    interview_service.py   # Groq: question generation, feedback, Whisper transcription
    mock_interview_service.py  # Agent loop: session state, Groq tool calling, debrief generation
    chat_service.py        # Groq: streaming chat with resume RAG context
    history_service.py     # Supabase history: resume_files + resume_analyses CRUD
    jd_fetcher_service.py  # Fetches JD from URL: Ashby API / direct HTTP / Jina Reader fallback
    github_service.py      # GitHub MCP server calls (profile, repos)
    github_connection_service.py  # Supabase storage of per-user GitHub OAuth connection
    job_ranker_service.py  # Parallel (fan-out) job ranker: scores N JD URLs concurrently
    app_intel_service.py   # LangGraph sequential pipeline: Researcher → Optimizer → Strategist
    application_service.py # Application tracker CRUD (job_applications table)
  models/
    resume.py              # Pydantic models: upload/analyze/history/rank-jobs
    interview.py           # Pydantic models: questions/feedback request/response
    mock_interview.py      # Pydantic models: StartSessionRequest, SubmitAnswerRequest
    chat.py                # Pydantic models: ChatMessage, ChatRequest
    app_intel.py           # Pydantic models: RunRequest
    application.py         # Pydantic models: Create/UpdateApplicationRequest, Application
  core/                    # Config (env vars, app settings), Supabase client, auth deps

frontend/src/
  context/
    ResumeContext.tsx      # Global state: parseResult, analyzeResult, jd, qualification_gaps
    AuthContext.tsx        # Auth state: user, session, signIn, signUp, signOut
  lib/
    supabase.ts            # Supabase client singleton
  components/
    ResumeUpload.tsx       # Upload widget + JD input + ATS results card
    JobRanker.tsx          # Parallel job ranker UI: paste 2-5 URLs, streamed ranked results
    AddApplicationModal.tsx # Shared "track this job" form, reused by JobRanker/ResumeUpload/TrackerPage
    AuthGate.tsx           # Sign-in/sign-up/guest page at route /
    HowItWorks.tsx         # Interactive 4-step tutorial section
    Logo.tsx               # SVG logo (indigo-to-purple gradient)
    ChatBot.tsx            # Floating chat widget (SSE streaming, RAG context)
  pages/
    InterviewPage.tsx      # Two tabs: Mock Interview (agent) + Question Bank (behavioral + role-specific sub-tabs)
    ProfilePage.tsx        # Account info + sign out (sign-in form if guest)
    HistoryPage.tsx        # Resume history: accordion by file, nested analyses, per-score delete
    AppIntelPage.tsx       # "Job Recon" — Researcher/Optimizer/Strategist pipeline UI, streamed step-by-step
    TrackerPage.tsx        # Application tracker — kanban board (Saved/Applied/Interviewing/Offer/Rejected)
  App.tsx                  # Router, ResumeProvider keyed on user ID, nav, score guide, ChatBot
```

## Coding Standards

- Use type hints everywhere in Python
- Use Pydantic models for all request/response shapes
- Keep route handlers thin — business logic belongs in services
- Use async endpoints when possible
- TypeScript strict typing on the frontend
- No comments unless the WHY is non-obvious
- Use `import type { ... }` for TypeScript interface imports in Vite (avoids rolldown resolution errors)

## Architectural Principle

Every concern is isolated to one service file. Swap S3 for local disk → change only `resume_service.py`. Swap Pinecone for ChromaDB → change only `embedder_service.py`. Swap OpenAI for Groq → change only `llm_service.py` and `interview_service.py`. Route handlers never know which storage/LLM provider is running.

## Development Workflow

Before implementing a feature:
1. Check existing architecture and services
2. Reuse existing services when possible
3. Avoid duplicating API routes

**Running locally (one command):**
```bash
cd hire-ready && ./dev.sh
```
This starts both servers. Backend on `127.0.0.1:8000`, frontend on `127.0.0.1:5173`.

- Backend also runnable standalone: `cd backend && ./dev.sh`
- Frontend also runnable standalone: `cd frontend && npm run dev`
- API base URL read from `VITE_API_BASE_URL` env var (defaults to `http://localhost:8000`)

## Supabase Schema

No migration tooling exists in this repo — tables are created by hand via the Supabase SQL editor. Schema is tracked here as the source of truth.

```sql
-- resume_files (one row per upload)
file_id       text
user_id       uuid
filename      text
uploaded_at   timestamptz

-- resume_analyses (one row per ATS analysis, FK'd to resume_files.file_id)
file_id        text
score          int
matched_skills jsonb
missing_skills jsonb
jd_snippet     text (first 300 chars of JD)
summary        text (Groq-generated plain-English summary)
analyzed_at    timestamptz

-- resume_chunks (resume text chunks + embeddings, replaces local ChromaDB)
id            bigint primary key generated always as identity
file_id       text
filename      text
chunk_index   int
content       text
embedding     vector(384)  -- pgvector, matches all-MiniLM-L6-v2 output dim
created_at    timestamptz

-- job_applications (application tracker)
id            uuid primary key default gen_random_uuid()
user_id       uuid
company_name  text
job_title     text
job_url       text (nullable)
status        text (saved | applied | interviewing | offer | rejected)
file_id       text (nullable — resume used, if tracked from an ATS/ranker flow)
score         int (nullable — ATS score at time of tracking)
jd_snippet    text (nullable)
notes         text (nullable)
created_at    timestamptz
updated_at    timestamptz
```

`get_user_history` joins `resume_files` → nested `resume_analyses` so uploads without an analysis yet still show up. No RLS on any table — access control is enforced in application code via the Supabase admin/service-role client with explicit `.eq("user_id", ...)` filters.

## Current Features

### Backend
- `GET /api/health` — health check
- `POST /api/resume/upload` — validates PDF/DOCX ≤5 MB, uploads to Supabase Storage (`resumes` bucket), parses bytes via BytesIO (no disk writes), chunks, embeds into ChromaDB; returns `{ filename, file_id, word_count, sections }`
- `POST /api/resume/analyze` — takes `{ file_id, job_description }`, validates JD (20-word minimum + semantic check via `is_valid_job_description`), queries ChromaDB, calls Groq; returns `{ score, matched_skills, missing_skills, qualification_gaps, summary }`; saves to `resume_history` via INSERT
- `GET /api/resume/history` — requires auth; returns `ResumeFile[]` grouped by file_id with nested `AnalysisEntry[]`, newest-first
- `DELETE /api/resume/history/{file_id}` — requires auth; deletes all Supabase rows + ChromaDB chunks for that file
- `DELETE /api/resume/history/{file_id}/score?at=<timestamp>` — requires auth; deletes a single analysis row by `file_id + uploaded_at` composite key
- `POST /api/resume/fetch-jd` — takes `{ url }`, fetches job description text from any URL; tries direct HTTP with browser-like headers first, falls back to Jina Reader for JS-rendered pages; returns `{ text, title }`
- `POST /api/interview/questions` — takes `{ file_id?, job_description }`, validates JD (20-word minimum only — semantic check removed to avoid false rejections on URL-fetched JDs), retrieves resume chunks, calls Groq; returns 8 questions (4 behavioral + 4 technical)
- `POST /api/interview/feedback` — takes `{ question, user_answer, file_id? }`, calls Groq with honest coaching rules; returns `{ feedback }`
- `POST /api/interview/transcribe` — takes audio file (multipart), calls Groq `whisper-large-v3`; returns `{ text }`; supports `audio/mp4` (Safari), `audio/webm` (Chrome), `audio/ogg` (Firefox)
- `POST /api/mock-interview/start` — takes `{ job_description, file_id? }`, generates 5 questions (3 behavioral + 2 technical, interleaved), stores session in memory, returns first question + `session_id`
- `POST /api/mock-interview/answer` — takes `{ session_id, answer }`, runs one agent loop iteration via Groq tool calling; returns one of: `{ type: "followup", followup }` | `{ type: "next_question", question, question_number, total_questions }` | `{ type: "debrief", debrief }`
- `POST /api/chat/` — takes `{ messages, file_id?, job_description? }`, queries ChromaDB for resume context, streams Groq response as SSE (`data: {"token": "..."}` then `data: [DONE]`)
- `GET /api/github/connect` — starts GitHub OAuth; encodes frontend `Origin` header into HMAC-signed state so callback redirects to the exact host (fixes localhost vs 127.0.0.1 split)
- `GET /api/github/callback` — verifies HMAC state, exchanges code for token, saves to Supabase, redirects to origin `/home?github=connected`
- `POST /api/resume/rank-jobs` — takes `{ file_id?, urls: string[] }` (2–5 URLs), fires one scoring pass per URL concurrently via `asyncio.gather()`, streams each result as SSE as it completes; returns per-job `{ url, title, ok, score, matched_skills, missing_skills, summary, jd_snippet }`
- `POST /api/app-intel/run` — takes `{ job_description, file_id? }`, runs the Job Recon LangGraph pipeline (Researcher → Resume Optimizer → Interview Strategist, each step's output feeding the next), streams each agent's output as SSE as it completes
- `POST /api/applications/` — takes `{ company_name, job_title, job_url?, file_id?, score?, jd_snippet?, notes? }`; requires auth; creates a tracker entry with `status = "saved"`
- `GET /api/applications/` — requires auth; lists the user's tracked applications, newest-updated first
- `PATCH /api/applications/{id}` — takes `{ status?, notes? }`; requires auth; partial update (used by the kanban drag-and-drop to change status)
- `DELETE /api/applications/{id}` — requires auth; deletes a tracked application

### Frontend
- SVG logo (indigo-purple gradient with checkmark)
- Sticky frosted-glass navbar with nav tabs (Home, Interview Prep, Tracker, History) using NavLink
- Drag-and-drop resume upload with file preview, validation, success/error states
- JD input: tab switcher between "Paste JD" (textarea) and "From URL" (fetches via `POST /api/resume/fetch-jd`, Jina Reader fallback for JS-rendered pages); ATS analysis: score ring (green ≥70, amber ≥45, red <45), matched/missing skills
- "What does this mean?" link scrolls to ATS score guide section
- "Prep for this interview" button → navigates to Interview Prep with file_id + JD
- Upload card header changes dynamically: "Upload your resume" → "Match to a job" → "Your ATS results" based on parse/analyze state
- Cross-page state persistence via `ResumeContext` (survives React Router navigation)
- `ResumeProvider` keyed on `user?.id ?? 'logged-out'` — resets context on login/logout to prevent stale state
- GitHub connect: optional section on home upload card (below "Use previous resume"); dashed divider with "Enhance your score · optional" label; removed from ProfilePage
- Interview Prep page — two main tabs:
  - **Mock Interview** (default tab): adaptive agent-driven interview; 5 questions (3 behavioral + 2 technical); after each answer the LLM decides via Groq tool calling whether to ask a targeted follow-up or advance; ends with a scored debrief (overall score 0–100, hire recommendation, per-question feedback, strengths/improvements); session state held in-memory on backend keyed by `session_id`
  - **Question Bank**: two sub-tabs — Behavioral (15 hardcoded questions across 5 categories, one-by-one default) and Role-Specific (auto-generates from JD + resume via Groq, one-by-one default); switching to Question Bank with a pre-loaded JD auto-navigates to Role-Specific sub-tab and triggers generation
  - Both tabs support voice recording: `VoiceMicButton` uses `MediaRecorder` → POSTs to `/api/interview/transcribe` → transcript appends to answer
  - AI feedback per answer (honest coaching, bans hollow praise, STAR format guidance)
- History page: accordion list of uploaded resumes (newest first); click to expand → see all ATS scores; each analysis shows score badge, date, "View summary" toggle (Groq summary), skill chips, "Prep interview" button; per-score trash icon with inline confirmation; full-resume trash icon with confirmation; deletes Supabase rows + ChromaDB chunks
- Chatbot: floating widget bottom-right (`ChatBot.tsx`); indigo/purple FAB; expandable panel with SSE streaming; auto-injects `file_id` (RAG via ChromaDB) and `jd` from `ResumeContext`; auth token from `useAuth().session`; when no resume loaded, directs user to upload rather than asking them to paste; visible to authed + guest users on all non-auth pages
- "How it works" interactive 4-step stepper section (Step 2: matched/missing skill chips; Step 4: AI feedback coaching)
- ATS score guide section (4 range cards: 0-40 red, 41-60 amber, 61-79 blue, 80-100 green)
- Profile page: email + sign out for logged-in users; sign-in/sign-up form for guests
- ATS analysis includes `qualification_gaps` — amber warning box listing stated JD requirements the resume doesn't satisfy (years of experience, degree, certifications); scored by LLM alongside skills
- Job Ranker (`JobRanker.tsx`, on the home upload card): paste 2–5 job listing URLs, ranks them by ATS fit against the loaded resume; each result card streams in with a score ring, matched/missing skill chips, and "Job Recon" / "Prep Interview" / "Track" actions
- Job Recon (`AppIntelPage.tsx`, route `/apply`): runs the 3-agent Researcher → Resume Optimizer → Interview Strategist pipeline against a JD; each step's card (company research, before/after bullet rewrites, company-specific interview questions) appears as it streams in
- Application Tracker (`TrackerPage.tsx`, route `/tracker`): kanban board with 5 columns (Saved/Applied/Interviewing/Offer/Rejected); drag a card between columns to update status (native HTML5 drag-and-drop, no external DnD library); "Track this job" button on the ATS results card and each Job Ranker result opens a shared `AddApplicationModal` prefilled with what's known (score, file_id, JD snippet, URL); manual "Add application" button on the tracker page itself for jobs never run through those tools; status changes and deletes are optimistic with a rollback-via-refetch on failure

## Agent Architecture

### Single Agent — Mock Interview
`mock_interview_service.py` implements a single agent loop using Groq tool calling. Sessions are stored in a module-level dict (`_sessions`) keyed by UUID. The agent has three tools: `ask_followup`, `advance_to_next`, `end_interview`. Each HTTP request to `/answer` is one agent iteration — the LLM picks a tool, the backend executes it, and the result is returned to the frontend. `tool_choice="required"` forces the LLM to always call a tool rather than returning free text, making the response shape deterministic.

```
POST /answer
  → build prompt with question + candidate's answer
  → Groq tool call (tool_choice="required")
  → LLM picks ask_followup | advance_to_next | end_interview
  → execute: return followup text | load next question | generate debrief
```

Max one follow-up per question. After all questions answered, `_generate_debrief()` makes one final Groq call with the full transcript to produce a structured JSON report.

### Parallel (fan-out) — Job Ranker
`job_ranker_service.py` implements the fan-out pattern: `stream_rankings()` fires one scoring coroutine per JD URL via `asyncio.gather()`/`as_completed`-style streaming, so results appear as each URL finishes rather than waiting for the slowest. Total wall-clock time is max(single-URL latency), not the sum. Each coroutine fetches the JD (reusing `jd_fetcher_service`, including its Ashby-specific fast path), then scores it against the resume the same way `/resume/analyze` does. Exposed via `POST /api/resume/rank-jobs`, consumed by `JobRanker.tsx`.

### Sequential (pipeline) — Job Recon
`app_intel_service.py` implements the sequential pattern using LangGraph. Three nodes run in order — `_researcher` (extracts company/tech-stack/culture signals from the JD), `_optimizer` (rewrites resume bullets using the researcher's output), `_strategist` (generates company-specific interview questions using both prior outputs) — each a single Groq call whose JSON output feeds the next node's prompt. `stream_pipeline()` yields `(node_name, output)` as each node completes; `POST /api/app-intel/run` forwards these as SSE. Consumed by `AppIntelPage.tsx` ("Job Recon"), which renders each step's card as it streams in.

### MCP Integrations
- **GitHub MCP server** (`github_service.py`) — connects to `@modelcontextprotocol/server-github` via stdio to fetch a candidate's public profile + top repos; the result is injected into the ATS scoring prompt (`llm_service.py`) so scoring/summary can factor in GitHub activity. Wired to both the OAuth-connected flow (logged-in users, `github_connection_service.py`) and a manual-username flow (guests, server PAT).
- **Planned: LinkedIn MCP** — fetch JD text from LinkedIn URLs. Currently blocked: LinkedIn actively blocks automated access (see `jd_fetcher_service.py`'s explicit error message for LinkedIn/Indeed), and no public LinkedIn MCP server exists — low feasibility until that changes.

## Planned Features

- Email-parsing automation for the Application Tracker (auto-detect status changes — interview invites, rejections, offers — from a connected inbox) as a stretch goal on top of the manual kanban tracker
- LinkedIn JD fetch (see MCP Integrations above — blocked on LinkedIn's anti-scraping posture, not currently worth pursuing)
