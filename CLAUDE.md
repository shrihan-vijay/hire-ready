# Hire Ready

An AI Resume & Interview Copilot — a full-stack app for tailoring resumes to job descriptions and preparing smarter interview answers.

## Current Stack

**Frontend**
- React + TypeScript
- Vite (dev server on port 5173)
- axios for HTTP, lucide-react for icons

**Backend**
- FastAPI (Python)
- python-multipart for file uploads
- CORS configured for localhost:5173 / 5174
- dotenv for environment config

## Folder Structure

```
backend/app/api/           # Route handlers (thin — delegate to services)
  routes.py                # Main router, wires sub-routers
  resume.py                # Resume endpoints
backend/app/services/      # Business logic
  resume_service.py        # File validation, UUID naming, disk write
backend/app/models/        # Pydantic request/response models
  resume.py                # ResumeUploadResponse
backend/app/core/          # Config (env vars, app settings)
frontend/src/components/   # Reusable UI components
  ResumeUpload.tsx          # Drag-and-drop upload widget
  HowItWorks.tsx            # Interactive 4-step tutorial section
frontend/src/pages/        # Route-level pages (unused so far)
```

## Coding Standards

- Use type hints everywhere in Python
- Use Pydantic models for all request/response shapes
- Keep route handlers thin — business logic belongs in services
- Use async endpoints when possible
- TypeScript strict typing on the frontend
- No comments unless the WHY is non-obvious

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
- `POST /api/resume/upload` — accepts PDF/DOCX up to 5 MB, saves to `backend/uploads/<uuid>.ext`, returns `{ filename, size, message }`

### Frontend
- Modern two-column layout: hero text (left) + upload card (right)
- Sticky frosted-glass navbar with live connection status dot
- Drag-and-drop resume upload with file preview, validation, success/error states
- "How it works" interactive 4-step stepper section:
  - Step 1: Upload mock
  - Step 2: Animated ATS score ring + bar chart
  - Step 3: Skills gap analysis grid
  - Step 4: Typeable interview Q&A with AI answer reveal
  - Keyboard arrow key navigation, slide animations between steps

## Planned Features

- Resume parser (extract text from PDF/DOCX)
- Chunk + embed pipeline (RAG indexing)
- ATS scorer (LLM call with retrieved chunks)
- Job description matching
- Authentication
