"""
DataHub: 테이블 메타데이터 정의
LLM이 SQL을 생성할 때 참조하는 스키마 정보
"""

TABLE_METADATA = {
    "users": {
        "description": "시스템 로그인 계정 (신입사원/멘토)",
        "columns": {
            "id": "UUID PK",
            "employee_id": "사번 (예: 20260002)",
            "name": "이름",
            "email": "이메일",
            "department": "소속 부서명",
            "role": "역할 (mentee=신입, mentor=멘토)",
            "created_at": "가입일시",
        },
        "sample_queries": [
            "신입사원 목록 → SELECT name, department FROM users WHERE role='mentee'",
        ],
    },
    "employees": {
        "description": "임직원 프로필 (주소록, 1253명 전체 직원)",
        "columns": {
            "id": "UUID PK",
            "employee_id": "사번",
            "name": "이름",
            "gender": "성별",
            "birth_date": "생년월일",
            "division": "부문 (최상위 조직)",
            "department": "본부",
            "team": "팀",
            "rank": "직급 (사원/주임/대리/과장/차장/부장/이사/상무/전무/부사장/사장)",
            "position": "직책 (팀장/본부장 등, 없으면 '-')",
            "join_date": "입사일",
            "tenure": "근속년수",
            "email": "회사 이메일",
            "phone": "내선번호 (예: 02-768-xxxx)",
            "mbti": "MBTI",
            "duty": "담당업무",
            "status": "상태 (온라인/자리비움 등)",
        },
        "relations": "users.employee_ref_id → employees.id (사용자↔직원 연결)",
        "sample_queries": [
            "인사이트랩팀 직원 → SELECT name, rank, phone FROM employees WHERE team='인사이트랩팀'",
            "부장 이상 → SELECT name, rank, team FROM employees WHERE rank IN ('부장','이사','상무','전무','부사장','사장')",
        ],
    },
    "mails": {
        "description": "사내 전자우편",
        "columns": {
            "id": "UUID PK",
            "from_id": "발신자 user_id (FK → users.id)",
            "to_id": "수신자 user_id (FK → users.id)",
            "subject": "메일 제목",
            "body": "메일 본문",
            "from_text": "발신자 표시 텍스트 (이름 직급 팀)",
            "to_text": "수신자 표시 텍스트",
            "cc": "참조",
            "is_read": "읽음 여부 (boolean)",
            "starred": "별표 (boolean)",
            "deleted": "삭제됨 (boolean)",
            "is_draft": "임시저장 (boolean)",
            "received_at": "수신 일시",
            "created_at": "생성 일시",
        },
        "relations": "from_id, to_id → users.id",
        "sample_queries": [
            "오늘 받은 메일 → SELECT subject, from_text, received_at FROM mails WHERE to_id='{user_id}' AND received_at >= CURRENT_DATE",
            "안 읽은 메일 수 → SELECT COUNT(*) FROM mails WHERE to_id='{user_id}' AND is_read=false AND deleted=false",
        ],
    },
    "notices": {
        "description": "공지게시판",
        "columns": {
            "id": "UUID PK",
            "title": "제목",
            "content": "내용",
            "category": "카테고리 (인사/보안/경영지원/총무/일반)",
            "author_id": "작성자 user_id",
            "pinned": "고정글 여부 (boolean)",
            "views": "조회수",
            "created_at": "작성일시",
        },
        "sample_queries": [
            "최근 공지 → SELECT title, category, created_at FROM notices ORDER BY created_at DESC LIMIT 5",
        ],
    },
    "leave_requests": {
        "description": "연차/휴가 신청 내역",
        "columns": {
            "id": "UUID PK",
            "user_id": "신청자 (FK → users.id)",
            "leave_type": "종류 (annual=연차, half_am=오전반차, half_pm=오후반차, sick=병가, special=특별휴가)",
            "start_date": "시작일 (DATE)",
            "end_date": "종료일 (DATE)",
            "reason": "사유",
            "status": "상태 (pending=대기, approved=승인, rejected=반려)",
            "approver_id": "승인자 user_id",
            "created_at": "신청일시",
        },
        "relations": "user_id, approver_id → users.id",
        "sample_queries": [
            "오늘 휴가인 사람 → SELECT u.name, lr.leave_type FROM leave_requests lr JOIN users u ON lr.user_id=u.id WHERE lr.start_date <= CURRENT_DATE AND lr.end_date >= CURRENT_DATE",
            "내 연차 사용 내역 → SELECT leave_type, start_date, end_date, status FROM leave_requests WHERE user_id='{user_id}' ORDER BY start_date DESC",
        ],
    },
    "expenses": {
        "description": "품의/경비 정산",
        "columns": {
            "id": "UUID PK",
            "user_id": "신청자 (FK → users.id)",
            "title": "제목",
            "category": "분류 (taxi/meal/supplies/travel/etc)",
            "amount": "금액 (원)",
            "description": "설명",
            "expense_date": "지출일 (DATE)",
            "status": "상태 (pending/approved/rejected)",
            "approver_id": "승인자",
            "created_at": "신청일시",
        },
        "relations": "user_id, approver_id → users.id",
        "sample_queries": [
            "이번 달 경비 총액 → SELECT SUM(amount) FROM expenses WHERE user_id='{user_id}' AND expense_date >= date_trunc('month', CURRENT_DATE)",
        ],
    },
    "calendar_events": {
        "description": "캘린더 일정",
        "columns": {
            "id": "UUID PK",
            "user_id": "소유자 (FK → users.id)",
            "title": "일정 제목",
            "description": "설명",
            "event_date": "날짜 (DATE)",
            "start_time": "시작 시간 (HH:MM)",
            "end_time": "종료 시간",
            "location": "장소",
            "is_company": "전사 일정 여부 (boolean)",
        },
        "sample_queries": [
            "오늘 일정 → SELECT title, start_time, location FROM calendar_events WHERE user_id='{user_id}' AND event_date=CURRENT_DATE",
        ],
    },
    "meeting_rooms": {
        "description": "회의실 목록",
        "columns": {
            "id": "UUID PK",
            "name": "회의실 이름 (대회의실 A, 소회의실 1 등)",
            "floor": "층",
            "capacity": "수용인원",
            "equipment": "장비 (프로젝터, 화이트보드 등)",
        },
    },
    "room_reservations": {
        "description": "회의실 예약",
        "columns": {
            "id": "UUID PK",
            "room_id": "회의실 (FK → meeting_rooms.id)",
            "user_id": "예약자 (FK → users.id)",
            "title": "예약 제목",
            "reserve_date": "예약 날짜 (DATE)",
            "start_time": "시작 시간",
            "end_time": "종료 시간",
            "attendees": "참석자",
        },
        "relations": "room_id → meeting_rooms.id, user_id → users.id",
    },
    "documents": {
        "description": "결재함 (보고서/기안 문서)",
        "columns": {
            "id": "UUID PK",
            "user_id": "기안자 (FK → users.id)",
            "title": "보고서 제목",
            "category": "분류 (AB테스트/KPI/알고리즘/고객분석/콘텐츠/주간동향)",
            "content": "보고서 전문",
            "author": "원 작성자 (이름 직급)",
            "status": "상태 (draft/submitted/approved/rejected)",
            "file_name": "첨부파일명",
            "submitted_at": "제출일시",
        },
        "sample_queries": [
            "AB테스트 보고서 → SELECT title, author, submitted_at FROM documents WHERE category='AB테스트' ORDER BY submitted_at DESC",
        ],
    },
    "assignments": {
        "description": "온보딩 과제 (멘토→신입)",
        "columns": {
            "id": "UUID PK",
            "title": "과제 제목",
            "description": "설명",
            "created_by": "출제자 user_id",
            "assigned_to": "수행자 user_id",
            "status": "상태 (pending/submitted/completed)",
            "due_date": "마감일",
            "submission": "제출물",
            "feedback": "피드백",
        },
    },
    "survey_questions": {
        "description": "온보딩 설문 질문 (분기별)",
        "columns": {
            "quarter": "분기 (0=1개월, 1=2개월, ...)",
            "quarter_label": "분기 라벨",
            "stage_name": "단계명",
            "q1": "질문1", "q2": "질문2", "q3": "질문3",
            "free_question": "자유 질문",
        },
    },
    "survey_responses": {
        "description": "온보딩 설문 응답",
        "columns": {
            "user_id": "응답자",
            "quarter": "분기",
            "q1_score": "질문1 점수 (1-5)",
            "q2_score": "질문2 점수",
            "q3_score": "질문3 점수",
            "free_answer": "자유 답변",
            "analysis": "AI 분석 결과",
            "status": "상태 (pending/in_progress/completed)",
        },
    },
}

