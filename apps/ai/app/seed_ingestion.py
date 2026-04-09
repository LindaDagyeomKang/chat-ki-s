import logging
from pathlib import Path

from .chroma_client import get_chroma_client, get_or_create_collection
from .ingestion import ingest_document

logger = logging.getLogger(__name__)

# 로컬: apps/ai/../../data/seed = 프로젝트루트/data/seed
# Docker: /app/data/seed (docker-compose volume)
_LOCAL_SEED = Path(__file__).resolve().parent.parent.parent.parent / "data" / "seed"
_DOCKER_SEED = Path("/app/data/seed")
SEED_DIR = _LOCAL_SEED if _LOCAL_SEED.exists() else _DOCKER_SEED


def _is_already_indexed(collection, filename: str) -> bool:
    results = collection.get(where={"source": filename}, limit=1)
    return len(results["ids"]) > 0


def ingest_seed_documents(seed_dir: Path = SEED_DIR) -> dict:
    """Ingest seed documents from seed_dir into ChromaDB on startup."""
    if not seed_dir.exists():
        logger.warning("Seed directory not found: %s", seed_dir)
        return {"skipped": 0, "ingested": 0, "errors": 0}

    client = get_chroma_client()
    collection = get_or_create_collection(client)

    stats = {"skipped": 0, "ingested": 0, "errors": 0}

    # Support .md, .txt, .docx files
    seed_files = (
        sorted(seed_dir.glob("*.md"))
        + sorted(seed_dir.glob("*.txt"))
        + sorted(seed_dir.glob("*.docx"))
    )
    if not seed_files:
        logger.info("No seed files found in %s", seed_dir)
        return stats

    for file_path in seed_files:
        filename = file_path.name
        try:
            if _is_already_indexed(collection, filename):
                logger.info("Already indexed, skipping: %s", filename)
                stats["skipped"] += 1
                continue

            result = ingest_document(filename, file_path.read_bytes())
            logger.info("Indexed seed document: %s (%d chunks)", filename, result["chunks"])
            stats["ingested"] += 1
        except Exception as exc:
            logger.error("Failed to index seed document %s: %s", filename, exc)
            stats["errors"] += 1

    logger.info("Seed ingestion complete — %s", stats)
    return stats
