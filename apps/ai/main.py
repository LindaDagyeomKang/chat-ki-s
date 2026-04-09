import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.chat import router as chat_router
from app.routes.documents import router as documents_router
from app.routes.search import router as search_router
from app.routes.agent import router as agent_router
from app.routes.tools_chat import router as tools_chat_router
from app.routes.glossary import router as glossary_router

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        from app.seed_ingestion import ingest_seed_documents
        stats = ingest_seed_documents()
        logger.info("Startup seed ingestion: %s", stats)
    except Exception as exc:
        logger.error("Startup seed ingestion failed (non-fatal): %s", exc)
    yield


app = FastAPI(
    title="Chat-Ki-S AI Service",
    description="RAG pipeline: document ingestion and semantic search",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router)
app.include_router(documents_router)
app.include_router(search_router)
app.include_router(agent_router)
app.include_router(tools_chat_router)
app.include_router(glossary_router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "chat-ki-s-ai"}
