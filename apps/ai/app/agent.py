"""
AI Agent 의도 분류 모듈 (LLM 기반)

사용자 발화를 LLM으로 분석하여:
- 인트라넷 액션(연차 신청, 경비 정산 등)
- FAQ 카테고리(복리후생, 연차 규정, PC 세팅 등)
- 담당자 검색
을 통합 판별합니다.
"""

import json
import logging
from dataclasses import dataclass

from openai import AsyncOpenAI

from .config import settings

logger = logging.getLogger(__name__)


@dataclass
class AgentAction:
    action: str
    params: dict
    confirmation_message: str


INTENT_SYSTEM_PROMPT = """\
당신은 키움증권 사내 챗봇의 의도 분류기입니다.
사용자의 메시지를 분석하여 **액션 요청**인지, **정보 질문(FAQ)**인지, **사람 검색**인지 판별합니다.

## 분류 기준

### 🔧 액션 (실제로 무언가를 실행하는 요청)

1. **leave** — 연차/반차/휴가/병가를 **신청하려는** 의도
   - "내일 연차 쓸래", "7월 3일 오전반차 신청해줘"
   - 이전 대화에서 날짜를 물어봤고 유저가 날짜로 답변하면 → leave (날짜 추출)
   - "4월 10일, 13일" → startDate: "4월 10일", endDate: "4월 13일"
   - "어", "응" 같은 짧은 긍정은 이전 맥락 유지

2. **expense** — 경비를 **정산/신청하려는** 의도
   - "택시비 32000원 정산해줘"

3. **assignment** — 과제를 **등록/부여하려는** 의도
4. **assignment_submit** — 과제를 **제출하려는** 의도
5. **assignments_list** — 과제 **목록 조회**
6. **notices** — 공지사항 **조회**
7. **mail** — 전체 메일함 **조회** (받은 편지함 보여줘, 메일 확인해줘)
   - ⚠️ "오늘 받은 메일", "새 메일 있어?" → my_info type: today_mail (오늘 날짜 필터)

### 📊 내 정보 조회 (개인 데이터)

8. **my_info** — 본인의 **개인 데이터**를 조회하려는 의도
   - params의 type으로 구분:
   - type: "leave_balance" → "내 연차 며칠이야?", "나 연차 얼마나 남았어?"
   - type: "leave_history" → "내가 올해 연차 언제 썼지?", "내 휴가 사용 내역"
   - type: "expense_history" → "내 경비 정산 현황은?", "이번 달 경비 얼마 썼지?"
   - type: "profile" → "내 프로필 보여줘", "내 사번이 뭐야?", "내 정보 알려줘"
   - type: "salary" → "내 급여 얼마야?", "저번달 월급은?"
   - type: "schedule" → "오늘 일정 뭐야?", "오늘 일정 확인", "오늘 뭐 해?"
   - type: "today_mail" → "오늘 받은 메일 뭐야?", "오늘 메일 왔어?", "새 메일 있어?"
   - ⚠️ "연차 규정이 뭐야?" → faq_vacation (정책 질문, my_info 아님!)
   - ⚠️ 핵심: "내/나/나의" + 개인 데이터 = my_info, 일반 규정 질문 = faq_*

### 👤 사람 검색

8. **employee_search** — 특정 사람/담당자를 **찾으려는** 의도
   - "이소현 내선번호 뭐야?" → name: "이소현"
   - "주식운용 관련 문의 누구한테 해?" → department: "주식운용"
   - "02-768-9975 누구 번호야?" → phone: "9975"

9. **employee_browse** — 부서/팀 **목록을 보고 싶은** 의도

### 📄 FAQ (정보/규정/절차에 대한 질문) — 가장 적절한 카테고리 선택

10. **faq_vacation** — 연차, 휴가, 반차, 병가의 **규정/절차** 질문 (일반 정책)
    - "휴가 규정이 뭐야?", "병가는 어떻게 내?", "연차 신청 절차는?"
    - ⚠️ "내 연차 며칠?" → my_info (개인 데이터)

11. **faq_benefits** — 복리후생, 급여, 복지, 대출, 융자, 보험, 수당, 의료비, 건강검진, 동호회 등
    - "주택자금 융자 받을 수 있어?", "복리후생 뭐가 있어?", "건강검진 언제야?"

12. **faq_card** — 법인카드, 경비정산 **규정/절차** 질문
    - "영수증 분실하면 어떡해?", "법인카드 사용 기준이 뭐야?"

13. **faq_taxi** — 업무 택시 서비스 이용 규정/절차
    - "야근 택시 기준이 뭐야?", "택시비 한도는?"

14. **faq_vehicle** — 법인차량 사용/관리 규정
    - "법인차량 예약은 어떻게 해?"

15. **faq_pc** — PC 세팅, 프로그램 설치, HTS 설정 등
    - "PC 세팅 어떻게 해?", "HTS 설치 방법은?", "필수 프로그램 뭐야?"

16. **faq_it** — IT 시스템 권한, 계정, VPN, ERP, 그룹웨어 등
    - "시스템 권한 신청은?", "VPN 접속 방법은?", "ERP 계정은?"

17. **faq_dept** — 특정 부서/팀의 업무, 역할, 조직 관련 질문
    - "ICT부문은 뭘 해?", "리서치센터 어떤 팀이 있어?", "기업금융 업무가 뭐야?"
    - params에 department 필드로 부서명 추출

18. **none** — 위 어떤 것에도 해당하지 않는 잡담, 인사말
    - "안녕", "고마워", "ㅋㅋ"

## ⚠️ 핵심 구분 원칙

**액션 vs FAQ 구분이 가장 중요!**
- "연차 **써줘**/신청해줘" → leave (액션)
- "연차 **규정** 뭐야?/어떻게 사용해?" → faq_vacation (FAQ)
- "택시비 **정산해줘**" → expense (액션)
- "택시비 **한도**가 뭐야?" → faq_taxi (FAQ)
- "영수증 **분실하면** 어떡해?" → faq_card (FAQ)

**동의어/유의어를 이해하세요:**
- 융자 = 대출 = 주택자금 → faq_benefits
- 내선번호 = 전화번호 = 연락처 → employee_search
- 설치 = 세팅 = 설정 → faq_pc 또는 faq_it (맥락에 따라)

## ⚠️ 대화 문맥 활용 (매우 중요)
이전 대화 히스토리가 제공됩니다. **반드시** 문맥을 고려하세요.

**후속 답변 처리 규칙:**
- 이전에 챗봇이 "날짜를 알려주세요"라고 물어봤고 → 유저가 날짜를 답하면 → leave (날짜 추출)
- 이전에 챗봇이 "금액을 알려주세요"라고 물어봤고 → 유저가 금액을 답하면 → expense (금액 추출)
- 이전에 챗봇이 "누구에게 보낼까요?"라고 물어봤고 → 유저가 이름을 답하면 → assignment (대상자 추출)
- "어", "응", "맞아", "그래" 같은 짧은 긍정 답변 → 이전 대화 맥락의 intent 유지
- 이전에 담당자 검색 대화가 있었으면 → employee_search 또는 employee_browse

**날짜 파싱:**
- "4월 10일, 13일" → startDate: "4월 10일", endDate: "4월 13일" (쉼표로 구분된 두 날짜 = 기간)
- "내일" → date: "내일"
- "다음주 월요일" → date: "다음주 월요일"

## 출력 형식 (JSON만 출력)

```json
{
  "intent": "leave|expense|...|my_info|employee_search|...|faq_vacation|faq_benefits|...|none",
  "confidence": 0.0~1.0,
  "params": {},
  "reason": "판별 근거 한 줄"
}
```

### params:
- **leave:** leaveType, startDate (시작일), endDate (종료일, 없으면 startDate와 동일), reason
- **expense:** category, amount, date, description
- **assignment:** targetName, targetId, title, dueDate
- **assignment_submit:** submission
- **my_info:** type ("leave_balance" | "leave_history" | "expense_history" | "profile" | "salary")
- **employee_search:** name, department, topic, phone
- **employee_browse:** department
- **faq_dept:** department (부서명)
- **나머지:** {}
"""

