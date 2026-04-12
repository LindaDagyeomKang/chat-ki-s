import re
from .chroma_client import get_chroma_client, get_or_create_collection
from .config import settings
from .embeddings import get_embeddings


def _keyword_score(query: str, doc_text: str) -> float:
    """키워드 매칭 점수 (0~1). 쿼리 단어 중 문서에 포함된 비율."""
    words = set(re.findall(r'[가-힣a-zA-Z0-9]+', query.lower()))
    if not words:
        return 0.0
    doc_lower = doc_text.lower()
    matched = sum(1 for w in words if w in doc_lower)
    return round(matched / len(words), 4)


def semantic_search(query: str, top_k: int | None = None, source_filter: list[str] | None = None) -> list[dict]:
    """Return top-k relevant document chunks for a query.

    하이브리드 검색: 벡터 유사도(Semantic) + 키워드 매칭(BM25-like)을 결합하여
    검색 정확도를 높인다.

    Args:
        query: 검색할 텍스트
        top_k: 반환할 최대 청크 수
        source_filter: 특정 문서 파일명으로 검색 범위 제한
    """
    k = top_k or settings.top_k
    embeddings = get_embeddings()
    query_vector = embeddings.embed_query(query)

    client = get_chroma_client()
    collection = get_or_create_collection(client)

    # 벡터 검색은 약간 많이 가져온 뒤 키워드 점수로 리랭킹
    fetch_k = min(k * 3, 20)

    query_kwargs: dict = {
        "query_embeddings": [query_vector],
        "n_results": fetch_k,
        "include": ["documents", "metadatas", "distances"],
    }
    if source_filter:
        if len(source_filter) == 1:
            query_kwargs["where"] = {"source": source_filter[0]}
        else:
            query_kwargs["where"] = {"source": {"$in": source_filter}}

    results = collection.query(**query_kwargs)

    candidates = []
    documents = results.get("documents", [[]])[0]
    metadatas = results.get("metadatas", [[]])[0]
    distances = results.get("distances", [[]])[0]

    for doc, meta, dist in zip(documents, metadatas, distances):
        vector_score = round(1 - dist, 4)
        kw_score = _keyword_score(query, doc)
        # 하이브리드 점수: 벡터 70% + 키워드 30%
        hybrid_score = round(vector_score * 0.7 + kw_score * 0.3, 4)
        candidates.append({
            "content": doc,
            "source": meta.get("source", ""),
            "doc_id": meta.get("doc_id", ""),
            "chunk_index": meta.get("chunk_index", 0),
            "score": hybrid_score,
        })

    # 하이브리드 점수로 정렬 후 top-k 반환
    candidates.sort(key=lambda x: x["score"], reverse=True)
    return candidates[:k]
