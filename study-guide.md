# HireReady — Study Guide for Interviews

Full-stack AI resume copilot. Upload a resume, get an ATS score against a job description, see matched/missing skills, then practice tailored interview questions with AI coaching.

---

## Tech Stack

| Layer          | Technology              | Purpose                                       |
|----------------|-------------------------|-----------------------------------------------|
| Frontend       | React + TypeScript      | UI, routing, state management                 |
| Build tool     | Vite                    | Dev server + bundler                          |
| Routing        | React Router v7         | Client-side navigation (Home, Interview, Profile) |
| State          | React Context           | Persist resume/analysis state across pages    |
| HTTP client    | axios                   | Frontend → backend requests                   |
| Backend        | FastAPI (Python)        | API server, business logic                    |
| Validation     | Pydantic                | Request/response type enforcement             |
| PDF parser     | pdfplumber              | Extracts text from PDF files                  |
| DOCX parser    | python-docx             | Extracts text from Word files                 |
| Embeddings     | sentence-transformers   | Local model — converts text → vectors         |
| Vector store   | ChromaDB                | Persists and searches resume chunk embeddings |
| LLM            | Groq (llama-3.3-70b)    | ATS scoring, question generation, feedback    |

---

## Folder Structure

```
backend/app/
  api/
    routes.py           ← Wires all sub-routers together
    resume.py           ← /upload and /analyze endpoints
    interview.py        ← /questions and /feedback endpoints
  services/
    resume_service.py   ← Orchestrates: validate → parse → chunk → embed
    parser_service.py   ← Extracts text from PDF/DOCX, detects sections
    chunker_service.py  ← Splits text into overlapping 200-word windows
    embedder_service.py ← Embeds chunks + stores/queries ChromaDB
    llm_service.py      ← Groq call for ATS scoring
    interview_service.py← Groq calls for question generation + feedback
  models/
    resume.py           ← Pydantic models for upload/analyze
    interview.py        ← Pydantic models for questions/feedback

frontend/src/
  context/
    ResumeContext.tsx   ← Global state: parseResult, analyzeResult, jd
  components/
    ResumeUpload.tsx    ← Upload widget + JD input + ATS results
    HowItWorks.tsx      ← Interactive 4-step tutorial section
    Logo.tsx            ← SVG logo component
  pages/
    InterviewPage.tsx   ← Behavioral + role-specific interview prep
    ProfilePage.tsx     ← Placeholder (auth coming)
  App.tsx               ← Router, nav tabs, score guide section
```

**The key rule:** route handlers are thin — they receive the request, call a service, return the response. All logic lives in services. Swap S3 for local disk → change only `resume_service.py`. Swap Pinecone for ChromaDB → change only `embedder_service.py`. Swap OpenAI for Groq → change only `llm_service.py`.

---

## End-to-End Flow 1: Resume Upload

```
User drops PDF/DOCX → clicks "Upload & Analyze"
        │
        ▼  POST /api/resume/upload (multipart/form-data)
[resume_service.py]
  1. Validate content type — PDF or DOCX only (400 if not)
  2. Read all bytes, enforce 5 MB limit (400 if over)
  3. Generate UUID filename → write to backend/uploads/
        │
        ▼
[parser_service.py]
  4. pdfplumber (PDF) or python-docx (DOCX) → plain text
  5. Regex scan each line for section keywords → detected sections list
  6. Save text to backend/uploads/<uuid>.txt
        │
        ▼
[chunker_service.py]
  7. Split text into 200-word overlapping windows (40-word overlap)
     Why overlap? A sentence crossing a boundary appears in both chunks
     so it's never missed during retrieval
        │
        ▼
[embedder_service.py]
  8. all-MiniLM-L6-v2 (local, ~90MB) encodes each chunk → 384-dim vector
  9. Store in ChromaDB: { text, vector, file_id, chunk_index }
        │
        ▼
Return { file_id, filename, word_count, sections } → frontend
```

**Frontend** saves the response into `ResumeContext` — a React Context mounted above the router. Navigating to Interview Prep and back doesn't lose the data because the context lives outside the page components.

---

## End-to-End Flow 2: ATS Analysis

```
User pastes job description → clicks "Analyze Match"
        │
        ▼  POST /api/resume/analyze  { file_id, job_description }
[embedder_service.query_resume()]
  - Embed the JD using the same all-MiniLM-L6-v2 model
  - ChromaDB cosine similarity search, filtered to this file_id
  - Returns top-k most semantically similar resume chunks
        │
        ▼
[llm_service.analyze_resume(chunks, job_description)]
  - Sends chunks + JD to Groq (llama-3.3-70b-versatile)
  - Prompt asks for JSON: { score, matched_skills, missing_skills, summary }
  - LLM reasons over the resume content vs JD requirements
        │
        ▼
Return AnalyzeResponse → frontend shows:
  - Animated score ring (color: green ≥70, amber ≥45, red <45)
  - Matched skills (green badges)
  - Missing skills (red badges)
  - Plain-English summary
  - "What does this mean?" link → score guide section
  - "Prep for this interview" button → Interview Prep page
```

