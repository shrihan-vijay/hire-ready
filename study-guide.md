# HireReady — Study Guide for Interviews

This document explains the application end-to-end: what it does, how it's
built, how RAG fits in, and how every piece connects. Updated as features
are built.

---

## What is HireReady?

HireReady is a full-stack AI tool that helps job seekers in four steps:

1. **Upload a resume** (PDF or DOCX)
2. **Get an ATS score** — how well the resume matches a job description
3. **See the gap** — which keywords and skills are missing
4. **Ace the interview** — AI-generated Q&A tailored to the role

The AI layer uses a technique called **RAG (Retrieval-Augmented Generation)**,
explained in detail below.

---

## The Tech Stack

| Layer          | Technology                    | Purpose                                          |
|----------------|-------------------------------|--------------------------------------------------|
| Frontend       | React + TypeScript            | User interface                                   |
| Build tool     | Vite                          | Fast dev server + bundler                        |
| HTTP client    | axios                         | Frontend → backend requests                      |
| Icons          | lucide-react                  | Consistent icon set                              |
| Backend        | FastAPI (Python)              | API server, business logic, file handling        |
| Validation     | Pydantic                      | Request/response type enforcement                |
| File uploads   | python-multipart              | Parses multipart/form-data in FastAPI            |
| PDF parser     | pdfplumber                    | Extracts text from PDF files                     |
| DOCX parser    | python-docx                   | Extracts text from Word files                    |
| Embeddings     | sentence-transformers         | Local model that converts text → vectors         |
| Vector store   | ChromaDB                      | Persists and searches resume chunk embeddings    |
| LLM (next)     | Groq (llama3 / mixtral)       | ATS scoring and interview coaching               |

---

## How the Frontend and Backend Connect

```
Browser (React + Vite)           http://127.0.0.1:5173
         │
         │  HTTP requests (axios)
         │
FastAPI backend (uvicorn)        http://127.0.0.1:8000
         │
         ├── GET  /api/health            → health check
         └── POST /api/resume/upload     → upload, parse, chunk, embed
```

They are two separate processes. The frontend talks to the backend over
HTTP. **CORS** (Cross-Origin Resource Sharing) is configured in FastAPI
to allow requests from the frontend's origin (`127.0.0.1:5173` and `5174`).

**Why separate processes?**
In production the frontend becomes static files on a CDN (Vercel,
Cloudflare). The backend runs on a server (Railway, AWS). They talk over
HTTPS. Keeping them separate from day one mirrors that setup exactly.

---

## Folder Structure and Why It's Organised This Way

```
backend/
  app/
    api/
      routes.py              ← Router that wires all sub-routers together
      resume.py              ← Resume route handlers (thin — no logic)
    services/
      resume_service.py      ← Orchestrates: validate → parse → chunk → embed
      parser_service.py      ← Extracts text from PDF/DOCX, detects sections
      chunker_service.py     ← Splits text into overlapping word windows
      embedder_service.py    ← Embeds chunks + stores/queries ChromaDB
    models/
      resume.py              ← Pydantic request/response models
    core/
      config.py              ← Env vars (APP_NAME, FRONTEND_URL, etc.)
    main.py                  ← FastAPI app + CORS middleware

frontend/
  src/
    components/
      ResumeUpload.tsx       ← Drag-and-drop upload widget
      HowItWorks.tsx         ← Interactive four-step tutorial section
    App.tsx                  ← Root layout: nav + hero + upload card
```

**Routes are kept thin.** A route handler receives the request, calls a
service, returns the response. It never contains business logic.

**Services contain the logic.** If we later swap local disk for S3, only
`resume_service.py` changes — the route is untouched. If we swap ChromaDB
for Pinecone, only `embedder_service.py` changes.

**Pydantic models enforce types.** FastAPI uses Pydantic to auto-validate
every incoming request. Wrong shape → 422 error automatically, no manual
checks needed.

---

## Current Feature: Resume Upload + Parse + Embed

### End-to-end flow

```
User uploads PDF / DOCX
        │
        ▼
[resume_service.py]
  1. Validate content type (PDF or DOCX only → 400 if not)
  2. Read all bytes, check size (max 5 MB → 400 if over)
  3. Generate UUID filename → write file to backend/uploads/
        │
        ▼
[parser_service.py]
  4. Extract plain text (pdfplumber for PDF, python-docx for DOCX)
  5. Detect sections (regex keyword scan: Experience, Skills, Education…)
  6. Save extracted text as backend/uploads/<uuid>.txt
        │
        ▼
[chunker_service.py]
  7. Split text into overlapping 200-word chunks (40-word overlap)
        │
        ▼
[embedder_service.py]
  8. Encode each chunk → vector using all-MiniLM-L6-v2 (local model)
  9. Store vectors + text + metadata in ChromaDB (persists to backend/chroma_db/)
        │
        ▼
Return { filename, size, word_count, chunk_count, sections }
        │
        ▼
Frontend shows success card: filename, word count, detected section badges
```