# FAQ intent → 문서 카테고리 매핑
FAQ_CATEGORY_MAP = {
    'faq_vacation': 'vacation',
    'faq_benefits': 'benefits',
    'faq_card': 'guide_card',
    'faq_taxi': 'guide_taxi',
    'faq_vehicle': 'guide_vehicle',
    'faq_pc': 'guide_pc',
    'faq_it': 'guide_it',
    'faq_dept': None,  # department param에 따라 동적으로 결정
}


LEAVE_TYPE_LABELS = {
    'annual': '연차',
    'half_am': '오전 반차',
    'half_pm': '오후 반차',
    'sick': '병가',
    'special': '특별휴가',
}

EXPENSE_CATEGORY_LABELS = {
    'taxi': '업무 택시',
    'meal': '업무 식대',
    'supplies': '사무용품',
    'travel': '출장 경비',
    'etc': '기타',
}


def _resolve_date(date_str: str | None) -> str | None:
    if not date_str:
        return None
    import re
    from datetime import datetime, timedelta, timezone
    KST = timezone(timedelta(hours=9))
    today = datetime.now(KST)
    if '오늘' in date_str:
        return today.strftime('%Y-%m-%d')
    if '내일' in date_str:
        return (today + timedelta(days=1)).strftime('%Y-%m-%d')
    if '모레' in date_str:
        return (today + timedelta(days=2)).strftime('%Y-%m-%d')
    if '다음주 월' in date_str:
        days_ahead = 7 - today.weekday()
        return (today + timedelta(days=days_ahead)).strftime('%Y-%m-%d')
    match = re.search(r'(\d{4}[-./]\d{1,2}[-./]\d{1,2})', date_str)
    if match:
        return match.group(1).replace('.', '-').replace('/', '-')
    match = re.search(r'(\d{1,2})월\s*(\d{1,2})일', date_str)
    if match:
        month, day = int(match.group(1)), int(match.group(2))
        return f'{today.year}-{month:02d}-{day:02d}'
    return None


