from .chroma_client import get_chroma_client, get_or_create_collection
from .config import settings
from .embeddings import get_embeddings


def semantic_search(query: str, top_k: int | None = None, source_filter: list[str] | None = None) -> list[dict]:
    """Return top-k relevant document chunks for a query.

    Args:
        query: 검색할 텍스트
        top_k: 반환할 최대 청크 수
        source_filter: 특정 문서 파일명으로 검색 범위 제한 (예: ["키움증권_임직원_복리후생_제도.md"])
    """
    k = top_k or settings.top_k
    embeddings = get_embeddings()
    query_vector = embeddings.embed_query(query)

    client = get_chroma_client()
    collection = get_or_create_collection(client)

    query_kwargs: dict = {
        "query_embeddings": [query_vector],
        "n_results": k,
        "include": ["documents", "metadatas", "distances"],
    }
    if source_filter:
        if len(source_filter) == 1:
            query_kwargs["where"] = {"source": source_filter[0]}
        else:
            query_kwargs["where"] = {"source": {"$in": source_filter}}

    results = collection.query(**query_kwargs)

    hits = []
    documents = results.get("documents", [[]])[0]
    metadatas = results.get("metadatas", [[]])[0]
    distances = results.get("distances", [[]])[0]

    for doc, meta, dist in zip(documents, metadatas, distances):
        hits.append({
            "content": doc,
            "source": meta.get("source", ""),
            "doc_id": meta.get("doc_id", ""),
            "chunk_index": meta.get("chunk_index", 0),
            "score": round(1 - dist, 4),  # cosine similarity
        })

    return hits