### Why UUID filenames?

If two users both upload `resume.pdf`, the second would overwrite the first.
UUID generates a unique 128-bit identifier for every upload, making
collisions statistically impossible.

### Validation is done twice — why?

| Layer    | Why validate here?                                      |
|----------|---------------------------------------------------------|
| Frontend | Instant feedback — user sees the error before uploading |
| Backend  | Security — frontend checks can be bypassed with curl    |

Never trust the client. The backend always re-validates.

### How section detection works

`parser_service.detect_sections()` splits the extracted text into lines,
lowercases them, and checks each line against a keyword dictionary:

```python
_SECTIONS = {
    "Experience": ["experience", "work experience", "employment history"],
    "Skills":     ["skills", "technical skills", "core competencies"],
    "Education":  ["education", "academic background"],
    ...
}
```

If any line contains a section keyword as a whole word (regex `\b` boundary),
that section is added to the result. This is purely regex — no LLM needed.

---

## Chunking: Why and How

### The problem

An embedding model has a maximum input length (typically 256–512 tokens).
A full resume is often longer. We also want fine-grained retrieval — not
"the entire resume matches", but "this specific paragraph about Python is
the most relevant to the JD".

### The solution: overlapping word windows

```
words:  [0 ──────── 199] [160 ─────── 359] [320 ─────── 519] ...
           chunk 1            chunk 2            chunk 3
```

- `chunk_size = 200` words
- `overlap = 40` words (the last 40 words of chunk N are the first 40 of chunk N+1)

**Why overlap?** A sentence that crosses the boundary between two chunks
gets represented in both. Without overlap, it would fall through the cracks
and never be retrieved.

**How many chunks for a typical resume?**

| Resume length | Approx chunks |
|---------------|---------------|
| 500 words (1 page short) | 3–4 chunks |
| 800 words (1 page full)  | 5–6 chunks |
| 1,300 words (2 pages)    | 8–9 chunks |

---

## Embeddings: Local vs Cloud API

This is one of the most important architectural decisions in the project.

### What is an embedding?

An embedding is a list of floating-point numbers (a vector) that represents
the *meaning* of a piece of text. Two sentences that mean the same thing
produce vectors that are close together in mathematical space, even if they
share no words in common.

Example:
```
"5 years of Python experience"   → [0.12, -0.87, 0.34, ...]  ← 384 numbers
"built Python microservices since 2019" → [0.13, -0.85, 0.31, ...]  ← close!
```

### Local embeddings (what we use now)

We use `sentence-transformers` with the model `all-MiniLM-L6-v2`:

```python
from sentence_transformers import SentenceTransformer
model = SentenceTransformer("all-MiniLM-L6-v2")
vector = model.encode("some text")  # → numpy array of 384 floats
```

| Property     | Detail                                              |
|--------------|-----------------------------------------------------|
| Model size   | ~90 MB (downloaded once from HuggingFace, cached)  |
| Dimensions   | 384                                                 |
| Cost         | Free — runs on your CPU/GPU                        |
| Speed        | Fast for short texts (resumes)                     |
| Quality      | Very good for semantic similarity tasks            |

**The first upload is slow** because the model downloads from HuggingFace.
Every upload after that is fast because the model is cached in memory
(lazy singleton pattern — loaded once on first request, reused forever).

### Cloud embeddings (OpenAI, future option)

```python
from openai import OpenAI
client = OpenAI()
response = client.embeddings.create(model="text-embedding-3-small", input="some text")
vector = response.data[0].embedding  # → list of 1536 floats
```

| Property     | Detail                                              |
|--------------|-----------------------------------------------------|
| Dimensions   | 1536 (more expressive than 384)                    |
| Cost         | ~$0.00002 per 1K tokens (~free at our scale)       |
| Quality      | Slightly better on complex reasoning tasks         |
| Requirement  | Needs `OPENAI_API_KEY` environment variable        |
| Tradeoff     | Data leaves your server (privacy consideration)    |

### Which to use when?

| Situation                        | Use                    |
|----------------------------------|------------------------|
| Development / no budget          | Local (sentence-transformers) |
| Production with budget           | OpenAI `text-embedding-3-small` |
| Privacy-sensitive data           | Local always           |
| High volume (millions of docs)   | OpenAI (faster at scale) |

