import logging
from fastapi import APIRouter
from pydantic import BaseModel, Field
import chromadb

from ..config import settings
from ..embeddings import get_embeddings

logger = logging.getLogger(__name__)

router = APIRouter(tags=["glossary"])


class GlossarySearchRequest(BaseModel):
    query: str = Field(..., min_length=1)
    topK: int = Field(default=3)


@router.post("/glossary/search")
async def search_glossary(body: GlossarySearchRequest):
    """금융 용어를 벡터 유사도로 검색합니다."""
    try:
        embeddings = get_embeddings()
        query_vector = embeddings.embed_query(body.query)

        client = chromadb.HttpClient(host="localhost", port=8000)
        collection = client.get_collection("glossary")

        results = collection.query(
            query_embeddings=[query_vector],
            n_results=body.topK,
            include=["documents", "metadatas", "distances"],
        )

        hits = []
        documents = results.get("documents", [[]])[0]
        metadatas = results.get("metadatas", [[]])[0]
        distances = results.get("distances", [[]])[0]

        for doc, meta, dist in zip(documents, metadatas, distances):
            score = round(1 - dist, 4)
            if score < 0.1:
                continue
            # doc = "용어: 설명" 형태
            term = meta.get("term", "")
            description = doc.split(": ", 1)[1] if ": " in doc else doc
            hits.append({
                "term": term,
                "description": description,
                "score": score,
            })

        return {"results": hits}

    except Exception as e:
        logger.error(f"Glossary search failed: {e}")
        return {"results": []}
