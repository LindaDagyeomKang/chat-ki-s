# Chat-Ki-S 시스템 아키텍처

> 최종 업데이트: 2026-04-12 (2차 검토 반영)
> 작성자: CTO Agent
> 변경 이력: 문서 내용 수정 시 반드시 날짜 갱신할 것

---

## 1. 서비스 개요

Chat-Ki-S는 키움증권 신입사원 온보딩을 지원하는 AI 챗봇 + 가상 인트라넷 플랫폼이다.
사내 문서 기반 RAG, OpenAI Function Calling 23개 도구, 자연어→SQL 변환(DataHub)을 결합하여
신입사원의 업무 질문에 즉시 답변하고, 인트라넷 업무(메일, 연차, 경비, 결재 등)를 챗봇으로 처리한다.

---

## 2. 시스템 구성 다이어그램


```
┌──────────────────────────────────────────────────────────────┐
│  브라우저                                                     │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Next.js 14 Frontend  (port 3000)                      │  │
│  │                                                        │  │
│  │  - /chat              풀페이지 챗 UI                   │  │
│  │  - /intranet/*        인트라넷 9개 서브시스템           │  │
│  │    (메일, 공지, 캘린더, 결재, 휴가, 경비,              │  │
│  │     HR, 주소록, 문서관리)                               │  │
│  │  - FloatingChat       인트라넷 내 플로팅 챗봇          │  │
│  │  - /login             사번+비밀번호 로그인             │  │
│  └───────────────┬────────────────────────────────────────┘  │
└──────────────────┼───────────────────────────────────────────┘
                   │ HTTP/REST  +  WebSocket (streaming)
                   ▼
┌──────────────────────────────────────────────────────────────┐
│  Fastify Backend  (port 4000)                                │
│                                                              │
│  인증: JWT (개발: 사번+비밀번호 / 프로덕션: 포털 세션)       │
│                                                              │
│  REST API 18개 라우트 (대표 엔드포인트만 기재):               │
│  - 인증:    /api/auth/login, /api/users/me                   │
│  - 챗봇:    /api/chat, /api/conversations, /api/feedback     │
│  - 인트라넷: /api/mails, /api/notices, /api/leaves,          │
│             /api/expenses, /api/calendar, /api/approvals,    │
│             /api/assignments, /api/employees, /api/rooms,    │
│             /api/documents                                   │
│  - AI연동:  /api/rag, /api/agent/execute, /api/datahub/execute│
│  - WS:     /api/conversations/:id/stream                     │
│  ※ 전체 API 명세: docs/api-spec.md 참조                      │
│                                                              │
│  DataHub 2차 검증:                                            │
│  - AI가 생성한 SQL의 안전성 재검증 (SELECT만, 민감컬럼 차단)  │
│  - 통과 시 PostgreSQL 직접 실행, 결과 20행 제한              │
└───────────────┬──────────────────────────────────────────────┘
                │ HTTP (내부망)
                ▼
┌──────────────────────────────────────────────────────────────┐
│  FastAPI AI Service  (port 8001)                             │
│                                                              │
│  LLM: GPT-4o-mini (temperature=0.1, max_tokens=512)         │
│                                                              │
│  핵심 기능:                                                   │
│  - Function Calling: 23개 도구 중 적절한 도구 자동 선택       │
│  - RAG: ChromaDB 벡터 검색 + LLM 답변 생성                   │
│  - DataHub: 자연어→SQL 변환 + 1차 검증                       │
│  - Agent: 도구 조합 실행 + 결과 자연어 변환                   │
│                                                              │
│  라우트:                                                      │
│  - /chat, /chat/stream    RAG + LLM 답변                     │
│  - /search                시맨틱 검색                        │
│  - /documents/ingest      문서 업로드 → 벡터화               │
│  - /agent/execute         Function Calling 실행              │
│  - /datahub/query         자연어→SQL 생성 + 검증             │
│  - /glossary/search       금융용어 검색                      │
└───────────────┬──────────────────────────────────────────────┘
                │
    ┌───────────┴───────────┐
    ▼                       ▼
┌─────────────────┐  ┌─────────────────────────────────────────┐
│  ChromaDB       │  │  PostgreSQL 16  (port 5432)              │
│  (port 8000)    │  │                                          │
│                 │  │  테이블 (12개 + 시스템 6개):              │
│  벡터 DB        │  │  - 사용자: users, employees (약 1,250명) │
│  - 임베딩 모델: │  │  - 챗봇: conversations, messages         │
│    text-        │  │  - 피드백: feedback, good_answers        │
│    embedding-   │  │  - 인트라넷: mails, notices,             │
│    3-small      │  │    leave_requests, expenses,             │
│  - 컬렉션:     │  │    calendar_events, assignments,         │
│    chat_ki_s_   │  │    documents, meeting_rooms,             │
│    docs         │  │    room_reservations                     │
│  - 청크:       │  │  - 설문: survey_questions,                │
│    1,000자     │  │    survey_responses                       │
│    (overlap    │  │  - 용어: glossary (약 1,600개)             │
│    200자)      │  │                                          │
│  - 유사도:     │  │  접근 제한 테이블 (6개):                  │
│    코사인,     │  │  feedback, good_answers,                  │
│    Top-5       │  │  conversations, messages,                 │
│  - 임계값:     │  │  pending_notifications, rank_levels       │
│    ≥0.70 고신뢰│  │                                          │
│    ≥0.35 저신뢰│  └───────────────────────────────────────────┘
│    <0.35 폴백  │
│                │
│  시드 데이터:  │
│  FAQ 25건      │
│  자동 인덱싱   │
└─────────────────┘
```

