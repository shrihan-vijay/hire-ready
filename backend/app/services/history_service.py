from app.core.supabase import get_supabase_admin

TABLE = "resume_history"


def save_upload_record(user_id: str, file_id: str, filename: str) -> None:
    try:
        get_supabase_admin().table(TABLE).insert({
            "user_id": user_id,
            "file_id": file_id,
            "filename": filename,
        }).execute()
    except Exception:
        pass


def save_analysis_result(
    file_id: str,
    score: int,
    matched_skills: list[str],
    missing_skills: list[str],
    jd_snippet: str,
) -> None:
    try:
        get_supabase_admin().table(TABLE).update({
            "score": score,
            "matched_skills": matched_skills,
            "missing_skills": missing_skills,
            "jd_snippet": jd_snippet[:300],
        }).eq("file_id", file_id).execute()
    except Exception:
        pass


def get_user_history(user_id: str) -> list[dict]:
    response = (
        get_supabase_admin()
        .table(TABLE)
        .select("id, file_id, filename, score, matched_skills, missing_skills, jd_snippet, uploaded_at")
        .eq("user_id", user_id)
        .order("uploaded_at", desc=True)
        .execute()
    )
    return response.data
