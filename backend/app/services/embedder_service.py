import chromadb
from sentence_transformers import SentenceTransformer

# Lazy singletons — model loads once on first use (~90 MB download on first run)
_model: SentenceTransformer | None = None
_collection = None


def _get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


def _get_collection():
    global _collection
    if _collection is None:
        client = chromadb.PersistentClient(path="./chroma_db")
        _collection = client.get_or_create_collection(
            name="resumes",
            metadata={"hnsw:space": "cosine"},
        )
    return _collection


def embed_and_store(file_id: str, filename: str, chunks: list[str]) -> int:
    """Embed chunks and persist them in ChromaDB. Returns number of chunks stored."""
    if not chunks:
        return 0

    embeddings = _get_model().encode(chunks, show_progress_bar=False).tolist()

    _get_collection().add(
        documents=chunks,
        embeddings=embeddings,
        ids=[f"{file_id}_{i}" for i in range(len(chunks))],
        metadatas=[
            {"file_id": file_id, "filename": filename, "chunk_index": i}
            for i in range(len(chunks))
        ],
    )
    return len(chunks)


def query_resume(file_id: str, query: str, n_results: int = 5) -> list[str]:
    collection = _get_collection()
    existing = collection.get(where={"file_id": file_id})
    count = len(existing["ids"])
    if count == 0:
        return []
    n_results = min(n_results, count)
    query_embedding = _get_model().encode([query]).tolist()
    results = collection.query(
        query_embeddings=query_embedding,
        n_results=n_results,
        where={"file_id": file_id},
    )
    return results["documents"][0] if results["documents"] else []
