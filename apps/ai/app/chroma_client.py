from typing import Optional
import chromadb
from .config import settings

_client: Optional[chromadb.ClientAPI] = None


def get_chroma_client() -> chromadb.ClientAPI:
    global _client
    if _client is None:
        # Parse host/port from CHROMA_HOST (e.g. "http://chroma:8000")
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
    return _client


def get_or_create_collection(client: chromadb.ClientAPI):
    return client.get_or_create_collection(
        name=settings.collection_name,
        metadata={"hnsw:space": "cosine"},
    )
