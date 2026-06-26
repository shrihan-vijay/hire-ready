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
- ChromaDB (SQLite-backed) for vector storage at `backend/chroma_db/`
- Groq API (`llama-3.3-70b-versatile`) for ATS scoring, interview question generation, and feedback
- Supabase for auth (JWT) + history storage (`resume_history` table)
- CORS configured for localhost:5173 / 5174
- dotenv for environment config (`backend/.env`, gitignored)

**Key Groq note:** `llama3-8b-8192` is decommissioned — always use `llama-3.3-70b-versatile`.

## Folder Structure

```
backend/app/
  api/
    routes.py              # Main router, wires sub-routers
    resume.py              # /upload, /analyze, /history (GET+DELETE) endpoints
    interview.py           # /questions and /feedback endpoints
    github_auth.py         # GitHub OAuth connect/callback (origin-aware HMAC state)
  services/
    resume_service.py      # Orchestrates: validate → upload to Supabase Storage → parse → chunk → embed
    parser_service.py      # Extracts text from PDF/DOCX, detects sections
    chunker_service.py     # Overlapping 200-word windows (40-word overlap)
    embedder_service.py    # Embeds chunks, stores/queries ChromaDB; delete_chunks()
    llm_service.py         # Groq call for ATS scoring
    interview_service.py   # Groq calls for question generation + feedback
    history_service.py     # Supabase history: save (INSERT), fetch (grouped), delete
    jd_fetcher_service.py  # Fetches JD from URL: direct HTTP first, Jina Reader fallback
    github_service.py      # GitHub API calls (profile, repos)
  models/
    resume.py              # Pydantic models: upload/analyze/history (ResumeFile, AnalysisEntry)
    interview.py           # Pydantic models: questions/feedback request/response
  core/                    # Config (env vars, app settings), Supabase client, auth deps

frontend/src/
  context/
    ResumeContext.tsx      # Global state: parseResult, analyzeResult, jd
    AuthContext.tsx        # Auth state: user, session, signIn, signUp, signOut
  lib/
    supabase.ts            # Supabase client singleton
  components/
    ResumeUpload.tsx       # Upload widget + JD input + ATS results card
    AuthGate.tsx           # Sign-in/sign-up/guest page at route /
    HowItWorks.tsx         # Interactive 4-step tutorial section
    Logo.tsx               # SVG logo (indigo-to-purple gradient)
  pages/
    InterviewPage.tsx      # Behavioral + role-specific interview prep
    ProfilePage.tsx        # Account info + sign out (sign-in form if guest)
    HistoryPage.tsx        # Resume history: accordion by file, nested analyses, delete
  App.tsx                  # Router, ResumeProvider keyed on user ID, nav, score guide
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

```sql
-- resume_history table (one row per upload OR per analysis)
file_id       text
user_id       uuid
filename      text
score         int (null for upload-only rows)
matched_skills jsonb
missing_skills jsonb
jd_snippet    text (first 300 chars of JD)
summary       text (Groq-generated plain-English summary)
uploaded_at   timestamptz
```

Upload rows have `score = null`. Each ATS analysis INSERTs a new row (not UPDATE). `get_user_history` groups by `file_id` so uploads never appear as blank cards.

## Current Features

### Backend
- `GET /api/health` — health check
- `POST /api/resume/upload` — validates PDF/DOCX ≤5 MB, saves with UUID, parses text, chunks, embeds into ChromaDB; returns `{ filename, file_id, word_count, sections }`
- `POST /api/resume/analyze` — takes `{ file_id, job_description }`, queries ChromaDB for relevant chunks, calls Groq; returns `{ score, matched_skills, missing_skills, summary }`; saves analysis to `resume_history` via INSERT (not UPDATE)
- `GET /api/resume/history` — requires auth; returns `ResumeFile[]` grouped by file_id with nested `AnalysisEntry[]`, newest-first
- `DELETE /api/resume/history/{file_id}` — requires auth; deletes all Supabase rows + ChromaDB chunks for that file
- `POST /api/resume/fetch-jd` — takes `{ url }`, fetches job description text from any URL; tries direct HTTP with browser-like headers first, falls back to Jina Reader for JS-rendered pages; returns `{ text, title }`
- `POST /api/interview/questions` — takes `{ file_id?, job_description }`, retrieves resume chunks, calls Groq; returns 8 questions (4 behavioral + 4 technical)
- `POST /api/interview/feedback` — takes `{ question, user_answer, file_id? }`, calls Groq with honest coaching rules; returns `{ feedback }`
- `GET /api/github/connect` — starts GitHub OAuth; encodes frontend `Origin` header into HMAC-signed state so callback redirects to the exact host (fixes localhost vs 127.0.0.1 split)
- `GET /api/github/callback` — verifies HMAC state, exchanges code for token, saves to Supabase, redirects to origin `/home?github=connected`

### Frontend
- SVG logo (indigo-purple gradient with checkmark)
- Sticky frosted-glass navbar with nav tabs (Home, Interview Prep, History) using NavLink
- Drag-and-drop resume upload with file preview, validation, success/error states
- JD input: tab switcher between "Paste JD" (textarea) and "From URL" (fetches via `POST /api/resume/fetch-jd`, Jina Reader fallback for JS-rendered pages); ATS analysis: score ring (green ≥70, amber ≥45, red <45), matched/missing skills
- "What does this mean?" link scrolls to ATS score guide section
- "Prep for this interview" button → navigates to Interview Prep with file_id + JD
- Upload card header changes dynamically: "Upload your resume" → "Match to a job" → "Your ATS results" based on parse/analyze state
- Cross-page state persistence via `ResumeContext` (survives React Router navigation)
- `ResumeProvider` keyed on `user?.id ?? 'logged-out'` — resets context on login/logout to prevent stale state
- GitHub connect: optional section on home upload card (below "Use previous resume"); dashed divider with "Enhance your score · optional" label; removed from ProfilePage
- Interview Prep page:
  - Behavioral mode: 15 hardcoded questions across 5 categories, instant load
  - Role-specific mode: auto-generates on mount if JD present, calls Groq
  - All view (accordion cards) or One-by-one view (full card + prev/next + dot nav)
  - AI feedback per answer (honest coaching, bans hollow praise)
  - Word count warning for answers < 10 words
- History page: accordion list of uploaded resumes (newest first); click to expand → see all ATS scores; each analysis shows score badge, date, "View summary" toggle (Groq summary), skill chips, "Prep interview" button; trash icon with inline confirmation; deletes Supabase rows + ChromaDB chunks
- "How it works" interactive 4-step stepper section (Step 2: matched/missing skill chips; Step 4: AI feedback coaching)
- ATS score guide section (4 range cards: 0-40 red, 41-60 amber, 61-79 blue, 80-100 green)
- Profile page: email + sign out for logged-in users; sign-in/sign-up form for guests

## Planned Features

- PostgreSQL (move from Supabase history rows to proper relational schema for files table)
- MCP integrations (LinkedIn JD fetch, deeper GitHub profile integration)
- Chatbot (conversational AI assistant within the app)
- Voice recognition for interview answers (speak instead of type, Web Speech API or Whisper)
