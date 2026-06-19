# Hire Ready

An AI Resume & Interview Copilot — a full-stack app for tailoring resumes to job descriptions and preparing smarter interview answers.

## Current Stack

**Frontend**
- React + TypeScript
- Vite (dev server on port 5173)
- axios for HTTP, lucide-react for icons

**Backend**
- FastAPI (Python)
- CORS configured for localhost:5173 / 5174
- dotenv for environment config

## Folder Structure

```
backend/app/api/        # API route handlers (thin — delegate to services)
backend/app/services/   # Business logic
backend/app/models/     # Pydantic request/response models
backend/app/core/       # Config (env vars, app settings)
frontend/src/components/  # Reusable UI components
frontend/src/pages/       # Route-level pages
```

## Coding Standards

- Use type hints everywhere in Python
- Use Pydantic models for all request/response shapes
- Keep route handlers thin — business logic belongs in services
- Use async endpoints when possible
- TypeScript strict typing on the frontend

## Development Workflow

Before implementing a feature:
1. Check existing architecture and services
2. Reuse existing services when possible
3. Avoid duplicating API routes

**Running locally:**
- Backend: `uvicorn app.main:app --reload` (from `backend/`)
- Frontend: `npm run dev` (from `frontend/`)
- API base URL is read from `VITE_API_BASE_URL` env var (defaults to `http://localhost:8000`)

## Current Features

- `GET /api/health` — health check endpoint
- Frontend polls the health endpoint on load and displays connection status

## Planned Features

- Resume upload
- Resume parser
- ATS scoring
- Job description matching
- Authentication
