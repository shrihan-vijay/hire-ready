<p align="center">
  <img src="hire-ready-logo.png" width="96" alt="HireReady logo" />
</p>

<h1 align="center">HireReady</h1>

<p align="center">
  An AI Resume &amp; Interview Copilot — tailor your resume to any job description and prepare smarter interview answers.
</p>

<p align="center">
  <a href="https://hire-ready-sable-pi.vercel.app"><strong>Try it live →</strong></a>
</p>

## What it does

- **ATS resume scoring** — upload a resume, paste or fetch a job description, get a match score, matched/missing skills, and qualification gaps
- **Job Ranker** — paste 2–5 job listing URLs and rank them all by fit against your resume, in parallel
- **Job Recon** — a 3-agent pipeline (Researcher → Resume Optimizer → Interview Strategist) that researches a company and rewrites your resume bullets for a specific role
- **Mock Interview** — an adaptive, agent-driven mock interview with follow-up questions and a scored debrief
- **Question Bank** — behavioral and role-specific interview questions with voice recording and AI feedback
- **Application Tracker** — a kanban board (Saved/Applied/Interviewing/Offer/Rejected) for jobs you're pursuing
- **Chatbot** — a floating assistant with RAG context over your resume and the job description
- **GitHub enrichment** — optionally connect GitHub so scoring factors in your public profile/repos

## Stack

**Frontend:** React + TypeScript, Vite, React Router v7, React Context, axios

**Backend:** FastAPI, pdfplumber/python-docx for parsing, sentence-transformers + ChromaDB for embeddings/RAG, Groq (`llama-3.3-70b-versatile` + Whisper) for LLM features, Supabase for auth/storage/data, LangGraph for the Job Recon pipeline, GitHub MCP server for profile enrichment

See `CLAUDE.md` for the full architecture, folder structure, and API reference.

## Running locally

One command starts both servers:

```bash
./dev.sh
```

- Backend: `http://localhost:8000` (health check at `/api/health`)
- Frontend: `http://localhost:5173`

Or run them standalone:

```bash
cd backend && ./dev.sh      # backend only
cd frontend && npm run dev  # frontend only
```

Backend config lives in `backend/.env` (gitignored); frontend reads `VITE_API_BASE_URL` (defaults to `http://localhost:8000`). See `frontend/.env.example` for required Supabase vars.
