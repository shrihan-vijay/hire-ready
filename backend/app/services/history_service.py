from app.core.supabase import get_supabase_admin

FILES_TABLE = "resume_files"
ANALYSES_TABLE = "resume_analyses"


def save_upload_record(user_id: str, file_id: str, filename: str) -> None:
    try:
        get_supabase_admin().table(FILES_TABLE).insert({
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
    summary: str = "",
) -> None:
    try:
        get_supabase_admin().table(ANALYSES_TABLE).insert({
            "file_id": file_id,
            "score": score,
            "matched_skills": matched_skills,
            "missing_skills": missing_skills,
            "jd_snippet": jd_snippet[:300],
            "summary": summary,
        }).execute()
    except Exception as exc:
        print(f"[history_service] save_analysis_result error: {exc}")


def delete_resume_record(user_id: str, file_id: str) -> None:
    try:
        get_supabase_admin().table(FILES_TABLE).delete() \
            .eq("user_id", user_id) \
            .eq("file_id", file_id) \
            .execute()
    except Exception as exc:
        print(f"[history_service] delete error: {exc}")


def delete_analysis_entry(user_id: str, file_id: str, analyzed_at: str) -> None:
    try:
        file_check = (
            get_supabase_admin()
            .table(FILES_TABLE)
            .select("file_id")
            .eq("file_id", file_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if not file_check.data:
            return
        get_supabase_admin().table(ANALYSES_TABLE).delete() \
            .eq("file_id", file_id) \
            .eq("analyzed_at", analyzed_at) \
            .execute()
    except Exception as exc:
        print(f"[history_service] delete_analysis_entry error: {exc}")


def get_user_history(user_id: str) -> list[dict]:
    rows = (
        get_supabase_admin()
        .table(FILES_TABLE)
        .select("file_id, filename, uploaded_at, resume_analyses(score, matched_skills, missing_skills, jd_snippet, summary, analyzed_at)")
        .eq("user_id", user_id)
        .order("uploaded_at", desc=True)
        .execute()
    ).data

    result = []
    for row in rows:
        analyses = sorted(
            row.get("resume_analyses") or [],
            key=lambda a: a["analyzed_at"],
            reverse=True,
        )
        result.append({
            "file_id": row["file_id"],
            "filename": row["filename"],
            "uploaded_at": row["uploaded_at"],
            "analyses": analyses,
        })
    return result