**Swapping is one line** — both return the same shape (a list of floats).
Only `embedder_service.py` changes. Nothing else in the codebase is aware
of which model produced the vectors.

---

## ChromaDB: The Vector Store

ChromaDB is the database that stores the embedded chunks so they can be
searched later.

### Where data lives

```
backend/chroma_db/          ← SQLite-backed directory, persists across restarts
  chroma.sqlite3            ← index + metadata
  <uuid>/                   ← binary vector data
```

### How chunks are stored

Each chunk is stored with:
- **document**: the raw text of the chunk
- **embedding**: the vector (list of 384 floats)
- **id**: `{file_id}_{chunk_index}` (e.g. `a3f1b2c4_0`, `a3f1b2c4_1`)
- **metadata**: `{ file_id, filename, chunk_index }` — used to filter by resume

### How retrieval works

```python
def query_resume(file_id: str, query: str, n_results: int = 5) -> list[str]:
    query_embedding = model.encode([query])          # embed the job description
    results = collection.query(
        query_embeddings=query_embedding,
        n_results=n_results,
        where={"file_id": file_id},                  # only this user's resume
    )
    return results["documents"][0]                   # top-k most similar chunks
```

ChromaDB uses **cosine similarity** — the angle between two vectors — to
rank chunks. The smaller the angle, the more semantically similar the texts.

### Why ChromaDB over alternatives?

| Option       | What it is                | Good for                         |
|--------------|---------------------------|----------------------------------|
| **ChromaDB** | Local, embedded, zero-infra | Development, small scale       |
| Pinecone     | Managed cloud vector DB   | Production, high scale           |
| Weaviate     | Self-hosted open source   | Production, you control the server|
| pgvector     | Postgres extension        | Already using PostgreSQL         |

ChromaDB requires no server, no API key, no Docker. Perfect for development.
Switching to Pinecone in production means only changing `embedder_service.py`.

---

## LLM Options for ATS Scoring

The RAG retrieval pipeline is complete. The missing piece is the LLM that
takes the retrieved chunks + job description and generates a score.

### What options exist?

| Provider     | Model              | Cost           | API Key?    | Quality    |
|--------------|--------------------|----------------|-------------|------------|
| **Groq**     | llama3-8b, mixtral | Free tier      | Yes (free)  | Very good  |
| OpenAI       | gpt-4o-mini        | ~$0.001/req    | Yes (paid)  | Excellent  |
| Anthropic    | claude-haiku-4-5   | ~$0.001/req    | Yes (paid)  | Excellent  |
| Ollama       | llama3, mistral    | Free (local)   | No          | Good       |

### Why Groq for now?

Groq provides free API access to open-source models (llama3, mixtral) with
very fast inference. Sign up at console.groq.com — no credit card needed.
The free tier is more than enough for development.

**The key design principle:** the LLM call lives in its own service
(`llm_service.py`). Switching from Groq to OpenAI means changing one
import and one line. Nothing else in the codebase knows which LLM is running.

### Why not Ollama?

Ollama runs the model entirely on your machine (no API key, completely free,
private). The tradeoff: it requires 4–8 GB of RAM just for the model, makes
your laptop fan spin, and is slower. Groq is faster and easier for
development.

---

## Local Storage vs AWS S3

Currently uploaded files are saved to `backend/uploads/` on disk. For a
production app with real users, we'd move to S3.

### What S3 is

AWS S3 (Simple Storage Service) is object storage — a place to store files
that is separate from your server. Files are accessed via URLs, not file paths.

### Why not just keep local disk?

| Problem with local disk            | S3 solution                         |
|------------------------------------|-------------------------------------|
| Files lost if server restarts      | Persists independently of servers   |
| Can't share files across servers   | Any server can access any file      |
| Disk space is finite               | Essentially unlimited               |
| No CDN or access control built-in  | S3 has both                        |

### How S3 organises files — NOT one bucket per user

A common misconception: you do not create one S3 bucket per user.
AWS has limits (~1000 buckets per account) and it's an anti-pattern.

**Instead: one bucket, with a prefix (folder) structure:**

```
s3://hire-ready-uploads/
  users/
    user_abc123/
      resumes/
        uuid1.pdf
        uuid1.txt
    user_def456/
      resumes/
        uuid2.pdf
```

Or more commonly, **a flat structure + a database table** that maps files
to users:

```
s3://hire-ready-uploads/
  resumes/
    uuid1.pdf
    uuid2.pdf

PostgreSQL table — files:
  id         | user_id    | s3_key              | uploaded_at
  uuid1      | user_abc   | resumes/uuid1.pdf   | 2026-06-19
  uuid2      | user_def   | resumes/uuid2.pdf   | 2026-06-19
```

