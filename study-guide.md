# HireReady — Study Guide for Interviews

Full-stack AI resume copilot. Upload a resume, get an ATS score against a job description, see matched/missing skills, then practice tailored interview questions with AI coaching.

---

## Tech Stack

| Layer        | Technology            | Purpose                                                       |
| ------------ | --------------------- | ------------------------------------------------------------- |
| Frontend     | React + TypeScript    | UI, routing, state management                                 |
| Build tool   | Vite                  | Dev server + bundler                                          |
| Routing      | React Router v7       | Client-side navigation (Home, Interview, Profile)             |
| State        | React Context         | Persist resume/analysis state across pages                    |
| HTTP client  | axios                 | Frontend → backend requests                                   |
| Auth         | Supabase              | User accounts, JWT sessions, hosted PostgreSQL + file storage |
| Backend      | FastAPI (Python)      | API server, business logic                                    |
| Validation   | Pydantic              | Request/response type enforcement                             |
| PDF parser   | pdfplumber            | Extracts text from PDF files                                  |
| DOCX parser  | python-docx           | Extracts text from Word files                                 |
| Embeddings   | sentence-transformers | Local model — converts text → vectors                         |
| Vector store | ChromaDB              | Persists and searches resume chunk embeddings                 |
| LLM          | Groq (llama-3.3-70b)  | ATS scoring, question generation, feedback                    |

---

## Folder Structure

```
backend/app/
  api/
    routes.py              ← Wires all sub-routers together
    resume.py              ← /upload, /analyze, /history (GET+DELETE) endpoints
    interview.py           ← /questions and /feedback endpoints
    github_auth.py         ← GitHub OAuth connect/callback (origin-aware HMAC state)
  services/
    resume_service.py      ← Orchestrates: validate → parse → chunk → embed
    parser_service.py      ← Extracts text from PDF/DOCX, detects sections
    chunker_service.py     ← Splits text into overlapping 200-word windows
    embedder_service.py    ← Embeds chunks + stores/queries ChromaDB; delete_chunks()
    llm_service.py         ← Groq call for ATS scoring
    interview_service.py   ← Groq calls for question generation + feedback
    history_service.py     ← Supabase history: save (INSERT), fetch (grouped), delete
    jd_fetcher_service.py  ← Fetches JD from URL: direct HTTP first, Jina Reader fallback
    github_service.py      ← GitHub API calls (profile, repos)
  models/
    resume.py              ← Pydantic models for upload/analyze/history (ResumeFile, AnalysisEntry)
    interview.py           ← Pydantic models for questions/feedback

frontend/src/
  context/
    ResumeContext.tsx      ← Global state: parseResult, analyzeResult, jd
    AuthContext.tsx        ← Auth state: user, session, signIn, signUp, signOut
  lib/
    supabase.ts            ← Supabase client singleton (reads from .env)
  components/
    ResumeUpload.tsx       ← Upload widget + JD input + ATS results
    AuthGate.tsx           ← Sign-in/sign-up page shown at route /
    HowItWorks.tsx         ← Interactive 4-step tutorial section
    Logo.tsx               ← SVG logo component
  pages/
    InterviewPage.tsx      ← Behavioral + role-specific interview prep
    ProfilePage.tsx        ← Account info + sign out (sign-in form if guest)
    HistoryPage.tsx        ← Resume history: accordion by file, nested analyses, delete
  App.tsx                  ← Router, ResumeProvider keyed on user ID, nav, score guide

backend/app/core/
  config.py                ← Env vars (SUPABASE_URL, SUPABASE_ANON_KEY, GITHUB_CLIENT_*)
  supabase.py              ← Supabase client singleton
  auth.py                  ← FastAPI dependencies: get_current_user, require_user
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

An upload row is also INSERTed into `resume_history` (score=null) to anchor the `file_id` for history grouping.

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

**Why INSERT instead of UPDATE for history?**
Each analysis is a new row so users can score the same resume against multiple job descriptions and see all results in History. Updating in-place would overwrite the previous score.

**Why RAG instead of pasting the whole resume?**
The JD is embedded into a vector and compared against resume chunk vectors. Only the _most relevant_ parts of the resume go into the LLM prompt — lower cost, better focus, and it scales to long documents.

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

## End-to-End Flow 4: Resume History

```
User navigates to /history
        │
        ▼  GET /api/resume/history  (Authorization: Bearer <JWT>)
[history_service.get_user_history(user_id)]
  - Fetches all rows from resume_history for this user, ordered by uploaded_at asc
  - Groups by file_id in Python:
      upload rows (score=null)   → set filename + uploaded_at for the group
      analysis rows (score!=null) → append to analyses[] list
  - Returns list sorted newest-first; analyses within each file sorted newest-first
        │
        ▼
