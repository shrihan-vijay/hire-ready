from supabase import create_client, Client
from app.core.config import SUPABASE_URL, SUPABASE_ANON_KEY

_client: Client | None = None


def get_supabase() -> Client:
    global _client
    if _client is None:
        _client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    return _client