S3 is just dumb storage — it doesn't know about users. The user-to-file
association lives in a **relational database**. You query the DB to get
the S3 key, then fetch the file from S3 using that key.

### What happens to ChromaDB (vectors)?

ChromaDB lives on the filesystem. In production you'd replace it with a
managed vector database (Pinecone, Weaviate) that runs independently of
your server, the same way you'd replace local file storage with S3. The
code change is isolated to `embedder_service.py`.

### Switching from local disk to S3 — where does the code change?

**Only `resume_service.py`** — specifically the line that writes the file:

```python
# Local (current):
with open(filepath, "wb") as f:
    f.write(content)

# S3 (future):
s3_client.put_object(Bucket="hire-ready-uploads", Key=f"resumes/{saved_filename}", Body=content)
```

The route handler (`resume.py`), models, chunker, and embedder are all
completely unaware of where the raw file is stored. That's why the service
layer pattern matters.

---

## The UI

### Layout

```
┌─────────────────────────────────────────────────────┐
│  HR HireReady                              ● (dot)  │  ← sticky frosted nav
├─────────────────────────────────────────────────────┤
│                          │                          │
│  Powered by AI           │  Upload your resume      │
│  Land your dream job     │  ┌────────────────────┐  │
│  faster.                 │  │  drag-drop zone    │  │
│                          │  └────────────────────┘  │
│  [Resume Parser]         │  [Upload Resume btn]     │
│  [ATS Scoring]           │                          │
│  [JD Matching]           │                          │
│  [Interview Prep]        │                          │
│                          │                          │
├─────────────────────────────────────────────────────┤
│  HOW IT WORKS — interactive four-step tutorial      │
└─────────────────────────────────────────────────────┘
```

### Visual techniques used

| Technique        | Where used                                | Why                          |
|------------------|-------------------------------------------|------------------------------|
| Frosted glass    | Navbar, upload card, how-it-works card    | Depth without heavy shadows  |
| Blob gradients   | Full-page background (fixed position)     | Colour without noise         |
| Gradient text    | "dream job" in hero headline              | Modern emphasis              |
| CSS keyframes    | Score ring, bar fills, slide transitions  | Feels alive and responsive   |
| `requestAnimationFrame` | Score counter (0 → 78)           | Smooth 60fps number count-up |
| Backdrop filter  | Nav + cards                               | Glassmorphism effect         |

---

## What is RAG? (And How It's Used Here)

RAG stands for **Retrieval-Augmented Generation**. It grounds AI answers
in specific documents instead of relying on general training data.

### The Problem RAG Solves

A plain LLM (like GPT-4) can discuss resumes in general, but it hasn't
seen *your* resume. You could paste the whole resume into every prompt —
but resumes can be long, and LLMs have context limits and cost per token.

### The RAG Solution

**Phase 1 — Indexing (runs once when you upload) ← BUILT**

```
Resume text
    │
parser_service     → extracts text from PDF/DOCX, detects sections
    │
chunker_service    → splits into 200-word overlapping chunks
    │
embedder_service   → converts each chunk → vector (all-MiniLM-L6-v2)
    │
ChromaDB           → stores vectors + text, persists to backend/chroma_db/
```

**Phase 2 — Retrieval + Generation (runs when user submits JD) ← NEXT**

```
Job description (pasted by user)
    │
embedder_service   → embed JD into a vector using same model
    │
ChromaDB           → cosine similarity search → top-k most relevant chunks
    │
llm_service        → prompt: "Here are resume sections: [chunks]
                              Here is the job description: [JD]
                              Score the match and list what's missing."
    │
Groq / LLM         → ATS score + improvement suggestions
    │
Frontend           → displays score, matched skills, gaps
```

### Why is this better than pasting the whole resume?

- Scales to very long documents
- Only the *relevant* parts go into the prompt → lower cost, better focus
- The vector DB can search across multiple resumes efficiently

---

## Interview Talking Points

**"Walk me through a user request end to end."**

> The user uploads a PDF. React sends it as multipart/form-data to
> `POST /api/resume/upload`. FastAPI receives it as an `UploadFile`,
> the service layer validates content type and size, saves it with a
> UUID filename to disk, then passes it to `parser_service` which uses
> pdfplumber to extract text and regex to detect resume sections.
> The text goes to `chunker_service` which splits it into 200-word
> overlapping windows. Each chunk goes to `embedder_service` which runs
> it through `all-MiniLM-L6-v2` (a local sentence-transformers model)
> and stores the resulting vectors in ChromaDB. The frontend shows a
> success card with the detected sections. When the user later pastes a
> job description, we embed that too, retrieve the most semantically
> similar resume chunks via cosine similarity, and send them to an LLM
> to produce an ATS score and gap analysis.

