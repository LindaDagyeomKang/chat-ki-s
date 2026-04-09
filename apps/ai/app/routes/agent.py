import logging
from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field
from openai import AsyncOpenAI

from ..agent import detect_action
from ..config import settings

logger = logging.getLogger(__name__)

router = APIRouter(tags=["agent"])


class HistoryMessage(BaseModel):
    role: str
    content: str


class AgentRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    history: Optional[list[HistoryMessage]] = None


class EmployeeInfo(BaseModel):
    name: str
    rank: Optional[str] = None
    position: Optional[str] = None
    division: Optional[str] = None
    team: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    duty: Optional[str] = None
    isExecutive: bool = False
    isSameDivision: bool = False


class RequestorProfile(BaseModel):
    name: Optional[str] = None
    rank: Optional[str] = None
    team: Optional[str] = None
    division: Optional[str] = None


class RecommendRequest(BaseModel):
    userQuestion: str
    employees: list[EmployeeInfo]
    requestor: Optional[RequestorProfile] = None


RECOMMEND_PROMPT = """\
당신은 키움증권 사내 챗봇입니다. 사용자가 담당자를 찾고 있습니다.

## 요청자 정보
{requestor_info}

## 규칙
1. 검색 결과를 보고 사용자의 질문에 가장 적합한 담당자를 **1~2명** 추천하세요.
2. 왜 이 사람이 적절한지 간단히 설명하세요 (직책, 담당 업무 기준).
3. 연락 방법(이메일, 내선번호)을 안내하세요.
4. 임원은 직접 연락 대신 비서실(내선 1000) 안내로 대체하세요.
5. 같은 부문이 아닌 사람은 이메일만 제공하세요 (내선번호/업무 비공개).
6. 검색 결과가 없으면 주소록 페이지 안내하세요.
7. 사람 이름으로 검색한 경우(특정인 조회), 해당 인물의 정보를 직접 안내하세요.
8. 친근하고 간결하게 답변하세요.

## ⚠️ 직급 고려 (매우 중요)
- 요청자의 직급을 반드시 고려하세요.
- **신입/사원/주임**이 문의할 때: 대리~과장급 실무자를 추천하세요. 차장 이상은 가급적 피하세요.
- **대리/과장**이 문의할 때: 같은 직급 또는 차장급까지 추천 가능.
- **차장 이상**이 문의할 때: 제한 없음.
- 직급 차이가 3단계 이상 나면 "먼저 ~팀 실무 담당자에게 문의하시는 것을 추천드려요"라고 안내.
- 직급 서열: 사원 < 주임 < 대리 < 과장 < 차장 < 부장/팀장

## 답변 형식
- 추천 대상: 이름, 직급, 팀
- 이유: 왜 이 분에게 연락해야 하는지
- 연락처: 이메일, 전화번호
"""


@router.post("/agent/detect")
async def detect(body: AgentRequest):
    """사용자 메시지에서 Agent 액션을 판별합니다 (LLM 기반)."""
    history = [{"role": h.role, "content": h.content} for h in body.history] if body.history else None
    result = await detect_action(body.message, history=history)
    return {
        "action": result.action,
        "params": result.params,
        "confirmationMessage": result.confirmation_message,
    }


@router.post("/agent/recommend-employee")
async def recommend_employee(body: RecommendRequest):
    """검색 결과에서 가장 적합한 담당자를 LLM으로 추천합니다."""
    if not body.employees:
        return {"recommendation": f"검색 결과가 없어요. 주소록에서 직접 찾아보시겠어요?\n\n👉 /intranet/addressbook"}

    # 직원 정보를 텍스트로 변환
    emp_list = []
    for i, e in enumerate(body.employees, 1):
        info = f"{i}. {e.name}"
        if e.rank:
            info += f" {e.rank}"
        if e.position and e.position != '-':
            info += f" ({e.position})"
        if e.division:
            info += f"\n   부문: {e.division}"
        if e.team:
            info += f" > {e.team}"
        if e.isExecutive:
            info += "\n   [임원 - 비서실 통해 연락]"
        else:
            if e.isSameDivision:
                if e.email:
                    info += f"\n   📧 {e.email}"
                if e.phone:
                    info += f" | 📞 {e.phone}"
                if e.duty:
                    info += f"\n   💼 {e.duty}"
            else:
                if e.email:
                    info += f"\n   📧 {e.email}"
        emp_list.append(info)

    employees_text = "\n\n".join(emp_list)

    # 요청자 정보 구성
    if body.requestor and body.requestor.name:
        r = body.requestor
        requestor_info = f"이름: {r.name}, 직급: {r.rank or '정보없음'}, 팀: {r.team or '정보없음'}, 부문: {r.division or '정보없음'}"
    else:
        requestor_info = "정보 없음 (신입사원으로 가정)"

    prompt = RECOMMEND_PROMPT.format(requestor_info=requestor_info)

    client = AsyncOpenAI(api_key=settings.openai_api_key)
    try:
        response = await client.chat.completions.create(
            model=settings.llm_model,
            temperature=0.3,
            max_tokens=400,
            messages=[
                {"role": "system", "content": prompt},
                {"role": "user", "content": f"[사용자 질문]\n{body.userQuestion}\n\n[검색 결과]\n{employees_text}"},
            ],
        )
        recommendation = response.choices[0].message.content or ""
        return {"recommendation": recommendation}
    except Exception as e:
        logger.error(f"Employee recommendation failed: {e}")
        return {"recommendation": employees_text}
