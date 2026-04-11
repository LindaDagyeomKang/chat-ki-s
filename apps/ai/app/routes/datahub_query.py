"""
DataHub Query: 자연어 → SQL 생성 + 검증
"""
import re
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from openai import OpenAI
from ..config import settings
from ..datahub import build_schema_prompt, RESTRICTED_TABLES

logger = logging.getLogger(__name__)
router = APIRouter()
client = OpenAI(api_key=settings.openai_api_key)

DANGEROUS_PATTERNS = re.compile(
    r'\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|EXEC|EXECUTE)\b',
    re.IGNORECASE
)

FORBIDDEN_COLUMNS = {'password_hash'}


class QueryRequest(BaseModel):
    question: str
    user_id: str


class QueryResponse(BaseModel):
    sql: str
    explanation: str
    safe: bool
    error: str | None = None


def validate_sql(sql: str) -> tuple[bool, str]:
    """SQL 안전성 검증"""
    sql_upper = sql.upper().strip()

    # SELECT만 허용
    if not sql_upper.startswith('SELECT'):
        return False, "SELECT 쿼리만 허용됩니다."

    # 위험한 키워드 체크
    if DANGEROUS_PATTERNS.search(sql):
        return False, "위험한 SQL 키워드가 감지되었습니다."

    # 금지 컬럼 체크
    for col in FORBIDDEN_COLUMNS:
        if col in sql.lower():
            return False, f"'{col}' 컬럼은 조회할 수 없습니다."

    # 제한 테이블 체크
    for table in RESTRICTED_TABLES:
        if re.search(rf'\b{table}\b', sql, re.IGNORECASE):
            return False, f"'{table}' 테이블은 접근할 수 없습니다."

    # LIMIT 강제
    if 'LIMIT' not in sql_upper:
        sql = sql.rstrip(';') + ' LIMIT 20;'

    return True, sql


@router.post("/datahub/query", response_model=QueryResponse)
async def generate_query(req: QueryRequest):
    """자연어 질문 → SQL 쿼리 생성"""
    schema_prompt = build_schema_prompt(req.user_id)

    try:
        response = client.chat.completions.create(
            model=settings.llm_model,
            temperature=0,
            messages=[
                {
                    "role": "system",
                    "content": f"""당신은 키움증권 사내 DB의 SQL 쿼리 생성기입니다.
사용자의 자연어 질문을 PostgreSQL SELECT 쿼리로 변환하세요.

{schema_prompt}

## 응답 형식
반드시 아래 형식으로만 응답하세요:
SQL: <생성한 SQL 쿼리>
설명: <이 쿼리가 무엇을 조회하는지 한국어로 간단히>

주의:
- SELECT만 사용
- password_hash 절대 조회 금지
- LIMIT 20 필수
- 현재 사용자 참조 시 '{req.user_id}' 사용
- 테이블/컬럼명은 메타데이터에 있는 것만 사용
- 없는 데이터를 추측하지 말고, 조회 가능한 범위에서만 답변
"""
                },
                {"role": "user", "content": req.question}
            ],
            max_tokens=500,
        )

        content = response.choices[0].message.content or ""

        # SQL과 설명 파싱
        sql_match = re.search(r'SQL:\s*(.+?)(?:\n설명:|$)', content, re.DOTALL)
        exp_match = re.search(r'설명:\s*(.+)', content, re.DOTALL)

        if not sql_match:
            return QueryResponse(sql="", explanation="", safe=False, error="SQL을 생성하지 못했습니다.")

        raw_sql = sql_match.group(1).strip().strip('`').strip()
        explanation = exp_match.group(1).strip() if exp_match else ""

        # user_id 치환
        raw_sql = raw_sql.replace("{user_id}", req.user_id)

        # 검증
        is_safe, result = validate_sql(raw_sql)
        if not is_safe:
            return QueryResponse(sql=raw_sql, explanation=explanation, safe=False, error=result)

        return QueryResponse(sql=result, explanation=explanation, safe=True)

    except Exception as e:
        logger.error("DataHub query generation failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
