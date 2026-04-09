import json
import logging
from typing import AsyncGenerator, Optional

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from ..config import settings
from ..keyword_router import route as keyword_route, get_suggested_questions, CATEGORY_DOCS, SEED_DIR
from ..llm import FALLBACK_ERROR, FALLBACK_LOW_SCORE, call_llm, stream_llm
from ..search import semantic_search

logger = logging.getLogger(__name__)

router = APIRouter(tags=["chat"])


# FAQ intent → 문서 카테고리 매핑
FAQ_TO_CATEGORY = {
    'vacation': 'vacation',
    'benefits': 'benefits',
    'card': 'guide_card',
    'taxi': 'guide_taxi',
    'vehicle': 'guide_vehicle',
    'pc': 'guide_pc',
    'it': 'guide_it',
}

# 부서명 → 카테고리 매핑 (faq_dept용)
DEPT_NAME_TO_CATEGORY = {
    'ict': 'dept_ict', 'it': 'dept_ict',
    's&t market': 'dept_stm', 's&t': 'dept_stm',
    's&t solution': 'dept_sts',
    '감사': 'dept_audit',
    '구조화금융': 'dept_sf', '구조화': 'dept_sf',
    '금융그룹': 'dept_fgm',
    '기업금융': 'dept_cf',
    '리서치': 'dept_research',
    '리스크': 'dept_risk',
    '리테일': 'dept_retail',
    '소비자보호': 'dept_consumer',
    '자산관리': 'dept_am',
    '재무지원': 'dept_finance', '재무': 'dept_finance', '인사': 'dept_finance', '총무': 'dept_finance',
    '전략기획': 'dept_strategy',
    '준법지원': 'dept_compliance', '준법': 'dept_compliance',
    '커뮤니케이션': 'dept_comm', '홍보': 'dept_comm',
    '투자운용': 'dept_invest', '주식운용': 'dept_invest',
    '프로젝트투자': 'dept_project',
}


class HistoryMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    conversationId: str = Field(default="")
    mode: str = Field(default="rag")
    history: list[HistoryMessage] = Field(default_factory=list)
    faqCategory: Optional[str] = None
    faqDepartment: Optional[str] = None
    pageContext: Optional[str] = None


def _build_sources(hits: list[dict]) -> list[dict]:
    return [
        {
            "doc_id": h["doc_id"],
            "source": h["source"],
            "section": h.get("section"),
            "score": h["score"],
            "chunk_index": h["chunk_index"],
        }
        for h in hits
    ]


def _top_score(hits: list[dict]) -> float:
    if not hits:
        return 0.0
    return max(h["score"] for h in hits)


def _load_doc_as_hit(category: str) -> list[dict]:
    """카테고리에 해당하는 문서를 hits 형태로 로드."""
    doc_files = CATEGORY_DOCS.get(category, [])
    hits = []
    for doc_file in doc_files:
        path = SEED_DIR / doc_file
        if path.exists():
            content = path.read_text(encoding="utf-8")
            if content:
                hits.append({
                    "content": content,
                    "source": doc_file,
                    "doc_id": category,
                    "chunk_index": 0,
                    "score": 1.0,
                })
    return hits


def _resolve_faq_category(faq_cat: str, faq_dept: str) -> str | None:
    """FAQ 카테고리 문자열을 CATEGORY_DOCS 키로 변환."""
    # 일반 FAQ
    if faq_cat in FAQ_TO_CATEGORY:
        return FAQ_TO_CATEGORY[faq_cat]

    # 부서 FAQ
    if faq_cat == 'dept' and faq_dept:
        dept_lower = faq_dept.lower()
        for key, cat in DEPT_NAME_TO_CATEGORY.items():
            if key in dept_lower or dept_lower in key:
                return cat
        # 직접 매칭 안 되면 부문명으로 파일 검색
        for cat_key in CATEGORY_DOCS:
            if cat_key.startswith('dept_'):
                for doc_file in CATEGORY_DOCS[cat_key]:
                    if faq_dept in doc_file:
                        return cat_key
    return None


def _keyword_route_to_hits(question: str) -> tuple[list[dict], bool, list[str]]:
    """키워드 라우팅을 시도하여 hits 형태로 변환."""
    routes = keyword_route(question)
    if not routes:
        return [], False, []

    hits = []
    categories = []
    for r in routes:
        hits.append({
            "content": r.doc_content,
            "source": r.doc_source,
            "doc_id": r.category,
            "chunk_index": 0,
            "score": 1.0,
        })
        if r.category not in categories:
            categories.append(r.category)
    logger.info(
        "keyword_route matched: categories=%s keywords=%s",
        [r.category for r in routes],
        [kw for r in routes for kw in r.matched_keywords],
    )
    return hits, True, categories


