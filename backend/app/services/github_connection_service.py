from typing import Optional

from app.core.supabase import get_supabase_admin


def save_github_connection(user_id: str, username: str, token: str) -> None:
    try:
        get_supabase_admin().table("github_connections").upsert(
            {"user_id": user_id, "github_username": username, "github_token": token},
            on_conflict="user_id",
        ).execute()
    except Exception as exc:
        print(f"[github_connection_service] save error: {exc}")


def get_github_connection(user_id: str) -> Optional[dict]:
    try:
        res = (
            get_supabase_admin()
            .table("github_connections")
            .select("github_username, github_token")
            .eq("user_id", user_id)
            .single()
            .execute()
        )
        return res.data
    except Exception:
        return None


def delete_github_connection(user_id: str) -> None:
    try:
        get_supabase_admin().table("github_connections").delete().eq("user_id", user_id).execute()
    except Exception as exc:
        print(f"[github_connection_service] delete error: {exc}")