**Why RAG instead of pasting the whole resume?**
The JD is embedded into a vector and compared against resume chunk vectors. Only the *most relevant* parts of the resume go into the LLM prompt — lower cost, better focus, and it scales to long documents.

---

## End-to-End Flow 3: Interview Prep

Two modes. One always works without a JD, one is personalised.

### Behavioral Practice
Questions are **hardcoded on the frontend** — 15 questions across 5 categories (Self, Conflict, Leadership, Growth, Motivation). No API call, instant load. User expands a question, types an answer, requests AI feedback.

### Role-Specific
```
User clicks "Prep for this interview" after ATS analysis
        │  (React Router passes { file_id, job_description } as state)
        ▼  POST /api/interview/questions  { file_id, job_description }
[embedder_service.query_resume(file_id, job_description)]
  - Same ChromaDB lookup — pulls resume chunks most relevant to the JD
        │
        ▼
[interview_service.generate_questions(chunks, job_description)]
  - Sends chunks + JD to Groq
  - Prompt requests 8 questions: 4 behavioral (role/culture tailored)
    + 4 technical (referencing specific tools/skills from JD)
  - Returns JSON array of { question, category, hint }
        │
        ▼
Frontend renders question cards (All view or One-by-one view)
```

### AI Feedback on Answers
```
User types answer → clicks "Get AI Feedback"
        │
        ▼  POST /api/interview/feedback  { question, user_answer, file_id }
[embedder_service.query_resume(file_id, question)]
  - Embeds the question to find relevant resume chunks
        │
        ▼
[interview_service.get_feedback(question, answer, chunks)]
  - Prompt to Groq is strict: if answer < 15 words or a non-answer
    ("don't know"), respond with one direct sentence — no hollow praise
  - For real answers: evaluate STAR structure, specificity, measurable
    outcomes; reference specific resume experiences the candidate missed
        │
        ▼
Feedback displayed below the textarea
```

---

## Embeddings: Local vs Cloud

An embedding is a list of numbers representing the *meaning* of text. Two sentences with similar meaning → vectors that are close together, even if they share no words.

```
"5 years of Python experience"        → [0.12, -0.87, 0.34, ...]
"built Python microservices since 2019" → [0.13, -0.85, 0.31, ...]  ← close!
```

| | Local (sentence-transformers) | Cloud (OpenAI text-embedding-3-small) |
|---|---|---|
| Cost | Free | ~$0.00002/1K tokens |
| Dimensions | 384 | 1536 |
| Privacy | Data stays on server | Data leaves your machine |
| Setup | Download once (~90MB) | API key required |
| Swap effort | One line in `embedder_service.py` | One line in `embedder_service.py` |

---

## ChromaDB

Stores vectors so they can be searched later. Lives at `backend/chroma_db/` — SQLite-backed, persists across restarts.

Each chunk stored as:
- `id`: `{file_id}_{chunk_index}`
- `document`: raw text
- `embedding`: 384 floats
- `metadata`: `{ file_id, filename, chunk_index }`

The `where={"file_id": file_id}` filter in every query ensures you only search the current user's resume — not everyone's. Similarity is measured by **cosine similarity** (angle between vectors — smaller angle = more similar meaning).

---

## Groq vs Other LLM Options

| Provider   | Model               | Cost        | Key needed? |
|------------|---------------------|-------------|-------------|
| **Groq**   | llama-3.3-70b       | Free tier   | Yes (free)  |
| OpenAI     | gpt-4o-mini         | ~$0.001/req | Yes (paid)  |
| Anthropic  | claude-haiku-4-5    | ~$0.001/req | Yes (paid)  |
| Ollama     | llama3 (local)      | Free        | No          |

Groq is used now because it's free and fast. Switching to OpenAI or Anthropic for production is a single import change in `llm_service.py` and `interview_service.py` — nothing else in the codebase is aware of which provider is running.

**Note:** `llama3-8b-8192` was decommissioned by Groq mid-project. Always check `console.groq.com/docs/deprecations` if you get a 400 `model_decommissioned` error.

---

## Local Storage vs S3

Files currently write to `backend/uploads/`. For production:

- **Never** one S3 bucket per user (AWS has soft limits, and it's an antipattern)
- **One bucket + a database table:**

```
s3://hire-ready-uploads/resumes/<uuid>.pdf

PostgreSQL — files table:
  file_id | user_id  | s3_key                   | uploaded_at
  uuid1   | user_abc | resumes/uuid1.pdf        | 2026-06-19
```

S3 is dumb storage — it has no concept of users. The association lives in the relational DB. You query the DB for the key, then fetch from S3. The only code change: two lines in `resume_service.py`.

---

## Interview Talking Points

**"Walk me through a user request end to end."**
> The user uploads a PDF. React sends it as multipart/form-data to `POST /api/resume/upload`. The service layer validates type and size, saves with a UUID filename, extracts text using pdfplumber, splits into 200-word overlapping chunks, embeds each chunk with a local sentence-transformers model, and stores the vectors in ChromaDB tagged with a file_id. When the user pastes a job description, we embed that too, query ChromaDB for the most semantically similar resume chunks, and send them to Groq to produce an ATS score and gap analysis. The same file_id and JD then flow to the interview prep page, where Groq generates role-specific questions grounded in both the resume and the JD.

**"What is RAG and why does this project use it?"**
> RAG is Retrieval-Augmented Generation — instead of sending a full document to the LLM every time, you index it once as vectors and retrieve only the relevant parts at query time. Here, the resume is chunked and embedded on upload. At analysis time, the job description is embedded and the closest resume chunks are retrieved via cosine similarity. Only those chunks go into the Groq prompt. This keeps costs low, avoids context window limits, and lets the LLM focus on the most relevant content.

**"Why local embeddings instead of OpenAI?"**
> Local embeddings with sentence-transformers cost nothing and keep user data on the server. The model downloads once (~90 MB) and runs in-process as a lazy singleton. Quality is very good for semantic similarity on short resume chunks. Switching to OpenAI's text-embedding-3-small in production is one line in `embedder_service.py` — nothing else in the codebase knows which model produced the vectors.

**"How does state persist when the user navigates between pages?"**
> React Router unmounts page components on navigation, which normally destroys local state. We store the persistent data — parse result, ATS analysis, job description — in a React Context (`ResumeContext`) mounted above the router in the component tree. Context survives navigation because it's never unmounted. Ephemeral state like drag/drop and error messages stays local to the component since it doesn't need to persist.

**"How would you scale this for real users?"**
> Files move from local disk to S3 (one line in `resume_service.py`). ChromaDB moves to Pinecone or Weaviate (one line in `embedder_service.py`). A PostgreSQL table maps file IDs and vector collection IDs to user accounts. Groq swaps to OpenAI or Anthropic (one line in the LLM services). Authentication ties everything to a user — the `file_id` already acts as the key across the entire pipeline, so adding a user_id foreign key is the main schema change.

**"Why FastAPI over Flask or Django?"**
> FastAPI has async support out of the box — critical for LLM API calls that take several seconds. Pydantic handles request validation automatically (wrong shape → 422, no manual checks). Auto-generated OpenAPI docs at `/docs`. Django is overkill for an API-first backend; Flask requires wiring Pydantic and async manually.

**"What is CORS and why do you need it?"**
> CORS is a browser policy that blocks requests to a different origin than the page was loaded from. Frontend is on port 5173, backend on 8000 — different origins. FastAPI's `CORSMiddleware` adds `Access-Control-Allow-Origin` headers so the browser permits the cross-origin requests.

---

## What's Built

| Feature | Where |
|---|---|
| Resume upload + validation | `POST /api/resume/upload`, `resume_service.py` |
| PDF/DOCX parsing + section detection | `parser_service.py` |
| Text chunking (overlapping windows) | `chunker_service.py` |
| Local embeddings + ChromaDB storage | `embedder_service.py` |
| ATS scoring via Groq | `POST /api/resume/analyze`, `llm_service.py` |
| Matched/missing skills + score ring | `ResumeUpload.tsx` |
| Role-specific interview questions | `POST /api/interview/questions`, `interview_service.py` |
| Behavioral question bank (15 questions) | `InterviewPage.tsx` (hardcoded) |
| AI feedback on answers | `POST /api/interview/feedback`, `interview_service.py` |
| All / One-by-one question views | `InterviewPage.tsx` |
| Cross-page state persistence | `ResumeContext.tsx` |
| Nav tabs + SVG logo | `App.tsx`, `Logo.tsx` |
| ATS score guide section | `App.tsx` |

## What's Next

| Feature | Notes |
|---|---|
| Authentication | Tie uploads and scores to user accounts |
| S3 + PostgreSQL | Production-grade storage |
| MCP integrations | Web fetch (auto-pull JD from URL), GitHub, LinkedIn |
| Resume history | List of past uploads and scores per user |