@router.post("/chat")
async def chat(body: ChatRequest):
    routed = False
    matched_categories: list[str] = []

    # 1단계: LLM이 FAQ 카테고리를 지정한 경우, 해당 문서 내에서 벡터 검색
    if body.faqCategory:
        resolved = _resolve_faq_category(body.faqCategory, body.faqDepartment or '')
        if resolved:
            doc_files = CATEGORY_DOCS.get(resolved, [])
            if doc_files:
                try:
                    hits = semantic_search(body.message, top_k=settings.top_k, source_filter=doc_files)
                    if hits and _top_score(hits) > 0:
                        routed = True
                        matched_categories = [resolved]
                        logger.info("FAQ vector search: %s → %s (top=%.4f)", body.faqCategory, resolved, _top_score(hits))
                except Exception:
                    logger.exception("FAQ vector search failed, falling back to full doc")
            # 벡터 검색 실패 시 문서 전체 로드 fallback
            if not routed:
                hits = _load_doc_as_hit(resolved)
                if hits:
                    routed = True
                    matched_categories = [resolved]
                    logger.info("FAQ full doc fallback: %s → %s", body.faqCategory, resolved)

    # 2단계: FAQ 미지정이면 키워드 라우팅 시도
    if not routed:
        hits, routed, matched_categories = _keyword_route_to_hits(body.message)

    # 3단계: 키워드 매칭도 실패 시 벡터 검색 (전체 문서 대상)
    if not routed:
        try:
            hits = semantic_search(body.message, top_k=settings.top_k)
        except Exception:
            logger.exception("semantic_search failed")
            return {
                "answer": FALLBACK_ERROR,
                "sources": [],
                "is_fallback": True,
                "model": settings.llm_model,
                "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
            }

        top = _top_score(hits)
        if top < settings.score_threshold_low:
            logger.info("fallback: top_score=%.4f conversationId=%s", top, body.conversationId)
            return {
                "answer": FALLBACK_LOW_SCORE,
                "sources": _build_sources(hits),
                "is_fallback": True,
                "model": settings.llm_model,
                "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
            }

    sources = _build_sources(hits)

    # 페이지 컨텍스트가 있으면 hits에 포함
    if body.pageContext:
        hits.insert(0, {
            "content": body.pageContext,
            "source": "현재 보고 있는 화면",
            "doc_id": "page_context",
            "chunk_index": 0,
            "score": 1.0,
        })
        routed = True  # fallback 방지

    # 4단계: LLM 호출
    try:
        history_dicts = [{"role": h.role, "content": h.content} for h in body.history]
        result = await call_llm(body.message, hits, history=history_dicts)
    except Exception:
        logger.exception("call_llm failed")
        return {
            "answer": FALLBACK_ERROR,
            "sources": sources,
            "is_fallback": True,
            "model": settings.llm_model,
            "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
        }

    suggested = get_suggested_questions(matched_categories) if matched_categories else []

    return {
        "answer": result["answer"],
        "sources": sources,
        "is_fallback": False,
        "model": result["model"],
        "usage": result["usage"],
        "suggestedQuestions": suggested,
    }


@router.post("/chat/stream")
async def chat_stream(body: ChatRequest):
    routed = False

    # FAQ 카테고리 우선: 해당 문서 내 벡터 검색
    if body.faqCategory:
        resolved = _resolve_faq_category(body.faqCategory, body.faqDepartment or '')
        if resolved:
            doc_files = CATEGORY_DOCS.get(resolved, [])
            if doc_files:
                try:
                    hits = semantic_search(body.message, top_k=settings.top_k, source_filter=doc_files)
                    if hits and _top_score(hits) > 0:
                        routed = True
                except Exception:
                    pass
            if not routed:
                hits = _load_doc_as_hit(resolved)
                if hits:
                    routed = True

    if not routed:
        hits, routed, _ = _keyword_route_to_hits(body.message)

    if not routed:
        try:
            hits = semantic_search(body.message, top_k=settings.top_k)
        except Exception:
            logger.exception("semantic_search failed in stream")
            hits = []

    top = _top_score(hits)
    sources = _build_sources(hits)

    async def generate() -> AsyncGenerator[bytes, None]:
        if not routed and top < settings.score_threshold_low:
            yield b"data: " + json.dumps({"token": FALLBACK_LOW_SCORE}, ensure_ascii=False).encode() + b"\n\n"
            yield b"data: " + json.dumps(
                {"done": True, "sources": sources, "is_fallback": True}, ensure_ascii=False
            ).encode() + b"\n\n"
            return

        try:
            history_dicts = [{"role": h.role, "content": h.content} for h in body.history]
            async for token in stream_llm(body.message, hits, history=history_dicts):
                yield b"data: " + json.dumps({"token": token}, ensure_ascii=False).encode() + b"\n\n"
        except Exception:
            logger.exception("stream_llm failed")
            yield b"data: " + json.dumps({"token": FALLBACK_ERROR}, ensure_ascii=False).encode() + b"\n\n"
            yield b"data: " + json.dumps(
                {"done": True, "sources": sources, "is_fallback": True}, ensure_ascii=False
            ).encode() + b"\n\n"
            return

        yield b"data: " + json.dumps(
            {"done": True, "sources": sources, "is_fallback": False}, ensure_ascii=False
        ).encode() + b"\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
