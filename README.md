# HireReady

AI-powered resume analysis and interview preparation platform.

## First Milestone

The first working milestone is a React + TypeScript frontend calling a FastAPI
backend health endpoint.

### Backend

```bash
cd backend
sh dev.sh
```

Health endpoint:

```txt
http://localhost:8000/api/health
```

### Frontend

```bash
cd frontend
npm run dev
```

Frontend URL:

```txt
http://localhost:5173
```

## Future Build Order

1. Resume PDF upload
2. PDF text extraction
3. OpenAI-powered resume and job description analysis
4. PostgreSQL persistence
5. Interview question generation
6. RAG with pgvector
7. S3 file storage
