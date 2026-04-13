"""
Function Calling 기반 챗봇 엔드포인트

LLM이 도구를 선택 → 백엔드가 실행 → 결과를 LLM에 돌려줌 → 최종 답변
"""
import json
import logging
from typing import Optional

from fastapi import APIRouter
from openai import AsyncOpenAI
from pydantic import BaseModel, Field

from datetime import datetime

from ..config import settings
from ..tools import TOOLS, SYSTEM_PROMPT

logger = logging.getLogger(__name__)

router = APIRouter(tags=["tools_chat"])


def _build_context_hint(history: list) -> str:
    """최근 히스토리에서 대화 맥락 힌트를 추출한다.
    assistant 응답에서 어떤 데이터를 다뤘는지 간략히 요약."""
    if not history:
        return ""

    hints = []
    for i, h in enumerate(history):
        if h.role != "assistant" or not h.content:
            continue
        content = h.content[:300]  # 앞부분만 분석
        # 메일 관련 응답 감지
        if any(kw in content for kw in ["메일", "편지", "수신", "발신", "RE:", "제목:"]):
            # 바로 앞 user 메시지에서 주제 추출
            user_msg = history[i - 1].content if i > 0 and history[i - 1].role == "user" else ""
            hints.append(f"- 직전에 메일 관련 조회를 수행함 (질문: {user_msg[:60]})")
        elif any(kw in content for kw in ["일정", "캘린더", "킥오프", "회의"]):
            user_msg = history[i - 1].content if i > 0 and history[i - 1].role == "user" else ""
            hints.append(f"- 직전에 일정/캘린더 관련 조회를 수행함 (질문: {user_msg[:60]})")
        elif any(kw in content for kw in ["연차", "휴가", "반차"]):
            hints.append("- 직전에 연차/휴가 관련 조회를 수행함")
        elif any(kw in content for kw in ["경비", "정산", "품의"]):
            hints.append("- 직전에 경비/정산 관련 조회를 수행함")
        elif any(kw in content for kw in ["임직원", "직원", "팀원", "담당자"]):
            hints.append("- 직전에 임직원 검색을 수행함")

    # 마지막 힌트만 (가장 최근 맥락)
    return hints[-1] if hints else ""


class HistoryMessage(BaseModel):
    role: str
    content: str


class ToolsChatRequest(BaseModel):
    message: str
    history: list[HistoryMessage] = Field(default_factory=list)
    pageContext: Optional[str] = None
    userContext: Optional[str] = None


class ToolCallResult(BaseModel):
    tool_call_id: str
    name: str
    result: str


class ToolsChatContinueRequest(BaseModel):
    """도구 실행 결과를 받아서 LLM에 다시 전달"""
    messages: list[dict]  # 전체 메시지 히스토리 (시스템 + 유저 + assistant tool_calls + tool results)


