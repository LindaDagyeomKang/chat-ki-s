# Chat-Ki-S

**키움증권 신입사원 온보딩 지원 챗봇 + 가상 인트라넷**

사내 문서 기반 RAG, OpenAI Function Calling 23개 도구, 자연어-SQL 변환(DataHub)을 결합한 AI 챗봇과 9개 서브시스템을 갖춘 가상 인트라넷 플랫폼입니다.

---

## System Architecture

(추후 png 추가 예정)

---

## Technical Flow

(추후 png 추가 예정)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 14, React 18, Tailwind CSS, TypeScript |
| **Backend** | Fastify 4, Drizzle ORM, JWT + bcrypt, WebSocket |
| **AI Service** | FastAPI, LangChain, OpenAI GPT-4o-mini, Function Calling |
| **Vector DB** | ChromaDB (text-embedding-3-small, cosine similarity) |
| **Database** | PostgreSQL 16 (18 tables) |
| **Infra** | Docker Compose, Railway |

---

## Features

### AI Chatbot
- **Function Calling** -- 23개 도구로 메일 조회, 연차 신청, 담당자 검색, 금융 용어, 일정 관리 등 자동 처리
- **RAG** -- 사내 문서/규정/가이드를 벡터화하여 의미 기반 검색 후 답변 생성
- **DataHub** -- 기존 도구로 불가능한 집계/통계 질문을 자연어-SQL 변환으로 유연 대응 (2중 검증)
- **Page Context** -- 메일/공지를 보면서 "이 메일 요약해줘" 가능
- **Feedback Loop** -- 사용자 피드백을 수집하여 good_answers 테이블에 학습 데이터 축적

### Virtual Intranet
- **전자우편** -- 수신함, 발신함, 별표, 임시저장, 휴지통
- **공지게시판** -- 카테고리별 필터, 인기 공지, 작성
- **캘린더** -- 개인/전사 일정, 팀원 생일/연차 표시
- **결재함** -- 보고서 조회, 결재 상태 관리
- **휴가/경비** -- 연차 신청/승인, 경비 정산
- **HR/주소록** -- 임직원 약 1,250명 검색, 조직도
- **온보딩** -- 과제 칸반보드, 분기별 설문 + AI 분석
- **회의실** -- 예약 조회/등록
- **지식관리** -- 문서 업로드 시 즉시 벡터화

---

## Documentation

| Document | Description |
|----------|------------|
| [Architecture](docs/architecture.md) | 시스템 구조, 기술 플로우, 데이터 소스, 인증/보안 상세 |
| [API Spec](docs/api-spec.md) | REST/WebSocket API 전체 명세 |
| [Prompt Spec](docs/prompt-spec.md) | LLM 시스템 프롬프트, RAG 파라미터, 톤 가이드 |
| [Dev Priorities](docs/dev-priorities.md) | MVP 개발 로드맵, Gap 분석 |

---

## Quick Start

```bash
# Clone
git clone https://github.com/LindaDagyeomKang/chat-ki-s.git
cd chat-ki-s

# Environment
cp .env.example .env
# Edit .env: set OPENAI_API_KEY, DATABASE_URL

# Install & Run
npm install
docker compose up        # PostgreSQL + ChromaDB + all services

# Access
# Frontend:  http://localhost:3000
# Backend:   http://localhost:4000
# AI:        http://localhost:8001
```

### Test Accounts

| Employee ID | Name | Password | Department |
|-------------|------|----------|-----------|
| 20260001 | 전호철 | jhc0001 | 주식운용팀 |
| 20260002 | 진강연 | jky0002 | 인사이트랩팀 |
| 20260003 | 이소현 | lsh0003 | 인사팀 |
| 20260004 | 박진영 | jyp0004 | 혁신성장리서치팀 |
| 20260005 | 강다겸 | kdg0005 | AIX팀 |
| 20260006 | 김지원 | kjw0006 | ESG추진팀 |
