import io
import uuid
from typing import BinaryIO

from langchain_text_splitters import RecursiveCharacterTextSplitter

from .chroma_client import get_chroma_client, get_or_create_collection
from .config import settings
from .embeddings import get_embeddings


def _extract_text_from_pdf(file_bytes: bytes) -> str:
    from pypdf import PdfReader
    reader = PdfReader(io.BytesIO(file_bytes))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def _extract_text_from_docx(file_bytes: bytes) -> str:
    from docx import Document
    doc = Document(io.BytesIO(file_bytes))
    return "\n".join(para.text for para in doc.paragraphs)


def extract_text(filename: str, file_bytes: bytes) -> str:
    lower = filename.lower()
    if lower.endswith(".pdf"):
        return _extract_text_from_pdf(file_bytes)
    if lower.endswith(".docx"):
        return _extract_text_from_docx(file_bytes)
    # Plain text fallback
    return file_bytes.decode("utf-8", errors="replace")


def ingest_document(filename: str, file_bytes: bytes) -> dict:
    """Parse, chunk, embed, and store a document. Returns ingestion stats."""
    text = extract_text(filename, file_bytes)
    if not text.strip():
        return {"filename": filename, "chunks": 0, "status": "empty"}

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings.chunk_size,
        chunk_overlap=settings.chunk_overlap,
    )
    chunks = splitter.split_text(text)

    embeddings = get_embeddings()
    doc_id = str(uuid.uuid4())

    ids = [f"{doc_id}_{i}" for i in range(len(chunks))]
    metadatas = [{"source": filename, "doc_id": doc_id, "chunk_index": i} for i in range(len(chunks))]

    # Embed and store directly via chromadb client for efficiency
    vectors = embeddings.embed_documents(chunks)
    client = get_chroma_client()
    collection = get_or_create_collection(client)
    collection.add(
        ids=ids,
        embeddings=vectors,
        documents=chunks,
        metadatas=metadatas,
    )

    return {"filename": filename, "doc_id": doc_id, "chunks": len(chunks), "status": "ok"}