---

## 3. 기술 플로우 — 사용자 질문 처리

### 3-1. 전체 흐름

```
사용자 질문 입력
       │
       ▼
LLM 도구 선택 (OpenAI Function Calling)
GPT-4o-mini가 23개 도구 중 적절한 도구 자동 선택
       │
       ├─────────────────┬──────────────────┐
       ▼                 ▼                  ▼
A. 정형 데이터     B. 비정형 데이터    C. DataHub
(Function Calling  (ChromaDB RAG)     (자연어→SQL)
 23개 도구)
       │                 │                  │
       ▼                 ▼                  ▼
  PostgreSQL        벡터 검색          5단계 파이프라인
  하드코딩 쿼리     유사도 매칭        (아래 상세)
  즉시 실행
       │                 │                  │
       └─────────────────┴──────────────────┘
                         │
                         ▼
              LLM 자연어 답변 생성 (GPT-4o-mini)
              조회 결과 → 한국어 자연어 변환
                         │
                         ▼
              사용자에게 표시 + 피드백 수집
```

### 3-2. A. 정형 데이터 — Function Calling 도구 23개

LLM이 사용자 질문을 분석하여 아래 도구 중 적절한 것을 자동 호출한다.
실제 실행은 Fastify 백엔드에서 PostgreSQL 쿼리로 수행한다.

| 분류 | 도구 (개수) | 설명 |
|------|------------|------|
| 조회 (8) | get_mails, get_leave_balance, get_expense_history, get_profile, get_schedule, get_notices, get_assignments, get_documents | 메일·연차·경비·프로필·일정·공지·과제·결재문서 조회 |
| 검색 (7) | search_employees, search_documents, search_glossary, check_leave_status, find_substitute, check_room_availability, list_departments | 임직원·사내문서·금융용어·휴가확인·대리인·회의실·부서목록 검색 |
| 실행 (5) | submit_leave, submit_expense, add_calendar_event, book_room, draft_email | 연차신청·경비정산·일정등록·회의실예약·메일작성 |
| 설문 (2) | start_survey, submit_survey_answer | 온보딩 설문 시작·답변 제출 |
| DB (1) | query_db | DataHub (자연어→SQL), 집계/통계/분석 질문 처리 |

### 3-3. B. 비정형 데이터 — ChromaDB RAG 파이프라인

