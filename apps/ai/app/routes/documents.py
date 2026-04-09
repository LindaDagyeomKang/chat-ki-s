from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

from ..chroma_client import get_chroma_client, get_or_create_collection
from ..ingestion import ingest_document
from ..keyword_router import SEED_DIR

router = APIRouter(prefix="/documents", tags=["documents"])

# 원본 docx 파일 디렉토리
_SEED_DATA_DIR = SEED_DIR / "seed_data"

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt"}


@router.post("/ingest")
async def ingest(file: UploadFile = File(...)):
    filename = file.filename or "upload"
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Empty file")

    result = ingest_document(filename, file_bytes)
    return result


@router.get("")
async def list_documents():
    """Return unique source documents stored in the collection."""
    client = get_chroma_client()
    collection = get_or_create_collection(client)
    result = collection.get(include=["metadatas"])
    metadatas = result.get("metadatas") or []

    seen: dict[str, dict] = {}
    for meta in metadatas:
        doc_id = meta.get("doc_id", "")
        if doc_id not in seen:
            seen[doc_id] = {"doc_id": doc_id, "source": meta.get("source", "")}
    return {"documents": list(seen.values()), "total": len(seen)}


# md 파일명 → 원본 docx 파일 매핑
_MD_TO_DOCX = {
    "법인차량_사용_및_관리_지침서": "법인차량_사용_및_관리_지침서.docx",
    "법인카드_사용_및_경비_정산_가이드라인": "법인카드_사용_및_경비_정산_가이드라인.docx",
    "신입사원_IT_시스템_및_인프라_권한_신청_가이드": "신입사원_IT_시스템_및_인프라_권한_신청_가이드.docx",
    "신입사원_업무용_PC_프로그램_설치_및_세팅_가이드": "신입사원_업무용_PC_프로그램_설치_및_세팅_가이드.docx",
    "연차_유급휴가_사용_및_신청_가이드": "연차_유급휴가_사용_및_신청_가이드.docx",
    "키움증권_업무용_택시_서비스_이용_매뉴얼": "키움증권_업무용_택시_서비스_이용_매뉴얼.docx",
    "키움증권_임직원_복리후생_제도": "키움증권_임직원_복리후생_제도.docx",
}


@router.get("/source/{source_name}")
async def get_source_document(source_name: str):
    """원본 문서 파일을 다운로드합니다."""
    # .md 확장자 제거
    clean = source_name.replace('.md', '').replace('.docx', '')

    # 원본 docx 찾기
    docx_name = _MD_TO_DOCX.get(clean)
    if docx_name:
        docx_path = _SEED_DATA_DIR / docx_name
        if docx_path.exists():
            return FileResponse(
                path=str(docx_path),
                filename=docx_name,
                media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            )

    # CSV (부서별 실무지침서)
    csv_path = _SEED_DATA_DIR / "신입사원_실무지침서.csv"
    if clean.startswith("dept_") and csv_path.exists():
        return FileResponse(
            path=str(csv_path),
            filename="신입사원_실무지침서.csv",
            media_type="text/csv",
        )

    raise HTTPException(status_code=404, detail="원본 문서를 찾을 수 없습니다.")