Frontend renders accordion:
  - One card per file_id with filename, upload date, latest score badge
  - Click to expand → all ATS analyses for that resume
  - Each analysis: score badge, date, "View summary" toggle, skill chips, "Prep interview"
  - Trash icon → inline confirmation → DELETE /api/resume/history/{file_id}
        │
        ▼  DELETE /api/resume/history/{file_id}
[history_service.delete_resume_record(user_id, file_id)]
  - Deletes all Supabase rows where user_id + file_id match
[embedder_service.delete_chunks(file_id)]
  - collection.get(where={"file_id": file_id}) → finds all chunk IDs
  - collection.delete(ids=...) → removes vectors
```

**Why delete ChromaDB chunks on history delete?** The file_id is orphaned once the Supabase rows are gone — vectors would accumulate forever. `delete_chunks` is in `embedder_service.py` so the architectural rule holds: one service owns one storage concern.

---

## End-to-End Flow 5: GitHub OAuth

```
User clicks "Connect GitHub" on home upload card
        │
        ▼  GET /api/github/connect  (Authorization: Bearer <JWT>)
[github_auth.py]
  - Reads Origin header from request (e.g. http://127.0.0.1:5173)
  - Validates against FRONTEND_URLS whitelist
  - payload = "{user_id}|{origin}"
  - state = base64(payload) + "." + HMAC-SHA256(payload)[:24]
  - Redirects browser to GitHub authorize URL with state param
        │
        ▼  User authorizes → GitHub redirects to:
        GET /api/github/callback?code=...&state=...
[github_auth.py]
  - Decodes base64, verifies HMAC signature
  - Extracts user_id + origin from payload
  - Exchanges code for GitHub access token
  - Saves token to Supabase
  - Redirects to {origin}/home?github=connected
```

**Why encode origin in state?** `localhost` and `127.0.0.1` are separate localStorage origins in browsers. If the callback hardcodes `localhost` but the user came from `127.0.0.1`, the Supabase session is invisible and they see a login page. Embedding the actual `Origin` header into the HMAC-signed state fixes this permanently.

---

## Supabase Schema

```sql
-- resume_history table (one row per upload OR per analysis)
file_id        text         -- UUID from upload
user_id        uuid         -- foreign key to auth.users
filename       text         -- original filename
score          int          -- null for upload rows; 0-100 for analysis rows
matched_skills jsonb        -- array of strings
missing_skills jsonb        -- array of strings
jd_snippet     text         -- first 300 chars of the pasted JD
summary        text         -- Groq-generated plain-English summary
uploaded_at    timestamptz
```

`get_user_history` groups these rows by `file_id` in Python — upload rows (score=null) anchor the card header, analysis rows become the nested `analyses` list. The frontend never sees blank cards.

---

## Embeddings: Local vs Cloud

An embedding is a list of numbers representing the _meaning_ of text. Two sentences with similar meaning → vectors that are close together, even if they share no words.

```
"5 years of Python experience"        → [0.12, -0.87, 0.34, ...]
"built Python microservices since 2019" → [0.13, -0.85, 0.31, ...]  ← close!
```

|             | Local (sentence-transformers)     | Cloud (OpenAI text-embedding-3-small) |
| ----------- | --------------------------------- | ------------------------------------- |
| Cost        | Free                              | ~$0.00002/1K tokens                   |
| Dimensions  | 384                               | 1536                                  |
| Privacy     | Data stays on server              | Data leaves your machine              |
| Setup       | Download once (~90MB)             | API key required                      |
| Swap effort | One line in `embedder_service.py` | One line in `embedder_service.py`     |

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

| Provider  | Model            | Cost        | Key needed? |
| --------- | ---------------- | ----------- | ----------- |
| **Groq**  | llama-3.3-70b    | Free tier   | Yes (free)  |
| OpenAI    | gpt-4o-mini      | ~$0.001/req | Yes (paid)  |
| Anthropic | claude-haiku-4-5 | ~$0.001/req | Yes (paid)  |
| Ollama    | llama3 (local)   | Free        | No          |

Groq is used now because it's free and fast. Switching to OpenAI or Anthropic for production is a single import change in `llm_service.py` and `interview_service.py` — nothing else in the codebase is aware of which provider is running.

**Note:** `llama3-8b-8192` was decommissioned by Groq mid-project. Always check `console.groq.com/docs/deprecations` if you get a 400 `model_decommissioned` error.

---

## Authentication Flow

Supabase is a hosted backend-as-a-service built on PostgreSQL. It provides auth, a relational database, and file storage — all from one service. For auth, it runs its own Auth server alongside your database.

```
User submits email + password on AuthGate (route /)
        │
        ▼  supabase.auth.signInWithPassword()
Supabase Auth server
  - Checks credentials against internal auth.users table
  - Returns a JWT (JSON Web Token) — a signed string encoding
    user ID, email, and expiry
  - Supabase JS client stores JWT in localStorage automatically
        │
        ▼
AuthContext.onAuthStateChange fires
  - Sets user + session in React state
  - axios.defaults.headers.common['Authorization'] = `Bearer <token>`
  - All future API calls now carry the token automatically
        │
        ▼
React Router sees user is non-null → redirects from / to /home
        │
        ▼  Any protected API call (e.g. POST /api/resume/upload)
FastAPI — get_current_user dependency (auth.py)
  - Extracts Bearer token from Authorization header
  - Calls supabase.auth.get_user(token) — Supabase verifies signature
  - Returns { id, email } if valid; raises 401 if forged/expired
```

**Why the JWT is safe to pass around:**
The token is cryptographically signed by Supabase using a secret key only they hold. Your backend never sees the user's password — only the signed token. If anyone tampers with it, the signature check fails and it's rejected.

**Session refresh:**
JWTs expire after 1 hour. The Supabase JS client silently refreshes them using a refresh token (also in localStorage). `onAuthStateChange` fires on each refresh and updates the axios header.

**Guest mode:**
"Continue without signing in" stores a `guestMode` flag in `sessionStorage`. The app treats this as authed for routing purposes. Signing out clears the flag and returns to the auth gate.

**Backend auth dependencies (auth.py):**

- `get_current_user` — optional auth. Returns user dict or `None`. Existing endpoints stay backward-compatible.
- `require_user` — throws 401 if no valid token. Used when an endpoint must be locked to signed-in users.

---

## Local Storage vs Supabase Storage

Files currently write to `backend/uploads/`. For production, Supabase replaces both S3 and a separate database:

- **Supabase Storage** = S3-compatible object store (same concept as AWS S3, built in)
- **Supabase PostgreSQL** = relational database (built in, same project)
- No separate AWS account needed

```
Supabase Storage bucket: resumes/<uuid>.pdf

Supabase PostgreSQL — files table:
  file_id | user_id  | storage_key              | uploaded_at
  uuid1   | user_abc | resumes/uuid1.pdf        | 2026-06-25
```

Storage is dumb — it has no concept of users. The association lives in the PostgreSQL table. You query the DB for the key, then fetch from Storage. The only code change: two lines in `resume_service.py`.

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

**"How does authentication work in this app?"**

> Authentication is handled by Supabase. On sign-in, Supabase's auth server verifies the credentials and returns a JWT. The Supabase JS client stores the JWT in localStorage and auto-refreshes it before expiry. Our AuthContext listens for auth state changes and sets the JWT as the default Authorization header on every axios request — so all API calls carry it automatically without any component needing to think about it. On the backend, a FastAPI dependency (`get_current_user` in `auth.py`) extracts the token and calls `supabase.auth.get_user()` to verify the signature. If the token is forged or expired, Supabase rejects it and we return a 401. The current endpoints support optional auth — they still work without a token — but `require_user` is available to lock down endpoints that must be tied to an account. When the user logs out, `ResumeProvider` is keyed on `user?.id ?? 'logged-out'` so it remounts with fresh empty state — the next login can't accidentally see the previous user's resume data.

**"How does the resume history work, and why INSERT instead of UPDATE?"**

> History is stored in a Supabase table called `resume_history`. There are two row types: upload rows (score=null, created on file upload) and analysis rows (score set, inserted on each ATS run). We INSERT new rows instead of updating because a user might analyze the same resume against five different job descriptions — UPDATE would silently overwrite every previous score. The `get_user_history` service groups rows by `file_id` in Python so the frontend sees one accordion card per resume with a nested list of all scores. Deleting a resume removes all Supabase rows for that file_id and calls `delete_chunks()` in `embedder_service.py` to clean up the ChromaDB vectors so they don't accumulate as orphans.

**"How does GitHub OAuth work and what was tricky about it?"**

> It's a standard three-leg OAuth flow — redirect to GitHub, get a code back, exchange for a token. The tricky part was the post-callback redirect. In development the frontend runs on both `localhost:5173` and `127.0.0.1:5173`, which browsers treat as completely separate localStorage origins. If you hardcode the redirect to `localhost` but the user came from `127.0.0.1`, the Supabase session is invisible after the redirect and they see a login page. The fix: read the `Origin` header from the `/connect` request, encode it with the user ID as `user_id|origin`, sign the payload with HMAC-SHA256 using the GitHub client secret, and pass it as the OAuth state parameter. The callback decodes and verifies it, then redirects to whichever origin is in the payload — so localhost and 127.0.0.1 both work correctly without any hardcoded URLs.

**"How would you scale this for real users?"**

> Files move from local disk to Supabase Storage (one line in `resume_service.py`). ChromaDB moves to Pinecone or Weaviate (one line in `embedder_service.py`). A Supabase PostgreSQL table maps file IDs to user accounts — the `file_id` already acts as the key across the entire pipeline, so adding a `user_id` foreign key is the main schema change. Groq swaps to OpenAI or Anthropic for production-grade SLAs (one line in the LLM services). Supabase's Row Level Security lets us enforce "users can only see their own rows" at the database level without any backend code change.

**"Why FastAPI over Flask or Django?"**

> FastAPI has async support out of the box — critical for LLM API calls that take several seconds. Pydantic handles request validation automatically (wrong shape → 422, no manual checks). Auto-generated OpenAPI docs at `/docs`. Django is overkill for an API-first backend; Flask requires wiring Pydantic and async manually.

**"What is CORS and why do you need it?"**

> CORS is a browser policy that blocks requests to a different origin than the page was loaded from. Frontend is on port 5173, backend on 8000 — different origins. FastAPI's `CORSMiddleware` adds `Access-Control-Allow-Origin` headers so the browser permits the cross-origin requests.

---

## What's Built

| Feature                                       | Where                                                             |
| --------------------------------------------- | ----------------------------------------------------------------- |
| Resume upload + validation                    | `POST /api/resume/upload`, `resume_service.py`                    |
| PDF/DOCX parsing + section detection          | `parser_service.py`                                               |
| Text chunking (overlapping windows)           | `chunker_service.py`                                              |
| Local embeddings + ChromaDB storage           | `embedder_service.py`                                             |
| ATS scoring via Groq                          | `POST /api/resume/analyze`, `llm_service.py`                      |
| Matched/missing skills + score ring           | `ResumeUpload.tsx`                                                |
| Resume history (accordion, nested analyses)   | `GET /api/resume/history`, `history_service.py`, `HistoryPage.tsx` |
| Delete resume from history + ChromaDB cleanup | `DELETE /api/resume/history/{file_id}`, `delete_chunks()`         |
| ATS summary saved + shown in history          | `summary` col in `resume_history`, `HistoryPage.tsx`              |
| Context-aware upload card header              | `App.tsx` `HomePage` reads `parseResult`/`analyzeResult`          |
| State reset on login/logout                   | `<ResumeProvider key={user?.id ?? 'logged-out'}>`                 |
| GitHub OAuth (origin-aware HMAC state)        | `github_auth.py`                                                  |
| JD URL fetch (direct HTTP + Jina fallback)    | `POST /api/resume/fetch-jd`, `jd_fetcher_service.py`             |
| Role-specific interview questions             | `POST /api/interview/questions`, `interview_service.py`           |
| Behavioral question bank (15 questions)       | `InterviewPage.tsx` (hardcoded)                                   |
| AI feedback on answers                        | `POST /api/interview/feedback`, `interview_service.py`            |
| All / One-by-one question views               | `InterviewPage.tsx`                                               |
| Cross-page state persistence                  | `ResumeContext.tsx`                                               |
| Nav + SVG logo + user avatar                  | `App.tsx`, `Logo.tsx`                                             |
| ATS score guide section                       | `App.tsx`                                                         |
| Auth gate (sign in / sign up / guest)         | `AuthGate.tsx`, route `/`                                         |
| Supabase JWT auth — frontend                  | `AuthContext.tsx`, `lib/supabase.ts`                              |
| Supabase JWT auth — backend                   | `core/auth.py`, `core/supabase.py`                                |
| Profile page (account info + sign out)        | `ProfilePage.tsx`, route `/profile`                               |

## What's Next

| Feature                       | Notes                                                   |
| ----------------------------- | ------------------------------------------------------- |
| Supabase Storage + PostgreSQL | Move files off local disk; tie uploads to user accounts |
| MCP integrations              | LinkedIn JD fetch, deeper GitHub profile integration    |
| Chatbot                       | Conversational AI assistant within the app              |
| Voice recognition             | Speak interview answers (Web Speech API or Whisper)     |