**문서 수집 (Ingestion):**
1. 문서 업로드 (PDF, DOCX, TXT/MD 지원)
2. 텍스트 추출 (pypdf, python-docx)
3. 청크 분할 (RecursiveCharacterTextSplitter, 1,000자, overlap 200자)
4. 임베딩 변환 (OpenAI text-embedding-3-small)
5. ChromaDB 저장 (컬렉션: `chat_ki_s_docs`)

**검색 (Retrieval):**
1. 사용자 질문 → 임베딩 벡터 변환
2. ChromaDB 코사인 유사도 검색, Top-5 반환
3. 유사도 점수에 따른 분기:
   - ≥ 0.70: 고신뢰 → 검색 결과 기반 답변 생성
   - ≥ 0.35: 저신뢰 → 참고 수준 답변 (불확실성 안내)
   - < 0.35: 폴백 → 정보 없음 안내

**시드 데이터:** 서비스 시작 시 `data/seed/` 디렉토리의 FAQ 문서 25건 자동 인덱싱

### 3-4. C. DataHub — 자연어→SQL 변환 (5단계)

기존 23개 도구로 처리할 수 없는 집계/분석/통계 질문을 처리한다.

```
① 메타데이터 참조
   - 12개 테이블의 스키마 로드 (컬럼 설명, FK 관계, 샘플 쿼리)
   - 접근 금지 테이블 6개 제외
   - 금지 컬럼 (password_hash) 명시
       │
       ▼
② SQL 생성 (GPT-4o-mini, temperature=0)
   - 메타데이터 + 안전 규칙을 system prompt로 전달
   - LLM이 PostgreSQL SELECT 쿼리 작성
   - 응답 형식: "SQL: ... / 설명: ..."
       │
       ▼
③ 1차 검증 — AI 서비스 (Python FastAPI)
   validate_sql() 함수:
   - SELECT 시작 여부 확인
   - 위험 키워드 10종 정규식 차단 (INSERT/UPDATE/DELETE/DROP/ALTER/TRUNCATE/CREATE/GRANT/REVOKE/EXEC)
   - password_hash 컬럼 접근 차단
   - 제한 테이블 6개 접근 차단
   - LIMIT 없으면 자동 추가 (20행)
       │
       ▼
④ 2차 검증 — 백엔드 (Node.js Fastify)
   datahub.ts 라우트:
   - SELECT 시작 재확인
   - 위험 SQL 정규식 재검사
   - 민감 컬럼 (password_hash) 접근 차단
   - 인증된 사용자만 실행 (JWT 필수)
       │
       ▼
⑤ PostgreSQL 실행
   - 검증 통과한 SELECT 쿼리 실행
   - 결과 최대 20행 반환
```

### 3-5. 피드백 수집 흐름

```
사용자 답변 확인
       │
       ├── "도움 됐어요" (helpful)
       │       │
       │       ├→ feedback 테이블: userId, messageId, rating, comment 저장
       │       └→ good_answers 테이블: 해당 질문+답변 쌍 자동 저장
       │              → 향후 답변 품질 개선 학습 데이터로 활용
       │
       └── "도움 안 됐어요" (unhelpful)
               │
               └→ feedback 테이블: rating + comment 저장
                      → 답변 개선 참고 데이터
```

---

## 4. 포털 세션 연동 방식

### MVP 접근 방식
포털이 Chat-Ki-S 탭을 열 때 포털 JWT 또는 세션 토큰을 `postMessage`로 전달한다.
Frontend는 이 토큰을 `Authorization: Bearer <token>` 헤더로 백엔드에 전달하고,
Backend의 `authenticate` 미들웨어가 토큰을 검증한다.

```
포털 → (postMessage + token) → Frontend → (Bearer token) → Backend → 검증 → 사용자 식별
```

**보안 정책:**
- URL 파라미터를 통한 토큰 전달은 **금지** (브라우저 히스토리/서버 로그 노출 위험)
- `postMessage` 수신 시 반드시 `origin` 검증 (허용된 포털 도메인만 수락)
- 토큰 만료 정책: 포털 세션 만료 시 Chat-Ki-S 세션도 자동 만료

