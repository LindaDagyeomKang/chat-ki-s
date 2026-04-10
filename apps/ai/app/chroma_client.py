from typing import Optional
import os
import chromadb
from .config import settings

_client: Optional[chromadb.ClientAPI] = None

# Persistent storage path (in-process, no separate ChromaDB server needed)
_CHROMA_PERSIST = os.environ.get("CHROMA_PERSIST_DIR", "/app/chroma_data")


def get_chroma_client() -> chromadb.ClientAPI:
    global _client
    if _client is None:
        chroma_mode = os.environ.get("CHROMA_MODE", "persistent")
        if chroma_mode == "http":
            # HTTP mode: connect to external ChromaDB server
            host_url = settings.chroma_host.rstrip("/")
            if "://" in host_url:
                host_url = host_url.split("://", 1)[1]
            if ":" in host_url:
                host, port_str = host_url.rsplit(":", 1)
                port = int(port_str)
            else:
                host = host_url
                port = 8000
            _client = chromadb.HttpClient(host=host, port=port)
        else:
            # Persistent mode: in-process, no external server
            os.makedirs(_CHROMA_PERSIST, exist_ok=True)
            _client = chromadb.PersistentClient(path=_CHROMA_PERSIST)
    return _client


def get_or_create_collection(client: chromadb.ClientAPI):
    return client.get_or_create_collection(
        name=settings.collection_name,
        metadata={"hnsw:space": "cosine"},
    )
