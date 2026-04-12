import logging
from openai import AsyncOpenAI
from .config import settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """\
당신은 Chat-Ki-S입니다. 키움증권 신입사원의 온보딩을 돕는 사내 챗봇입니다.

## 역할
- 아래 [검색된 문서] 에서 가져온 정보만을 사용하여 답변합니다.
- 검색된 문서에 없는 내용은 추측하거나 창작하지 않습니다.
- 신입사원이 처음 접하는 용어와 절차를 쉽고 명확하게 설명합니다.

## 답변 규칙
1. 반드시 [검색된 문서] 내용을 근거로만 답변하세요.
2. 답변은 3~5문장으로 간결하게 작성하세요.
3. 전문 용어는 괄호 안에 간단한 설명을 추가하세요. 예: RAG(검색 기반 생성)
4. 답변 마지막에 반드시 출처(문서명 또는 섹션)를 표시하세요.
5. 검색된 문서에 충분한 정보가 없으면 fallback 문구를 사용하고 담당 부서를 안내하세요.

## 말투 가이드
- 존댓말을 사용하되, 딱딱하지 않고 친절하게 작성합니다.
- "~입니다", "~하세요", "~해 주세요" 형식을 권장합니다.
- "~해야만 합니다", "~이 필수입니다" 같은 강압적 표현은 피합니다.
- 숫자·날짜·링크는 정확하게 그대로 인용합니다.

## 페이지 컨텍스트
- 사용자의 질문에 [현재 보고 있는 메일/공지사항/직원 프로필/과제] 정보가 포함될 수 있습니다.
- 이 경우 해당 내용을 참고하여 요약, 분석, 관련 정보 안내 등을 수행하세요.
- 컨텍스트 정보가 있으면 [검색된 문서] 없이도 답변 가능합니다.

## 출처 표시 형식
- 답변 본문 마지막 줄 바로 다음 줄에 출처를 표시하세요. 빈 줄은 넣지 마세요.
- 형식: 줄바꿈 + 📄 출처: {문서명} — {섹션 또는 제목}
- 예시:
  ...확인해 주세요.
  📄 출처: 휴가 정책 — 1.1 연차 발생 기준\
"""

FALLBACK_LOW_SCORE = (
    "죄송합니다. 해당 내용은 현재 등록된 문서에서 찾을 수 없었습니다.\n"
    "정확한 정보는 인사팀(onboarding@kiwoom.com) 또는 담당 멘토에게 문의해 주세요.\n"
    "더 궁금한 점이 있으시면 언제든지 질문해 주세요! 😊"
)

FALLBACK_ERROR = (
    "죄송합니다. 일시적인 오류가 발생했습니다.\n"
    "잠시 후 다시 시도해 주시거나, 문제가 지속되면 IT 헬프데스크에 문의해 주세요."
)


def _clean_source_name(filename: str) -> str:
    """파일명에서 확장자 제거, 밑줄을 공백으로, dept_ 접두사 제거."""
    import os
    name = os.path.splitext(filename)[0]  # .md, .docx 제거
    name = name.replace('_', ' ')
    if name.startswith('dept '):
        name = name[5:]
    return name.strip()


def _build_user_message(question: str, hits: list[dict]) -> str:
    chunks = []
    for h in hits:
        source = _clean_source_name(h['source'])
        chunks.append(
            f"{h['content']}\n(출처: {source}, 유사도: {h['score']})"
        )
    doc_section = "\n---\n".join(chunks)
    return f"[검색된 문서]\n---\n{doc_section}\n\n[질문]\n{question}"


def _get_client() -> AsyncOpenAI:
    return AsyncOpenAI(api_key=settings.openai_api_key)


def _build_history_messages(history: list[dict]) -> list[dict]:
    """최근 대화 히스토리를 LLM 메시지 형태로 변환. 최대 4턴."""
    msgs = []
    for h in history[-8:]:  # 최대 8개 (4턴 = user+assistant 각 4개)
        role = h.get("role", "user")
        content = h.get("content", "")
        if role in ("user", "assistant") and content:
            msgs.append({"role": role, "content": content})
    return msgs


