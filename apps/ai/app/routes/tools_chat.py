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


class HistoryMessage(BaseModel):
    role: str
    content: str


class ToolsChatRequest(BaseModel):
    message: str
    history: list[HistoryMessage] = Field(default_factory=list)
    pageContext: Optional[str] = None


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

    messages = [{"role": "system", "content": SYSTEM_PROMPT + date_context}]

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
