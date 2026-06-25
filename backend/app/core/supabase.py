from supabase import create_client, Client
from app.core.config import SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY

_client: Client | None = None
_admin_client: Client | None = None


def get_supabase() -> Client:
    global _client
    if _client is None:
        _client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    return _client


def get_supabase_admin() -> Client:
    global _admin_client
    if _admin_client is None:
        _admin_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return _admin_client