# 챗봇에서 접근 불가능한 테이블
RESTRICTED_TABLES = {"feedback", "good_answers", "conversations", "messages", "pending_notifications", "rank_levels"}

# SQL 생성 시 안전 규칙
SAFETY_RULES = """
## SQL 생성 규칙
1. SELECT만 허용. INSERT/UPDATE/DELETE/DROP/ALTER/TRUNCATE 절대 금지
2. 결과는 최대 20행으로 제한 (LIMIT 20)
3. password_hash 컬럼은 절대 조회 금지
4. {user_id}는 현재 로그인한 사용자의 UUID로 치환됨
5. JOIN은 명시된 관계(relations)만 사용
6. 날짜 비교는 CURRENT_DATE 사용
7. 집계 함수(COUNT, SUM, AVG) 사용 가능
"""


def build_schema_prompt(user_id: str) -> str:
    """LLM에게 전달할 메타데이터 프롬프트 생성"""
    lines = [
        "# DataHub: 키움증권 사내 DB 스키마\n",
        f"현재 사용자 ID: {user_id}\n",
        SAFETY_RULES,
        "\n## 테이블 정보\n",
    ]

    for table, meta in TABLE_METADATA.items():
        if table in RESTRICTED_TABLES:
            continue
        lines.append(f"### {table} — {meta['description']}")
        lines.append("컬럼:")
        for col, desc in meta.get("columns", {}).items():
            lines.append(f"  - {col}: {desc}")
        if "relations" in meta:
            lines.append(f"관계: {meta['relations']}")
        if "sample_queries" in meta:
            lines.append("예시:")
            for sq in meta["sample_queries"]:
                lines.append(f"  {sq}")
        lines.append("")

    return "\n".join(lines)
