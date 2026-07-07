from datetime import datetime, timezone

from app.core.supabase import get_supabase_admin

TABLE = "job_applications"


def create_application(user_id: str, data: dict) -> dict:
    row = {"user_id": user_id, "status": "saved", **data}
    result = get_supabase_admin().table(TABLE).insert(row).execute()
    return result.data[0]


def list_applications(user_id: str) -> list[dict]:
    result = (
        get_supabase_admin()
        .table(TABLE)
        .select("*")
        .eq("user_id", user_id)
        .order("updated_at", desc=True)
        .execute()
    )
    return result.data


def update_application(user_id: str, app_id: str, fields: dict) -> dict:
    result = (
        get_supabase_admin()
        .table(TABLE)
        .update({**fields, "updated_at": datetime.now(timezone.utc).isoformat()})
        .eq("id", app_id)
        .eq("user_id", user_id)
        .execute()
    )
    return result.data[0]


def delete_application(user_id: str, app_id: str) -> None:
    get_supabase_admin().table(TABLE).delete() \
        .eq("id", app_id) \
        .eq("user_id", user_id) \
        .execute()