**"Why local embeddings instead of OpenAI?"**

> Local embeddings with `sentence-transformers` cost nothing and keep
> user data on the server — no data leaves the machine. The `all-MiniLM-L6-v2`
> model downloads once (~90 MB) and runs in-process. The quality is very
> good for semantic similarity on short texts like resume chunks. When we
> move to production and have budget, switching to OpenAI's
> `text-embedding-3-small` is a one-line change in `embedder_service.py`
> — nothing else in the codebase knows which model produced the vectors.

**"What is ChromaDB and why use it over a plain database?"**

> ChromaDB is a vector database — optimised specifically for storing and
> searching high-dimensional vectors by cosine similarity. A plain SQL
> database like PostgreSQL stores rows and does exact lookups. ChromaDB
> stores vectors and finds the nearest neighbours in embedding space, which
> is how you do semantic search. For production we'd swap it for Pinecone
> or Weaviate — again a one-line change in `embedder_service.py`.

**"How would you scale file storage for real users?"**

> Right now files save to local disk. In production we'd use S3 — one bucket,
> with a database table (PostgreSQL) mapping each file's S3 key to the user
> who owns it. S3 is just dumb storage; the user association lives in the
> relational database. Switching is a one-line change in `resume_service.py`
> because the service layer isolates that concern — nothing else in the
> codebase is aware of where files are stored.

**"Why FastAPI over Flask or Django?"**

> FastAPI gives async support out of the box (critical for slow LLM API
> calls), automatic request validation via Pydantic, and auto-generated
> OpenAPI docs at `/docs`. Django is a full framework with ORM and admin
> — overkill for an API-first backend. Flask is simpler but requires
> adding Pydantic and async support manually.

**"What is an embedding?"**

> An embedding is a vector of floating-point numbers that represents the
> semantic meaning of a piece of text. Two sentences that mean the same
> thing will have vectors that are numerically close in high-dimensional
> space, even if they share no keywords. This enables semantic search —
> finding content by meaning rather than by exact word match.

**"How do you handle file validation security?"**

> We validate on both sides. On the frontend, the MIME type is checked
> before the request leaves the browser — this gives instant UX feedback.
> On the backend, we re-check the content type from the multipart headers
> and enforce a size limit by reading all bytes and measuring them
> server-side (not trusting the `Content-Length` header, which can be
> spoofed). UUID filenames prevent any path traversal or overwrite attack.

**"What is CORS and why do you need it?"**

> CORS (Cross-Origin Resource Sharing) is a browser security policy that
> blocks a web page from making requests to a different origin than the
> one it was loaded from. Our frontend is on port 5173 and backend on
> 8000 — different origins. FastAPI's `CORSMiddleware` adds
> `Access-Control-Allow-Origin` headers to responses, telling the browser
> it's safe to allow those cross-origin requests.

**"What is Groq and why use it over OpenAI?"**

> Groq is an inference provider that runs open-source models (like llama3
> and mixtral) with extremely fast token generation. For development it
> has a generous free tier — no credit card required. The API shape is
> nearly identical to OpenAI's, so switching from Groq to GPT-4o in
> production is a one-line change. We use Groq now to avoid any cost
> while building out the feature, and switch to OpenAI or Anthropic when
> we deploy to real users.

---

## What's Built vs What's Next

### Built

| Feature             | Where                                      |
|---------------------|--------------------------------------------|
| Resume upload       | `POST /api/resume/upload`                  |
| File validation     | `resume_service.py`                        |
| PDF/DOCX parser     | `parser_service.py` (pdfplumber, python-docx) |
| Section detection   | `parser_service.detect_sections()`         |
| Text chunker        | `chunker_service.chunk_text()`             |
| Local embedder      | `embedder_service.embed_and_store()`       |
| ChromaDB storage    | `backend/chroma_db/` (persistent)          |
| Semantic retrieval  | `embedder_service.query_resume()`          |

### Next

| Feature               | What it does                                              |
|-----------------------|-----------------------------------------------------------|
| JD input UI           | Textarea that appears after upload success                |
| `/api/resume/analyze` | Retrieves chunks, calls Groq, returns score + gaps        |
| ATS score display     | Show score ring, matched keywords, missing skills         |
| Authentication        | Ties uploads and scores to a user account                 |
| S3 + PostgreSQL       | Production-grade storage replacing local disk             |
