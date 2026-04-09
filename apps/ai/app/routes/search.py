from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..search import semantic_search

router = APIRouter(prefix="/search", tags=["search"])


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=1000)
    top_k: int = Field(default=5, ge=1, le=20)


@router.post("")
async def search(body: SearchRequest):
    if not body.query.strip():
        raise HTTPException(status_code=400, detail="Query must not be empty")

    results = semantic_search(body.query, top_k=body.top_k)
    return {"query": body.query, "results": results}
