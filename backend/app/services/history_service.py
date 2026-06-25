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
    summary: str = "",
) -> None:
    try:
        lookup = (
            get_supabase_admin()
            .table(TABLE)
            .select("user_id, filename")
            .eq("file_id", file_id)
            .limit(1)
            .execute()
        )
        if not lookup.data:
            return
        meta = lookup.data[0]
        get_supabase_admin().table(TABLE).insert({
            "user_id": meta["user_id"],
            "file_id": file_id,
            "filename": meta["filename"],
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
        get_supabase_admin().table(TABLE).delete().eq("user_id", user_id).eq("file_id", file_id).execute()
    except Exception as exc:
        print(f"[history_service] delete error: {exc}")


def get_user_history(user_id: str) -> list[dict]:
    rows = (
        get_supabase_admin()
        .table(TABLE)
        .select("file_id, filename, score, matched_skills, missing_skills, jd_snippet, summary, uploaded_at")
        .eq("user_id", user_id)
        .order("uploaded_at", desc=False)
        .execute()
    ).data

    files: dict[str, dict] = {}
    for row in rows:
        fid = row["file_id"]
        if fid not in files:
            files[fid] = {
                "file_id": fid,
                "filename": row["filename"],
                "uploaded_at": row["uploaded_at"],
                "analyses": [],
            }
        if row["score"] is not None:
            files[fid]["analyses"].append({
                "score": row["score"],
                "matched_skills": row["matched_skills"] or [],
                "missing_skills": row["missing_skills"] or [],
                "jd_snippet": row["jd_snippet"],
                "summary": row.get("summary") or "",
                "analyzed_at": row["uploaded_at"],
            })

    result = sorted(files.values(), key=lambda x: x["uploaded_at"], reverse=True)
    for item in result:
        item["analyses"].sort(key=lambda a: a["analyzed_at"], reverse=True)
    return result
