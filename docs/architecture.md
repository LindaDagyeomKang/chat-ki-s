# Chat-Ki-S System Architecture

> Last updated: 2026-04-12

---

## 1. Overview

Chat-Ki-S는 키움증권 신입사원 온보딩을 지원하는 AI 챗봇 + 가상 인트라넷 플랫폼이다.
사내 문서 기반 RAG, OpenAI Function Calling 23개 도구, 자연어→SQL 변환(DataHub)을 결합하여
신입사원의 업무 질문에 즉시 답변하고, 인트라넷 업무를 챗봇으로 처리한다.

(추후 png 추가 예정)

---

## 2. Service Boundary

| Layer | Tech | Responsibility |
|-------|------|---------------|
| **Frontend** | Next.js 14, React 18, Tailwind CSS | UI, 인트라넷 9개 서브시스템, 플로팅 챗봇 |
| **Backend** | Fastify 4, Drizzle ORM, bcrypt | 18 REST Routes, WebSocket, JWT 인증, DataHub 2차 검증 |
| **AI Service** | FastAPI, LangChain, OpenAI | Function Calling 23 Tools, RAG, DataHub SQL 생성+1차 검증 |
| **PostgreSQL 16** | Drizzle ORM | 정형 데이터 18개 테이블 (users, mails, leaves, expenses ...) |
| **ChromaDB** | text-embedding-3-small | 비정형 문서 벡터 저장/검색 (cosine, Top-5) |
| **OpenAI API** | GPT-4o-mini | LLM 답변 생성 + 임베딩 변환 |

> AI Service는 외부 직접 노출 금지 — 반드시 Backend를 경유한다.

---

## 3. Technical Flow

사용자 질문이 처리되는 전체 파이프라인이다.

(추후 png 추가 예정)

### 3-1. Phase 1 — LLM Tool Selection

사용자 질문이 입력되면 GPT-4o-mini가 OpenAI Function Calling으로 23개 도구 중 적절한 것을 자동 선택한다.

### 3-2. Phase 2 — Processing (3개 경로)

**A. Structured Data (Function Calling 23 Tools)**

| Category | Count | Tools |
|----------|-------|-------|
| Query | 8 | get_mails, get_leave_balance, get_expense_history, get_profile, get_schedule, get_notices, get_assignments, get_documents |
| Search | 7 | search_employees, search_documents, search_glossary, check_leave_status, find_substitute, check_room_availability, list_departments |
| Action | 5 | submit_leave, submit_expense, add_calendar_event, book_room, draft_email |
| Survey | 2 | start_survey, submit_survey_answer |
| DB | 1 | query_db (DataHub fallback) |

Fastify 백엔드가 하드코딩된 SQL 쿼리를 PostgreSQL에 즉시 실행한다.

**B. Unstructured Data (ChromaDB RAG)**

1. 문서 업로드 → 텍스트 추출 (PDF, DOCX, TXT) → 청크 분할 (1,000자, overlap 200) → 임베딩 → ChromaDB 저장
2. 사용자 질문 → 임베딩 변환 → 코사인 유사도 검색, Top-5 반환
3. 유사도 점수 분기:
   - ≥ 0.70 고신뢰 → 답변 생성
   - ≥ 0.35 저신뢰 → 참고 수준 답변
   - < 0.35 → 폴백 응답

**C. DataHub (NL-to-SQL, 5 Steps)**

기존 23개 도구로 불가능한 집계/통계 질문을 처리한다.

| Step | Process | Detail |
|------|---------|--------|
| 1 | Metadata | 12개 테이블 스키마, FK 관계, 샘플 쿼리 로드. 접근 금지 테이블 6개 제외 |
| 2 | SQL Generation | GPT-4o-mini (temp=0)가 PostgreSQL SELECT 쿼리 작성 |
| 3 | 1st Validation (AI) | Python `validate_sql()`: SELECT only, 위험 키워드 10종 차단, password_hash 차단, LIMIT 20 자동 추가 |
| 4 | 2nd Validation (Backend) | Fastify 재검증: SELECT 재확인, 위험 SQL 재검사, 민감 컬럼 차단, JWT 인증 필수 |
| 5 | Execution | PostgreSQL 실행, 결과 최대 20행 반환 |

