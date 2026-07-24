from sentence_transformers import SentenceTransformer

from app.core.supabase import get_supabase_admin

CHUNKS_TABLE = "resume_chunks"

# Lazy singleton — model loads once on first use (~90 MB download on first run)
_model: SentenceTransformer | None = None


def _get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


def embed_and_store(file_id: str, filename: str, chunks: list[str]) -> int:
    """Embed chunks and persist them in Supabase (pgvector). Returns number of chunks stored."""
    if not chunks:
        return 0

    embeddings = _get_model().encode(chunks, show_progress_bar=False).tolist()

    rows = [
        {
            "file_id": file_id,
            "filename": filename,
            "chunk_index": i,
            "content": chunk,
            "embedding": embedding,
        }
        for i, (chunk, embedding) in enumerate(zip(chunks, embeddings))
    ]
    get_supabase_admin().table(CHUNKS_TABLE).insert(rows).execute()
    return len(chunks)


def delete_chunks(file_id: str) -> None:
    try:
        get_supabase_admin().table(CHUNKS_TABLE).delete().eq("file_id", file_id).execute()
    except Exception as exc:
        print(f"[embedder_service] delete_chunks error for {file_id}: {exc}")


def query_resume(file_id: str, query: str, n_results: int = 5) -> list[str]:
    query_embedding = _get_model().encode([query])[0].tolist()
    result = (
        get_supabase_admin()
        .rpc(
            "match_resume_chunks",
            {
                "query_embedding": query_embedding,
                "match_file_id": file_id,
                "match_count": n_results,
            },
        )
        .execute()
    )
    return [row["content"] for row in result.data]
