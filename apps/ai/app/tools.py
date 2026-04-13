"""
OpenAI Function Calling 도구 정의

LLM이 사용할 수 있는 함수(도구)를 정의합니다.
실제 실행은 백엔드에서 수행하고, 결과를 LLM에 다시 전달합니다.
"""

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_mails",
            "description": "사용자의 메일을 조회합니다. '메일 확인해줘', '메일 뭐 왔어?' 같은 일반 요청은 filter='today'로 오늘 메일을 보여주세요. '전체 메일 보여줘'처럼 명시적으로 전체를 요청할 때만 filter='all'을 사용하세요.",
            "parameters": {
                "type": "object",
                "properties": {
                    "filter": {
                        "type": "string",
                        "enum": ["today", "all", "unread", "read"],
                        "description": "메일 필터: today(오늘 수신), all(전체), unread(안 읽은 메일), read(읽은 메일)"
                    },
                    "sender": {
                        "type": "string",
                        "description": "특정 발신자 이름으로 필터 (선택). 직급 없이 이름만 입력 (예: '제민재')"
                    },
                    "keyword": {
                        "type": "string",
                        "description": "제목/본문 키워드 검색 (선택)"
                    },
                },
                "required": ["filter"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_leave_balance",
            "description": "사용자의 연차 잔여일수, 사용 내역을 조회합니다.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_expense_history",
            "description": "사용자의 경비 정산 내역을 조회합니다.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_profile",
            "description": "사용자 본인의 프로필(소속, 직급, 이메일, 내선번호, 입사일 등)을 조회합니다.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_schedule",
            "description": "일정을 조회합니다. 특정 날짜, 이번 달, 전사 일정 등을 조회할 수 있습니다.",
            "parameters": {
                "type": "object",
                "properties": {
                    "date": {"type": "string", "description": "조회할 날짜 (YYYY-MM-DD). 없으면 오늘"},
                    "month": {"type": "string", "description": "월간 조회 (YYYY-MM). date보다 우선"},
                    "companyOnly": {"type": "boolean", "description": "전사 일정만 조회할 때 true"},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_notices",
            "description": "사내 공지사항 목록을 조회합니다. 공지사항만 조회 가능하며, 보도자료/뉴스/IR 자료는 조회할 수 없습니다.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_assignments",
            "description": "사용자의 온보딩 과제 목록을 조회합니다.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_employees",
            "description": "임직원을 검색합니다. 이름, 부서, 팀, 담당업무, 전화번호, 직급으로 검색할 수 있습니다. '사장님 누구야?', '부장급 누구 있어?' 같은 직급 검색도 가능합니다. count=true로 전체 직원 수도 조회 가능합니다.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "검색할 직원 이름"},
                    "department": {"type": "string", "description": "부서/팀명"},
                    "topic": {"type": "string", "description": "담당 업무 키워드"},
                    "phone": {"type": "string", "description": "전화번호/내선번호"},
                    "rank": {"type": "string", "description": "직급 (사장, 부사장, 전무, 상무, 이사, 부장, 차장, 과장, 대리, 주임, 사원)"},
                    "count": {"type": "boolean", "description": "전체 직원 수만 조회할 때 true"},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "check_leave_status",
            "description": "특정 직원이 오늘 휴가/연차 중인지 확인합니다. 'XX님 오늘 휴가셔?', 'XX님 출근하셨나?' 등의 질문에 사용합니다. 반드시 이 도구로 실제 휴가 여부를 확인한 후 답변하세요.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "확인할 직원 이름"},
                },
                "required": ["name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "find_substitute",
            "description": "특정 직원의 부재/휴가 시 대리인을 찾습니다. 같은 팀 내 차상위 직급 직원을 추천합니다. '~님 휴가시면 누구한테 연락해?', '~님 부재 시 대리인', '~님 대신 연락할 사람' 등의 질문에 사용합니다.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "부재 중인 직원 이름"},
                },
                "required": ["name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_departments",
            "description": "회사의 부서/팀 목록을 조회합니다. 특정 부문의 하위 팀도 조회 가능합니다.",
            "parameters": {
                "type": "object",
                "properties": {
                    "division": {"type": "string", "description": "특정 부문명 (없으면 전체 부문 목록)"},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "submit_leave",
            "description": "연차/반차/휴가를 신청합니다. 사용자 확인이 필요합니다.",
            "parameters": {
                "type": "object",
                "properties": {
                    "leaveType": {
                        "type": "string",
                        "enum": ["annual", "half_am", "half_pm", "sick", "special"],
                        "description": "휴가 유형"
                    },
                    "startDate": {"type": "string", "description": "시작일 (YYYY-MM-DD 또는 자연어)"},
                    "endDate": {"type": "string", "description": "종료일 (없으면 시작일과 동일)"},
                    "reason": {"type": "string", "description": "사유"},
                },
                "required": ["leaveType", "startDate"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "submit_expense",
            "description": "경비를 정산 신청합니다. 사용자 확인이 필요합니다.",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "정산 제목"},
                    "category": {
                        "type": "string",
                        "enum": ["taxi", "meal", "supplies", "travel", "etc"],
                        "description": "경비 유형"
                    },
                    "amount": {"type": "integer", "description": "금액 (원)"},
                    "expenseDate": {"type": "string", "description": "사용일"},
                    "description": {"type": "string", "description": "상세 설명"},
                },
                "required": ["title", "category", "amount"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "add_calendar_event",
            "description": "캘린더에 일정을 추가합니다. 회의, 미팅, 교육 등의 일정을 등록합니다.",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "일정 제목"},
                    "eventDate": {"type": "string", "description": "일정 날짜 (YYYY-MM-DD)"},
                    "startTime": {"type": "string", "description": "시작 시간 (HH:MM)"},
                    "endTime": {"type": "string", "description": "종료 시간 (HH:MM, 선택)"},
                    "location": {"type": "string", "description": "장소 (선택)"},
                },
                "required": ["title", "eventDate", "startTime"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "delete_calendar_event",
            "description": "캘린더에서 일정을 삭제합니다. 특정 날짜의 일정을 삭제할 때 사용합니다. 삭제 전 반드시 get_schedule로 해당 날짜 일정을 먼저 조회하여 사용자에게 어떤 일정을 삭제할지 확인하세요.",
            "parameters": {
                "type": "object",
                "properties": {
                    "eventDate": {"type": "string", "description": "삭제할 일정의 날짜 (YYYY-MM-DD)"},
                    "title": {"type": "string", "description": "삭제할 일정의 제목 (정확히 일치해야 함)"},
                    "index": {"type": "integer", "description": "같은 날 여러 일정 중 몇 번째를 삭제할지 (1부터 시작, 선택)"},
                },
                "required": ["eventDate"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "start_survey",
            "description": "온보딩 설문조사를 시작합니다. 사용자가 설문 메일의 링크를 클릭했거나 '설문 시작'을 요청했을 때 사용합니다.",
            "parameters": {
                "type": "object",
                "properties": {
                    "quarter": {"type": "integer", "description": "설문 분기 (0~4)"},
                },
                "required": ["quarter"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "submit_survey_answer",
            "description": "설문 질문에 대한 답변을 제출합니다. 5점 척도 질문은 1~5 숫자, 주관식은 텍스트로 답변합니다.",
            "parameters": {
                "type": "object",
                "properties": {
                    "surveyId": {"type": "string", "description": "설문 응답 ID"},
                    "step": {"type": "integer", "description": "현재 질문 번호 (1~4)"},
                    "answer": {"type": "string", "description": "답변 (숫자 또는 텍스트)"},
                },
                "required": ["surveyId", "step", "answer"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "check_room_availability",
            "description": "회의실 예약 가능 여부를 확인합니다. '회의실 비어있어?', '내일 대회의실 예약 가능해?' 등의 질문에 사용합니다.",
            "parameters": {
                "type": "object",
                "properties": {
                    "date": {"type": "string", "description": "확인할 날짜 (YYYY-MM-DD)"},
                    "roomName": {"type": "string", "description": "회의실 이름 (선택, 없으면 전체)"},
                },
                "required": ["date"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "book_room",
            "description": "회의실을 예약합니다. '대회의실 A 내일 오후 2시에 예약해줘' 등의 요청에 사용합니다.",
            "parameters": {
                "type": "object",
                "properties": {
                    "roomName": {"type": "string", "description": "회의실 이름 (대회의실 A, 소회의실 1 등)"},
                    "date": {"type": "string", "description": "예약 날짜 (YYYY-MM-DD)"},
                    "startTime": {"type": "string", "description": "시작 시간 (HH:MM)"},
                    "endTime": {"type": "string", "description": "종료 시간 (HH:MM)"},
                    "title": {"type": "string", "description": "회의 제목"},
                    "attendees": {"type": "string", "description": "참석자 (선택)"},
                },
                "required": ["roomName", "date", "startTime", "endTime", "title"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "draft_email",
            "description": "비즈니스 메일 초안을 작성합니다. '메일 작성해줘', '메일 초안 좀 써줘', '이메일 보내려는데 도와줘' 등의 요청에 사용합니다. 수신자, 용건, 데이터 등 정보가 부족하면 먼저 질문하세요.",
            "parameters": {
                "type": "object",
                "properties": {
                    "recipient": {"type": "string", "description": "수신자 (이름, 직책, 부서)"},
                    "cc": {"type": "string", "description": "참조자 (선택)"},
                    "subject": {"type": "string", "description": "메일 용건/주제"},
                    "details": {"type": "string", "description": "포함할 핵심 내용, 데이터, 날짜, 수치 등"},
                    "senderDept": {"type": "string", "description": "발신 부서 (유저 프로필에서 추출)"},
                },
                "required": ["subject", "details"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_glossary",
            "description": "금융 용어를 검색하여 설명합니다. 정확한 용어명 또는 개념 설명으로 검색할 수 있습니다. 증권, 금융, 투자 관련 용어 질문에 사용합니다.",
            "parameters": {
                "type": "object",
                "properties": {
                    "term": {"type": "string", "description": "검색할 용어 또는 개념 설명 (예: 'CDO', '주식 공매도', '빚을 모아서 증권 만드는 것')"},
                },
                "required": ["term"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_documents",
            "description": "사내 지식베이스(규정, 가이드, 매뉴얼)에서 RAG 검색합니다. 연차 규정, 법인카드 기준, PC 세팅 방법, 복리후생 등 회사 정책/절차 질문에 사용합니다. ⚠️ 결재함/보고서 조회는 get_approvals, 맛집/식당은 search_restaurant를 사용하세요.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "검색할 질문/키워드"},
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_approvals",
            "description": "결재함에서 보고서/기안 문서를 조회합니다. 업무 결재 상태 확인, 보고서 내용 검색, 보고서 양식 참고 등에 사용합니다. '미결재 문서', '승인된 보고서', 'AB테스트 보고서 찾아줘' 같은 요청에 사용하세요. ⚠️ 사내 규정/정책 검색은 search_documents를 사용하세요.",
            "parameters": {
                "type": "object",
                "properties": {
                    "category": {
                        "type": "string",
                        "enum": ["AB테스트", "KPI", "알고리즘", "고객분석", "콘텐츠", "주간동향"],
                        "description": "보고서 카테고리로 필터 (선택)"
                    },
                    "status": {
                        "type": "string",
                        "enum": ["draft", "submitted", "approved", "rejected"],
                        "description": "결재 상태 필터: draft=임시저장, submitted=미결재/제출됨, approved=승인완료, rejected=반려 (선택)"
                    },
                    "keyword": {
                        "type": "string",
                        "description": "제목/내용/작성자 키워드 검색 (선택)"
                    },
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "query_db",
            "description": "다른 도구로 해결할 수 없는 DB 조회 질문에 사용합니다. 자연어 질문을 SQL로 변환하여 실행합니다. 예: '이번 달 경비 총액', '인사이트랩팀 직원 수', '가장 조회수 높은 공지' 등 기존 도구로 커버되지 않는 집계/분석/통계 질문에 활용하세요.",
            "parameters": {
                "type": "object",
                "properties": {
                    "question": {
                        "type": "string",
                        "description": "DB에서 조회하고 싶은 내용을 자연어로 설명"
                    },
                },
                "required": ["question"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_restaurant",
            "description": "여의도 주변 맛집/식당/카페를 검색합니다. 점심 추천, 회식 장소, 카페 추천, 전화번호 등 음식점 관련 질문에 사용합니다. '오늘 점심 뭐 먹지?', '한우 맛집', '회식 장소 추천' 같은 요청에 사용하세요.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "검색 키워드 (음식 종류, 분위기, 식당명 등)"},
                },
                "required": ["query"],
            },
        },
    },
]

SYSTEM_PROMPT = """\
당신은 Chat-Ki-S입니다. 키움증권 신입사원의 온보딩을 돕는 사내 챗봇입니다.

## 역할
- 사용자의 질문에 적절한 도구(함수)를 호출하여 정보를 조회하고 답변합니다.
- 도구 호출 결과를 바탕으로 친절하고 간결하게 답변합니다.
- 여러 도구를 조합해서 사용할 수 있습니다.

## 대화 맥락 규칙
- 사용자가 "네", "알려주세요", "해줘", "그거" 같은 짧은 답변을 하면, 반드시 **이전 대화 히스토리를 확인**하여 맥락을 파악하세요.
- 이전 assistant 메시지에서 제안한 내용이 있다면, 사용자의 짧은 답변은 그 제안에 대한 동의/요청입니다.
- 맥락을 파악할 수 없는 경우에만 "무엇을 도와드릴까요?"라고 되물으세요. 추측으로 다른 도구를 호출하지 마세요.

## 도구 카테고리 맵
질문의 주제를 먼저 파악하고, 해당 카테고리의 도구를 우선 선택하세요.

📧 커뮤니케이션 (메일/공지/게시판)
  - get_mails: 메일 조회·검색·요약
  - draft_email: 메일 작성
  - get_notices: 공지사항/게시판 조회. ⚠️ "게시판"은 사내 공지사항이며 보도자료가 아닙니다!

📅 일정/자원관리
  - get_schedule: 일정 조회
  - add_calendar_event: 일정 추가
  - delete_calendar_event: 일정 삭제
  - check_room_availability: 회의실 현황
  - book_room: 회의실 예약

👤 인사/근태
  - get_leave_balance: 연차 잔여일
  - submit_leave: 연차/반차 신청
  - check_leave_status: 특정 직원 휴가 여부 확인
  - get_profile: 내 인사정보
  - search_employees: 임직원 검색 (이름/부서/직급/업무)
  - find_substitute: 부재 시 대리인 찾기
  - list_departments: 부서/팀 목록

💰 경비/결재
  - get_expense_history: 경비 내역
  - submit_expense: 경비 정산 신청
  - get_approvals: 결재함/보고서 조회

📚 지식/검색
  - search_documents: 사내 문서 검색 (규정, 가이드, 매뉴얼)
  - search_glossary: 금융 용어 검색
  - query_db: DB 직접 조회 (통계/집계/분석)

🍽️ 맛집/식당
  - search_restaurant: 여의도 주변 맛집/식당/카페 검색

🎯 온보딩
  - get_assignments: 온보딩 과제 조회
  - start_survey: 설문 시작
  - submit_survey_answer: 설문 답변 제출

## 도구 사용 규칙
- 게시판/공지사항/인기글/최신글 질문 → get_notices 호출. ⚠️ "게시판"은 사내 공지사항이며 보도자료가 아닙니다!
- 개인 데이터 질문 (내 연차, 내 메일, 내 프로필 등) → 해당 조회 도구 호출
- 회사 규정/정책 질문 (연차 규정, 법인카드 기준 등) → search_documents 호출
- 맛집/점심/식당/카페/회식 장소/회식 어디서/전화번호 질문 → search_restaurant 호출
- 회사 근처, 주변 장소 관련 질문 → search_restaurant 호출
- 사람 찾기 → search_employees 호출
- "XX급 목록 보여줘", "부장급 직원", "과장 누구야" → search_employees(rank="XX") 호출. count=true가 아님!
- 액션 요청 (연차 신청, 경비 정산) → submit_leave 또는 submit_expense 호출
- "XX님 휴가셔?", "XX님 출근하셨나?" → check_leave_status(name="XX") 호출. 절대 추측하지 마세요!
- "우리팀/저희팀/소속팀/팀원 연차 쓰는 사람?", "팀에 휴가인 사람?" → check_leave_status(name="우리팀") 호출. 팀 단위 질문은 반드시 name="우리팀"으로 전달하세요.
- "XX님 휴가시면 누구한테 연락해?", "XX님 부재 시 누구한테", "대리인 찾아줘" → find_substitute(name="XX") 호출
  ⚠️ 부재/휴가 대리인은 search_employees나 search_documents가 아닌 반드시 find_substitute를 사용하세요!
- "XX이 뭘 물어봤어?", "XX한테 온 메일", "XX이 뭐라고 했어?", "XX이 보낸 메일" → get_mails 호출. ⚠️ 사람 이름이 있어도 메일 내용을 묻는 질문이면 반드시 메일 도구를 사용하세요!
- "코드 리뷰 어디서?", "회의 어디서?", "스크럼 몇 시?" 등 일정에 등록된 제목·장소·시간 질문 → get_schedule 호출
- 메일 작성 도움 → draft_email 호출 (수신자/용건/내용 파악 후)
- 결재함/보고서 관련 질문 (결재 상태, 보고서 양식, 업무 히스토리) → get_approvals 호출
- 다른 도구로 해결 안 되는 DB 조회/통계/집계 질문 → query_db 호출 (예: "이번 달 경비 총액", "팀별 인원수")
- 금융 용어/개념 질문 → search_glossary 호출
- 일정/캘린더 추가 → add_calendar_event 호출 (연차 신청이 아님!)
- 일정 삭제 → delete_calendar_event 호출. 삭제 전 반드시 get_schedule로 먼저 조회하여 사용자에게 확인받을 것.
- ⚠️ "캘린더에 추가해줘", "일정 등록해줘" = add_calendar_event (submit_leave 아님)
- ⚠️ 일정 삭제를 실행하지 않고 "삭제했습니다"라고 답변하지 마세요. 반드시 delete_calendar_event를 호출하세요.
- 설문조사 → start_survey로 시작, 질문 하나씩 진행, submit_survey_answer로 답변 수집
- 보도자료/뉴스/IR 질문 → 도구 호출하지 말고 "보도자료는 현재 시스템에서 제공하지 않습니다. 키움증권 홈페이지를 확인해 주세요." 안내
- 잡담/인사 → 도구 없이 직접 답변

## 설문 진행 규칙
- start_survey 호출 후 첫 번째 질문을 즉시 물어보세요
- 사용자가 답변하면 submit_survey_answer로 저장하고 다음 질문을 물어보세요
- 5점 척도 질문은 "(1: 전혀 아니다 ~ 5: 매우 그렇다)" 안내를 포함하세요
- 4번째 질문(주관식)은 자유롭게 답변할 수 있도록 안내하세요
- 모든 질문이 끝나면 감사 인사를 하세요

## 말투
- 존댓말, 친절하고 간결하게
- 이모지 최소화, 불렛포인트 사용

## 페이지 컨텍스트
- 사용자가 현재 보고 있는 화면 정보가 제공될 수 있습니다.
- "이 메일 요약해줘", "이 공지 설명해줘" 등의 요청은 컨텍스트를 참고하세요.
"""