### 현재 구현 상태
현재 코드베이스는 사번(employeeId) + 비밀번호 기반 JWT 로그인(`POST /api/auth/login`)을 사용한다.
MVP 출시 전 Backend에 포털 세션 검증 미들웨어를 추가해야 한다.
`POST /api/auth/login`은 **개발/테스트 환경 전용**으로 남겨두고,
프로덕션에서는 포털 세션 토큰 검증 경로를 사용한다.

### 환경 변수로 모드 분기
```
AUTH_MODE=portal   # 포털 세션 검증 (프로덕션)
AUTH_MODE=local    # 사번+비밀번호 JWT (개발)
```

---

## 5. 서비스 경계 및 책임 분리

| 레이어 | 기술 | 책임 | 금지 사항 |
|--------|------|------|-----------|
| Frontend (Next.js 14) | React 18, Tailwind CSS, TypeScript | UI 렌더링, 인트라넷 9개 서브시스템, 챗봇 UI | LLM 직접 호출 금지 |
| Backend (Fastify 4) | Node.js, TypeScript, Drizzle ORM | 인증, REST API 18개, WebSocket 스트리밍, DataHub 2차 검증, DB CRUD | - |
| AI Service (FastAPI) | Python, LangChain, OpenAI, ChromaDB | Function Calling 23개 도구, RAG, DataHub SQL 생성+1차 검증, Agent | 외부 직접 노출 금지 (백엔드 경유) |
| PostgreSQL 16 | Drizzle ORM | 정형 데이터 12개 테이블 + 시스템 6개 테이블 영속 | - |
| ChromaDB | - | 비정형 문서 벡터 임베딩 저장/검색 | - |

---

## 6. 레포 구조

```
chat-ki-s/
├── apps/
│   ├── frontend/            # Next.js 14 App Router
│   │   ├── src/
│   │   │   ├── app/         # 페이지
│   │   │   │   ├── chat/    # 풀페이지 챗 UI
│   │   │   │   ├── login/   # 로그인
│   │   │   │   └── intranet/# 인트라넷 9개 서브시스템
│   │   │   │       ├── mails/       # 메일
│   │   │   │       ├── notices/     # 공지사항
│   │   │   │       ├── calendar/    # 캘린더
│   │   │   │       ├── knowledge/   # 지식관리 (문서 업로드→벡터화)
│   │   │   │       ├── leaves/      # 휴가/연차
│   │   │   │       ├── expenses/    # 경비정산
│   │   │   │       ├── approvals/   # 결재함
│   │   │   │       ├── hr/          # HR
│   │   │   │       ├── addressbook/ # 주소록
│   │   │   │       ├── documents/   # 문서함
│   │   │   │       ├── onboarding/  # 온보딩 칸반
│   │   │   │       └── rooms/       # 회의실
│   │   │   ├── components/  # FloatingChat, Message, ChatInput 등
│   │   │   ├── contexts/    # PageContext (현재 페이지 컨텍스트)
│   │   │   └── lib/         # api.ts (fetch 래퍼)
│   │   └── Dockerfile
│   ├── backend/             # Fastify Node.js API
│   │   ├── src/
│   │   │   ├── routes/      # 18개 라우트 파일
│   │   │   │   ├── auth.ts, users.ts
│   │   │   │   ├── chat.ts, conversations.ts, feedback.ts
│   │   │   │   ├── mails.ts, notices.ts, leaves.ts, expenses.ts
│   │   │   │   ├── calendar.ts, approvals.ts, assignments.ts
│   │   │   │   ├── employees.ts, rooms.ts, documents.ts
│   │   │   │   ├── rag.ts, agentExecute.ts, datahub.ts
│   │   │   ├── db/          # Drizzle schema (18개 테이블), migrate, index
│   │   │   └── types/       # Fastify 타입 확장
│   │   └── Dockerfile
│   └── ai/                  # Python FastAPI RAG + Agent 서비스
│       ├── app/
│       │   ├── routes/      # chat, search, documents, agent, datahub_query, glossary
│       │   ├── tools.py     # Function Calling 23개 도구 정의
│       │   ├── agent.py     # LLM Agent (도구 조합 실행)
│       │   ├── datahub.py   # 테이블 메타데이터 + 안전 규칙
│       │   ├── ingestion.py # 문서 파싱 + 청크 분할
│       │   ├── search.py    # ChromaDB 시맨틱 검색
│       │   ├── embeddings.py
│       │   ├── chroma_client.py
│       │   ├── keyword_router.py
│       │   └── config.py    # 설정 (청크 크기, 임계값 등)
│       ├── main.py
│       ├── requirements.txt
│       └── Dockerfile
├── packages/
│   └── shared/              # 공용 TypeScript 타입
│       └── src/index.ts     # User, Message, Conversation, ChatMode 등
├── data/
│   ├── seed/                # FAQ 문서 25건 (자동 인덱싱 대상)
│   └── seed_data/           # 임직원 프로필 약 1,250명, 금융용어 약 1,600개
├── docs/                    # 아키텍처, API 명세, 개발 우선순위
├── docker-compose.yml       # 전체 스택 (5개 서비스)
└── package.json             # npm workspace 루트
```

