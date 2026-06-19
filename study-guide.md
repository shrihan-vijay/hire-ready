# HireReady — Study Guide for Interviews

This document explains how the application works end-to-end, how RAG fits in,
and how all the pieces connect. Updated as features are built.

---

## What is HireReady?

HireReady is a full-stack AI tool that helps job seekers:

1. Upload a resume
2. Paste a job description
3. Get an ATS score — how well the resume matches the job
4. Get AI-generated suggestions to improve the resume

The AI layer uses a technique called **RAG (Retrieval-Augmented Generation)**,
explained in detail below.

---

## The Tech Stack

| Layer     | Technology        | Purpose                                    |
|-----------|-------------------|--------------------------------------------|
| Frontend  | React + TypeScript| User interface                             |
| Build tool| Vite              | Fast dev server + bundler for the frontend |
| Backend   | FastAPI (Python)  | API server, business logic, file handling  |
| AI (soon) | OpenAI / LLM      | Generating scores and improvement tips     |
| AI (soon) | Vector DB         | Storing resume chunks for retrieval (RAG)  |

---

## How the Frontend and Backend Connect

```
Browser (React)
      |
      | HTTP requests (axios)
      |
FastAPI backend  (port 8000)
      |
   /api/health        → checks if server is alive
   /api/resume/upload → receives uploaded file
```

The frontend lives at `http://127.0.0.1:5173` (Vite dev server).
The backend lives at `http://127.0.0.1:8000` (uvicorn).

They are separate processes. The frontend talks to the backend via HTTP.
CORS (Cross-Origin Resource Sharing) is configured in the backend to
allow requests from the frontend's origin.

**Why separate?** In production, the frontend becomes static files served
by a CDN (Vercel, Cloudflare). The backend runs on a server (Railway, AWS).
They talk over HTTPS. Keeping them separate from day one mirrors that setup.

---

## Folder Structure and Why It's Organized This Way

```
backend/
  app/
    api/        ← Route handlers only (thin layer — no logic here)
    services/   ← Business logic lives here
    models/     ← Pydantic models (data shapes for requests and responses)
    core/       ← Config, env vars
```

**Routes are kept thin.** A route handler's job is: receive the request,
call a service, return the response. It doesn't know HOW the file is saved.
That's the service's job.

**Services contain the logic.** `resume_service.py` handles validation,
generates a unique filename (UUID), and writes the file to disk. If we later
swap "save to disk" for "upload to S3", we change only the service — the
route handler stays the same.

**Pydantic models enforce types.** FastAPI uses Pydantic to validate incoming
data and serialize outgoing data. If the frontend sends the wrong shape,
FastAPI rejects it automatically with a clear error.

---

## Current Feature: Resume Upload

### What happens when a user uploads a file

1. User selects a PDF or DOCX in the browser
2. Frontend validates file type and size (client-side, instant feedback)
3. User clicks "Upload Resume"
4. Frontend sends a `POST /api/resume/upload` request with the file as
   `multipart/form-data`
5. FastAPI receives the file as an `UploadFile` object
6. `resume_service.save_resume()` runs:
   - Checks content type (PDF or DOCX only)
   - Reads the file bytes and checks size (max 5 MB)
   - Generates a UUID filename so collisions are impossible
   - Writes the file to `backend/uploads/`
7. Returns `{ filename, size, message }` to the frontend
8. Frontend shows a success state with the filename

### Why UUID filenames?

If two users upload `resume.pdf`, the second would overwrite the first.
UUID generates a unique 128-bit ID (e.g., `a3f1b2c4-...pdf`) for every
upload, guaranteeing no collisions.

---

## What is RAG? (And How It Will Be Used Here)

RAG stands for **Retrieval-Augmented Generation**. It's the technique that
makes AI answers *grounded* in specific documents, rather than hallucinated
from general training data.

### The Problem RAG Solves

A plain LLM (like GPT-4) can answer questions about resumes in general,
but it hasn't seen *your* resume. If you ask it "Does my resume match this
job?", it has no idea what's in your resume.

You could paste the whole resume into the prompt — but resumes can be long,
and LLMs have context limits and cost per token.