VALIDATION_PROMPT = """\
당신은 답변 품질 검증기입니다. 아래 [질문]과 [검색된 문서]를 근거로 [생성된 답변]이 적절한지 판단하세요.

## 판단 기준
1. 답변이 검색된 문서의 내용에 근거하는가? (근거 없는 정보 포함 시 부적절)
2. 질문의 의도에 맞는 답변인가?
3. 사실과 다르거나 지어낸 내용(할루시네이션)이 없는가?

## 응답 형식
반드시 아래 형식으로만 응답하세요:
판정: 적절 또는 부적절
사유: (한 줄로 간단히)\
"""


async def _validate_answer(question: str, hits: list[dict], answer: str) -> bool:
    """생성된 답변의 적절성을 LLM으로 검증한다. 적절하면 True."""
    client = _get_client()

    doc_summary = "\n".join(
        f"- {h['content'][:200]}... (출처: {h['source']})" for h in hits[:3]
    )

    user_msg = (
        f"[질문]\n{question}\n\n"
        f"[검색된 문서]\n{doc_summary}\n\n"
        f"[생성된 답변]\n{answer}"
    )

    try:
        response = await client.chat.completions.create(
            model=settings.llm_model,
            temperature=0,
            max_tokens=100,
            messages=[
                {"role": "system", "content": VALIDATION_PROMPT},
                {"role": "user", "content": user_msg},
            ],
        )
        result = response.choices[0].message.content or ""
        logger.info("answer_validation: %s", result.replace("\n", " "))
        return "부적절" not in result
    except Exception:
        logger.exception("answer validation failed, passing through")
        return True  # 검증 실패 시 답변 통과 (서비스 중단 방지)


async def call_llm(question: str, hits: list[dict], history: list[dict] | None = None) -> dict:
    """Non-streaming LLM call. Returns dict with answer, model, usage."""
    client = _get_client()
    user_msg = _build_user_message(question, hits)

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    if history:
        messages.extend(_build_history_messages(history))
    messages.append({"role": "user", "content": user_msg})

    response = await client.chat.completions.create(
        model=settings.llm_model,
        temperature=settings.llm_temperature,
        max_tokens=settings.llm_max_tokens,
        top_p=settings.llm_top_p,
        messages=messages,
    )
    choice = response.choices[0]
    usage = response.usage
    answer = choice.message.content or ""

    # 답변 적절성 검증 (프롬프트 체이닝)
    is_valid = await _validate_answer(question, hits, answer)
    if not is_valid:
        logger.warning("answer rejected by validation: q=%s", question[:50])
        answer = (
            "죄송합니다. 검색된 문서만으로는 정확한 답변을 드리기 어렵습니다.\n"
            "정확한 정보는 담당 부서 또는 멘토에게 문의해 주세요."
        )

    return {
        "answer": answer,
        "model": response.model,
        "usage": {
            "prompt_tokens": usage.prompt_tokens,
            "completion_tokens": usage.completion_tokens,
            "total_tokens": usage.total_tokens,
        },
        "validated": is_valid,
    }


async def stream_llm(question: str, hits: list[dict], history: list[dict] | None = None):
    """Streaming LLM call. Yields token strings."""
    client = _get_client()
    user_msg = _build_user_message(question, hits)

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    if history:
        messages.extend(_build_history_messages(history))
    messages.append({"role": "user", "content": user_msg})

    stream = await client.chat.completions.create(
        model=settings.llm_model,
        temperature=settings.llm_temperature,
        max_tokens=settings.llm_max_tokens,
        top_p=settings.llm_top_p,
        messages=messages,
        stream=True,
    )
    async for chunk in stream:
        delta = chunk.choices[0].delta
        if delta.content:
            yield delta.content