def _parse_amount(text: str) -> int | None:
    import re
    match = re.search(r'(\d[\d,]+)\s*원', text)
    if match:
        return int(match.group(1).replace(',', ''))
    match = re.search(r'(\d+)\s*만\s*(\d*)\s*천?\s*원?', text)
    if match:
        man = int(match.group(1)) * 10000
        chun = int(match.group(2)) * 1000 if match.group(2) else 0
        return man + chun
    return None


def _build_confirmation(intent: str, params: dict, original_message: str) -> str:
    if intent == 'leave':
        leave_type = params.get('leaveType', 'annual')
        label = LEAVE_TYPE_LABELS.get(leave_type, '연차')
        start = _resolve_date(params.get('startDate') or params.get('date'))
        end = _resolve_date(params.get('endDate'))
        if not start:
            return f'{label}를 신청하시려는 거죠? 날짜를 알려주세요! (예: 내일, 4월 10일)'
        if end and end != start:
            return f'{start} ~ {end} {label}를 신청할까요?'
        return f'{start} {label}를 신청할까요?'
    if intent == 'expense':
        category = params.get('category', 'etc')
        label = EXPENSE_CATEGORY_LABELS.get(category, '기타')
        amount = params.get('amount') or _parse_amount(original_message)
        if not amount:
            return f'{label} 정산을 하시려는 거죠? 금액을 알려주세요!'
        return f'{label} {amount:,}원을 정산 신청할까요?'
    if intent == 'assignment':
        target = params.get('targetName') or params.get('targetId') or ''
        title = params.get('title', '')
        if not target:
            return '과제를 누구에게 보낼까요? 사번이나 이름을 알려주세요!'
        if not title:
            return f'{target}님에게 어떤 과제를 내시겠어요?'
        due = _resolve_date(params.get('dueDate'))
        desc = f'{target}님에게 과제를 등록할까요?\n\n📋 과제: {title}'
        if due:
            desc += f'\n📅 마감: {due}'
        return desc
    if intent == 'assignment_submit':
        submission = params.get('submission', '')
        return '과제를 제출할까요?' if submission else '어떤 내용을 제출할까요?'
    return ''


def _build_action_params(intent: str, params: dict, original_message: str) -> dict:
    from datetime import datetime
    if intent == 'leave':
        leave_type = params.get('leaveType', 'annual')
        start = _resolve_date(params.get('startDate') or params.get('date'))
        end = _resolve_date(params.get('endDate'))
        if not start:
            return {'leaveType': leave_type}
        return {
            'leaveType': leave_type,
            'startDate': start,
            'endDate': end or start,
            'reason': params.get('reason', ''),
        }
    if intent == 'expense':
        category = params.get('category', 'etc')
        amount = params.get('amount') or _parse_amount(original_message)
        from datetime import timezone as tz, timedelta as td
        date = _resolve_date(params.get('date')) or datetime.now(tz(td(hours=9))).strftime('%Y-%m-%d')
        return {
            'title': EXPENSE_CATEGORY_LABELS.get(category, '기타'),
            'category': category,
            'amount': amount,
            'expenseDate': date,
            'description': params.get('description', original_message),
        }
    if intent == 'assignment':
        target_id = params.get('targetId', '') or ''
        if target_id and not str(target_id).upper().startswith('EMP'):
            target_id = ''
        return {
            'title': params.get('title', ''),
            'description': '',
            'assignedToEmployeeId': target_id,
            'assignedToName': params.get('targetName', '') or '',
            'dueDate': _resolve_date(params.get('dueDate')) or '',
        }
    if intent == 'assignment_submit':
        return {'submission': params.get('submission', '') or ''}
    if intent == 'employee_search':
        return {
            'name': params.get('name', '') or '',
            'department': params.get('department', '') or '',
            'topic': params.get('topic', '') or '',
            'phone': params.get('phone', '') or '',
        }
    if intent == 'employee_browse':
        return {'department': params.get('department', '') or ''}
    return params