@router.post("/chat/tools")
async def tools_chat(body: ToolsChatRequest):
    """1단계: 유저 메시지 → LLM (도구 호출 또는 직접 답변)"""
    client = AsyncOpenAI(api_key=settings.openai_api_key)

    from datetime import timezone, timedelta
    KST = timezone(timedelta(hours=9))
    now = datetime.now(KST)
    today_str = now.strftime('%Y-%m-%d')
    day_names = ['월', '화', '수', '목', '금', '토', '일']
    day_name = day_names[now.weekday()]
    date_context = f"\n\n## 현재 시간 정보\n- 오늘 날짜: {today_str} ({day_name}요일)\n- 현재 시간: {now.strftime('%H:%M')} (KST)\n- 연도: {now.year}년\n⚠️ 날짜를 언급할 때 반드시 이 정보를 기준으로 하세요. '다음 주'는 오늘 기준 다음 월요일~금요일입니다. 캘린더 일정 등록 시 연도는 반드시 {now.year}년을 사용하세요."

    user_info = ""
    if body.userContext:
        user_info = f"\n\n## 현재 사용자 정보\n- 현재 사용자: {body.userContext}\n- '우리 팀', '우리 부서', '내 팀' 등의 표현은 이 사용자의 소속을 기준으로 해석하세요."

    # 히스토리에서 이전 대화 맥락 힌트 생성
    context_hint = _build_context_hint(body.history[-8:])
    context_section = f"\n\n## 이전 대화 맥락\n{context_hint}\n- 후속 질문이 이 맥락과 관련될 수 있으니 참고하되, 질문 의도가 명확히 다르면 무시하세요." if context_hint else ""

    messages = [{"role": "system", "content": SYSTEM_PROMPT + date_context + user_info + context_section}]

    # 히스토리
    for h in body.history[-8:]:
        if h.role in ("user", "assistant") and h.content:
            messages.append({"role": h.role, "content": h.content})

    # 페이지 컨텍스트가 있으면 유저 메시지에 포함
    user_content = body.message
    if body.pageContext:
        user_content = f"{body.pageContext}\n\n{body.message}"

    messages.append({"role": "user", "content": user_content})

    try:
        response = await client.chat.completions.create(
            model=settings.llm_model,
            temperature=0.1,
            max_tokens=800,
            messages=messages,
            tools=TOOLS,
            tool_choice="auto",
        )

        choice = response.choices[0]

        # 도구 호출 없이 직접 답변
        if choice.finish_reason == "stop" or not choice.message.tool_calls:
            return {
                "type": "answer",
                "answer": choice.message.content or "",
                "usage": {
                    "prompt_tokens": response.usage.prompt_tokens,
                    "completion_tokens": response.usage.completion_tokens,
                    "total_tokens": response.usage.total_tokens,
                } if response.usage else {},
            }

        # 도구 호출 필요
        tool_calls = []
        for tc in choice.message.tool_calls:
            tool_calls.append({
                "id": tc.id,
                "name": tc.function.name,
                "arguments": tc.function.arguments,
            })

        # 다음 단계를 위해 현재 messages + assistant 메시지 저장
        assistant_msg = {
            "role": "assistant",
            "content": choice.message.content,
            "tool_calls": [
                {"id": tc.id, "type": "function", "function": {"name": tc.function.name, "arguments": tc.function.arguments}}
                for tc in choice.message.tool_calls
            ],
        }

        return {
            "type": "tool_calls",
            "tool_calls": tool_calls,
            "messages": messages + [assistant_msg],  # 백엔드가 결과 붙여서 continue에 보냄
        }

    except Exception as e:
        logger.error(f"Tools chat failed: {e}")
        return {
            "type": "answer",
            "answer": "죄송합니다. 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
            "usage": {},
        }


@router.post("/chat/tools/continue")
async def tools_chat_continue(body: ToolsChatContinueRequest):
    """2단계: 도구 실행 결과를 받아서 LLM이 최종 답변 생성"""
    client = AsyncOpenAI(api_key=settings.openai_api_key)

    try:
        response = await client.chat.completions.create(
            model=settings.llm_model,
            temperature=0.1,
            max_tokens=800,
            messages=body.messages,
            tools=TOOLS,
            tool_choice="auto",
        )

        choice = response.choices[0]

        # 또 도구 호출 (multi-hop)
        if choice.message.tool_calls:
            tool_calls = [
                {"id": tc.id, "name": tc.function.name, "arguments": tc.function.arguments}
                for tc in choice.message.tool_calls
            ]
            assistant_msg = {
                "role": "assistant",
                "content": choice.message.content,
                "tool_calls": [
                    {"id": tc.id, "type": "function", "function": {"name": tc.function.name, "arguments": tc.function.arguments}}
                    for tc in choice.message.tool_calls
                ],
            }
            return {
                "type": "tool_calls",
                "tool_calls": tool_calls,
                "messages": body.messages + [assistant_msg],
            }

        return {
            "type": "answer",
            "answer": choice.message.content or "",
            "usage": {
                "prompt_tokens": response.usage.prompt_tokens,
                "completion_tokens": response.usage.completion_tokens,
                "total_tokens": response.usage.total_tokens,
            } if response.usage else {},
        }

    except Exception as e:
        logger.error(f"Tools continue failed: {e}")
        return {
            "type": "answer",
            "answer": "죄송합니다. 처리 중 오류가 발생했습니다.",
            "usage": {},
        }
