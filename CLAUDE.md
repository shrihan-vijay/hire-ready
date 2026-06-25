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
- CORS configured for localhost:5173 / 5174
- dotenv for environment config (`backend/.env`, gitignored)

**Key Groq note:** `llama3-8b-8192` is decommissioned — always use `llama-3.3-70b-versatile`.

## Folder Structure

```
backend/app/
  api/
    routes.py              # Main router, wires sub-routers
    resume.py              # /upload and /analyze endpoints
    interview.py           # /questions and /feedback endpoints
  services/
    resume_service.py      # Orchestrates: validate → parse → chunk → embed
    parser_service.py      # Extracts text from PDF/DOCX, detects sections
    chunker_service.py     # Overlapping 200-word windows (40-word overlap)
    embedder_service.py    # Embeds chunks, stores/queries ChromaDB
    llm_service.py         # Groq call for ATS scoring
    interview_service.py   # Groq calls for question generation + feedback
  models/
    resume.py              # Pydantic models: upload/analyze request/response
    interview.py           # Pydantic models: questions/feedback request/response
  core/                    # Config (env vars, app settings)

frontend/src/
  context/
    ResumeContext.tsx      # Global state: parseResult, analyzeResult, jd
  components/
    ResumeUpload.tsx       # Upload widget + JD input + ATS results card
    HowItWorks.tsx         # Interactive 4-step tutorial section
    Logo.tsx               # SVG logo (indigo-to-purple gradient)
  pages/
    InterviewPage.tsx      # Behavioral + role-specific interview prep
    ProfilePage.tsx        # Placeholder (auth coming)
  App.tsx                  # Router, nav tabs, score guide section
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

## Current Features

### Backend
- `GET /api/health` — health check
- `POST /api/resume/upload` — validates PDF/DOCX ≤5 MB, saves with UUID, parses text, chunks, embeds into ChromaDB; returns `{ filename, file_id, word_count, sections }`
- `POST /api/resume/analyze` — takes `{ file_id, job_description }`, queries ChromaDB for relevant chunks, calls Groq; returns `{ score, matched_skills, missing_skills, summary }`
- `POST /api/interview/questions` — takes `{ file_id?, job_description }`, retrieves resume chunks, calls Groq; returns 8 questions (4 behavioral + 4 technical)
- `POST /api/interview/feedback` — takes `{ question, user_answer, file_id? }`, calls Groq with honest coaching rules; returns `{ feedback }`

### Frontend
- SVG logo (indigo-purple gradient with checkmark)
- Sticky frosted-glass navbar with nav tabs (Home, Interview Prep, Profile) using NavLink
- Drag-and-drop resume upload with file preview, validation, success/error states
- JD input + ATS analysis: score ring (green ≥70, amber ≥45, red <45), matched/missing skills
- "What does this mean?" link scrolls to ATS score guide section
- "Prep for this interview" button → navigates to Interview Prep with file_id + JD
- Cross-page state persistence via `ResumeContext` (survives React Router navigation)
- Interview Prep page:
  - Behavioral mode: 15 hardcoded questions across 5 categories, instant load
  - Role-specific mode: auto-generates on mount if JD present, calls Groq
  - All view (accordion cards) or One-by-one view (full card + prev/next + dot nav)
  - AI feedback per answer (honest coaching, bans hollow praise)
  - Word count warning for answers < 10 words
- "How it works" interactive 4-step stepper section
- ATS score guide section (4 range cards: 0-40 red, 41-60 amber, 61-79 blue, 80-100 green)

## Planned Features

- Authentication (tie uploads/scores to user accounts)
- S3 + PostgreSQL (production-grade storage)
- Resume history (past uploads and scores per user)
- MCP integrations (auto-pull JD from URL, LinkedIn, GitHub)
- Chatbot (conversational AI assistant within the app)
- Voice recognition for interview answers (speak instead of type, Web Speech API or Whisper)