---

## 7. 브랜치 전략

```
main          # 항상 배포 가능한 상태 유지
├── feature/* # 기능 개발 (예: feature/floating-chat)
├── fix/*     # 버그픽스 (예: fix/session-token-header)
└── docs/*    # 문서 작업 (예: docs/api-spec)
```

- `main` 직접 push 금지 — PR 필수
- PR은 최소 1명 리뷰 후 merge
- 배포: `main` merge → Docker 이미지 빌드 → 스테이징 → 포털 탭 교체

---

## 8. 환경 변수 규칙

### 네이밍 컨벤션
- Backend: `UPPERCASE_SNAKE_CASE`
- Frontend: `NEXT_PUBLIC_` 접두사 (브라우저 노출 허용 변수만)

### Backend 환경 변수

| 변수 | 설명 | 개발 기본값 |
|------|------|-------------|
| `PORT` | 백엔드 포트 | `4000` |
| `DATABASE_URL` | PostgreSQL 연결 | `postgresql://postgres:postgres@localhost:5432/chat_ki_s` |
| `JWT_SECRET` | JWT 서명 키 | `dev-secret` (**프로덕션 반드시 변경**) |
| `JWT_EXPIRES_IN` | 토큰 만료 | `7d` |
| `AI_SERVICE_URL` | AI 서비스 URL | `http://localhost:8001` |
| `AUTH_MODE` | 인증 모드 (`local`\|`portal`) | `local` |
| `NODE_ENV` | 환경 | `development` |

### Frontend 환경 변수

| 변수 | 설명 | 개발 기본값 |
|------|------|-------------|
| `NEXT_PUBLIC_API_URL` | 백엔드 API URL | `http://localhost:4000` |

### AI Service 환경 변수

| 변수 | 설명 | 개발 기본값 |
|------|------|-------------|
| `OPENAI_API_KEY` | OpenAI API 키 | 필수 설정 |
| `CHROMA_HOST` | ChromaDB URL | `http://localhost:8000` |
| `LLM_MODEL` | LLM 모델 | `gpt-4o-mini` |
| `LLM_TEMPERATURE` | LLM 온도 | `0.1` |
| `LLM_MAX_TOKENS` | 최대 토큰 | `512` |
| `CHUNK_SIZE` | 문서 청크 크기 | `1000` |
| `CHUNK_OVERLAP` | 청크 오버랩 | `200` |
| `TOP_K` | 검색 반환 수 | `5` |
| `SCORE_THRESHOLD_HIGH` | 고신뢰 임계값 | `0.70` |
| `SCORE_THRESHOLD_LOW` | 저신뢰 임계값 | `0.35` |

---

## 9. 로컬 개발 실행

```bash
# 전체 스택 (Docker Compose)
docker-compose up

# 개별 실행
npm run dev                         # frontend + backend 동시
cd apps/ai && uvicorn main:app --reload --port 8001

# 포트 요약
# 3000 — Frontend (Next.js)
# 4000 — Backend (Fastify)
# 8001 — AI Service (FastAPI)
# 8000 — ChromaDB
# 5432 — PostgreSQL
```
