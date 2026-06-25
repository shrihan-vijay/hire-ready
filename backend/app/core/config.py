import os

from dotenv import load_dotenv

load_dotenv()


APP_NAME = os.getenv("APP_NAME", "AI Resume Interview Copilot API")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
FRONTEND_URLS = [
    FRONTEND_URL,
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
]
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