### The RAG Solution

Instead of pasting the full resume every time, RAG works in two phases:

**Phase 1 — Indexing (happens once when you upload)**

```
Resume text (raw)
      |
  Text splitter        ← breaks resume into small chunks (e.g., 200 words each)
      |
  Embedding model      ← converts each chunk into a vector (list of numbers)
      |
  Vector database      ← stores all vectors, indexed for fast search
```

A vector is a mathematical representation of meaning. Two sentences with
similar meaning will have vectors that are numerically close together.

**Phase 2 — Retrieval + Generation (happens at query time)**

```
Job description (query)
      |
  Embedding model      ← converts the job description into a vector too
      |
  Vector DB search     ← finds resume chunks whose vectors are closest to
      |                   the job description vector (semantic similarity)
  Top-k chunks         ← e.g., the 3 most relevant resume sections
      |
  LLM prompt:
    "Here are the relevant resume sections: [chunks]
     Here is the job description: [JD]
     Score how well this resume matches. Be specific."
      |
  LLM response         ← ATS score + improvement suggestions
```

### Why is this better than just pasting the whole resume?

- Scales to very long documents (a 10-page resume still works)
- Only the *relevant* parts of the resume go into the prompt → lower cost,
  better focus for the LLM
- The vector DB can store multiple resumes and retrieve across all of them

### Where RAG will live in HireReady's architecture

```
POST /api/resume/upload
  → save_resume()         ← already built
  → parse_resume()        ← next: extract text from PDF/DOCX
  → chunk_and_embed()     ← split text, call embedding API, store in vector DB

POST /api/resume/score
  → embed_job_description()
  → retrieve_relevant_chunks()    ← vector DB similarity search
  → call_llm(chunks + JD)         ← generate score + suggestions
  → return ScoreResponse
```

The vector DB will likely be **ChromaDB** (local, no infra needed) or
**Pinecone** (cloud, scales easily). The embedding model will be
OpenAI's `text-embedding-3-small`.

---

## Interview Talking Points

**"Walk me through a user request end to end."**

> The user uploads a PDF. The React frontend sends it as multipart form data
> to `POST /api/resume/upload`. FastAPI receives it as an `UploadFile`,
> the service layer validates the type and size, saves it with a UUID filename,
> and returns the original filename and file size. The frontend shows a success
> state. Later, when the user pastes a job description and requests scoring,
> we'll parse the saved file, chunk it, embed the chunks into a vector space,
> retrieve the most relevant chunks using semantic similarity against the job
> description, and feed those chunks plus the JD into an LLM to get a score
> and suggestions.

**"Why FastAPI over Flask or Django?"**

> FastAPI gives us async support out of the box (important for LLM API calls
> which can be slow), automatic request validation via Pydantic, and auto-
> generated OpenAPI docs. Django is a full framework with ORM, admin, etc. —
> overkill for an API-first backend. Flask is simpler but lacks Pydantic
> integration and async by default.

**"What is an embedding?"**

> An embedding is a vector of floating-point numbers that represents the
> semantic meaning of a piece of text. Texts with similar meaning are
> numerically close in vector space. This lets us do semantic search: instead
> of matching keywords, we find content that *means* the same thing.

**"How do you handle file validation security?"**

> We validate on both sides. On the frontend, we check the MIME type before
> the request even leaves the browser (fast UX feedback). On the backend,
> we re-check the content type from the multipart headers and enforce a max
> file size by reading the bytes and measuring them server-side — not trusting
> the `Content-Length` header, which can be spoofed. We also generate UUID
> filenames so users can't overwrite each other's files.

---

## What's Being Built Next

| Feature          | What it does                                         |
|------------------|------------------------------------------------------|
| Resume parser    | Extracts plain text from uploaded PDF / DOCX         |
| Chunker + embedder| Splits text, generates embeddings, stores in vector DB |
| ATS scorer       | Retrieves relevant chunks, calls LLM, returns score  |
| JD matching      | Same RAG pipeline, tuned for job description matching|
| Auth             | Ties uploads to a user account                       |