async def detect_action(message: str, history: list[dict] | None = None) -> AgentAction:
    """LLM을 사용하여 사용자 메시지에서 의도를 판별합니다."""
    client = AsyncOpenAI(api_key=settings.openai_api_key)

    from datetime import datetime, timezone, timedelta
    now = datetime.now(timezone(timedelta(hours=9)))
    date_info = f"오늘 날짜: {now.strftime('%Y-%m-%d (%A)')}\n\n"
    llm_messages: list[dict] = [{"role": "system", "content": date_info + INTENT_SYSTEM_PROMPT}]
    if history:
        for h in history[-8:]:
            role = h.get("role", "user")
            content = h.get("content", "")
            if role in ("user", "assistant") and content:
                llm_messages.append({"role": role, "content": content})
    llm_messages.append({"role": "user", "content": message})

    try:
        response = await client.chat.completions.create(
            model=settings.llm_model,
            temperature=0.0,
            max_tokens=300,
            messages=llm_messages,
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content or '{}'
        result = json.loads(raw)
        logger.info(f"Intent detection: {result}")
    except Exception as e:
        logger.error(f"Intent detection failed: {e}")
        return AgentAction(action='none', params={}, confirmation_message='')

    intent = result.get('intent', 'none')
    confidence = result.get('confidence', 0.0)
    params = result.get('params', {}) or {}

    if confidence < 0.5:
        return AgentAction(action='none', params={}, confirmation_message='')

    # FAQ 카테고리
    if intent.startswith('faq_'):
        faq_params = {'department': (params.get('department') or '').strip()} if intent == 'faq_dept' else {}
        return AgentAction(action=intent, params=faq_params, confirmation_message='')

    if intent == 'none':
        return AgentAction(action='none', params={}, confirmation_message='')

    # 내 정보 조회
    if intent == 'my_info':
        info_type = (params.get('type') or 'profile').strip()
        return AgentAction(action='my_info', params={'type': info_type}, confirmation_message='')

    # 조회 액션
    if intent in ('notices', 'mail', 'assignments_list'):
        return AgentAction(action=intent, params={}, confirmation_message='')

    # 부서/팀 목록
    if intent == 'employee_browse':
        return AgentAction(action='employee_browse', params={'department': (params.get('department') or '').strip()}, confirmation_message='')

    # 담당자 검색
    if intent == 'employee_search':
        name = (params.get('name') or '').strip()
        department = (params.get('department') or '').strip()
        topic = (params.get('topic') or '').strip()
        phone = (params.get('phone') or '').strip()
        if not name and not department and not topic and not phone:
            return AgentAction(action='employee_search_clarify', params={}, confirmation_message='어떤 부서나 업무의 담당자를 찾으시나요?')
        return AgentAction(action='employee_search', params={'name': name, 'department': department, 'topic': topic, 'phone': phone}, confirmation_message='')

    # 액션 요청
    action_params = _build_action_params(intent, params, message)
    confirmation = _build_confirmation(intent, params, message)

    if intent == 'leave' and 'startDate' not in action_params:
        return AgentAction(action='leave_need_date', params=action_params, confirmation_message=confirmation)
    if intent == 'expense' and not action_params.get('amount'):
        return AgentAction(action='expense_need_amount', params=action_params, confirmation_message=confirmation)
    if intent == 'assignment':
        if not action_params.get('assignedToEmployeeId') and not action_params.get('assignedToName'):
            return AgentAction(action='assignment_need_target', params=action_params, confirmation_message=confirmation)
        if not action_params.get('title'):
            return AgentAction(action='assignment_need_title', params=action_params, confirmation_message=confirmation)

    return AgentAction(action=intent, params=action_params, confirmation_message=confirmation)