### 3-3. Phase 3 — Response & Feedback

- LLM이 조회 결과를 한국어 자연어로 변환하여 사용자에게 전달
- 사용자 피드백 수집:
  - **Helpful** → `feedback` 테이블 저장 + `good_answers` 테이블에 질문+답변 쌍 자동 축적 (학습 데이터)
  - **Unhelpful** → `feedback` 테이블 저장 (개선 참고)

---

## 4. Data Source Mapping

신입사원 설문조사에서 도출된 핵심 정보 수요와 데이터 매핑:

| Information Need | Source Format | Storage | Chatbot Access |
|-----------------|---------------|---------|---------------|
| 업무 매뉴얼 | .docx/.md (25건) | ChromaDB | `search_documents` → RAG |
| 업무 담당자 | 임직원 ~1,250명 | PostgreSQL `employees` | `search_employees` |
| 결재 방법 / 사내 규정 | .docx (규정 가이드) | ChromaDB | `search_documents` → RAG |
| 자료 위치 | 문서 메타데이터 | ChromaDB `source` field | `search_documents` 출처 표시 |
| 히스토리 | 결재문서, 메일 등 | PostgreSQL | `get_documents`, `get_mails` |
| 툴 사용법 | PC/IT 가이드 (.docx) | ChromaDB | `search_documents` → RAG |
| 사내 프로그램 | 직접 연동 없음 | ChromaDB (사용법 문서) | `search_documents` → RAG |

### File Storage Policy

| Type | Policy |
|------|--------|
| **Seed docs** | `data/seed/` 25건, 서비스 기동 시 자동 벡터화. 원본 다운로드 가능 |
| **Uploaded docs** | 즉시 벡터화, 원본 파일 미보관 (별도 스토리지 없음) |
| **Future** | 원본 보관 필요 시 오브젝트 스토리지(S3 등) 도입 검토 |

---

## 5. Authentication & Security

### Auth Flow

```
Portal → (postMessage + token) → Frontend → (HttpOnly Cookie) → Backend → JWT Verify
```

| Item | Implementation |
|------|---------------|
| **Password hashing** | bcrypt (12 rounds), SHA-256 레거시 자동 마이그레이션 |
| **Token storage** | HttpOnly Cookie (XSS 탈취 방지), localStorage 폴백 |
| **CORS** | 환경변수 `CORS_ORIGIN` 기반 allowlist, 개발환경만 전체 허용 |
| **Auth mode** | `AUTH_MODE=local` (개발: 사번+비밀번호) / `AUTH_MODE=portal` (프로덕션: 포털 세션) |
| **Token transport** | URL 파라미터 **금지**, `postMessage` origin 검증 필수 |
| **DataHub SQL** | AI 1차 검증 + Backend 2차 검증, SELECT only, password_hash 차단 |

---

## 6. API Overview

> 전체 명세: [docs/api-spec.md](api-spec.md)

### Backend (Fastify, Port 4000)

| Category | Endpoints |
|----------|----------|
| Auth | `POST /api/auth/login`, `POST /api/auth/logout`, `POST /api/auth/refresh` |
| User | `GET /api/users/me`, `GET /api/users/me/profile`, `PATCH /api/users/me/profile` |
| Chat | `POST /api/chat`, `GET/POST /api/conversations`, `WS /api/conversations/:id/stream` |
| Feedback | `POST /api/feedback`, `GET /api/good-answers` |
| Intranet | `/api/mails`, `/api/notices`, `/api/leaves`, `/api/expenses`, `/api/calendar`, `/api/approvals`, `/api/assignments`, `/api/employees`, `/api/rooms`, `/api/documents` |
| AI Proxy | `POST /api/rag`, `POST /api/agent/execute`, `POST /api/datahub/execute` |

### AI Service (FastAPI, Port 8001)

| Endpoint | Purpose |
|----------|---------|
| `POST /chat` | RAG + LLM 답변 |
| `POST /chat/stream` | 스트리밍 응답 |
| `POST /search` | 시맨틱 검색 |
| `POST /documents/ingest` | 문서 업로드 → 벡터화 |
| `POST /agent/execute` | Function Calling 실행 |
| `POST /datahub/query` | 자연어→SQL 생성 + 검증 |
| `POST /glossary/search` | 금융용어 검색 |
