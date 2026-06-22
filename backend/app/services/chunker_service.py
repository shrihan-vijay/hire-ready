def chunk_text(text: str, chunk_size: int = 200, overlap: int = 40) -> list[str]:
    """
    Split text into overlapping word-based chunks.

    Overlap ensures context isn't lost at chunk boundaries — a sentence
    that spans the end of one chunk and the start of the next still gets
    represented in both, so retrieval doesn't miss it.
    """
    words = text.split()
    if not words:
        return []

    chunks = []
    step = chunk_size - overlap
    start = 0

    while start < len(words):
        chunk_words = words[start : start + chunk_size]
        chunks.append(" ".join(chunk_words))
        if start + chunk_size >= len(words):
            break
        start += step

    return chunks
