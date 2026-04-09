# Chat-Ki-S 시스템 아키텍처

> 최종 업데이트: 2026-04-03
> 작성자: CTO Agent

---

## 1. 서비스 개요

Chat-Ki-S는 키움증권 포털 내 새 탭(iframe 또는 탭 확장)으로 동작하는 신입사원 온보딩 지원 챗봇이다.
별도 로그인 없이 포털 세션/토큰을 재사용하고, FAQ·내부 문서 기반 RAG 파이프라인으로 답변을 생성한다.

---

## 2. 시스템 구성 다이어그램

```
키움증권 포털
┌──────────────────────────────────────────────────────────┐
│  브라우저 (포털 탭)                                        │
│  ┌──────────────────────────────────────────────────┐    │
│  │  Next.js Frontend  (port 3000)                   │    │
│  │                                                  │    │
│  │  - /chat      풀페이지 챗 UI                     │    │
│  │  - 플로팅 컴포넌트 (최소화 시)                   │    │
│  │  - 포털 세션 토큰 → Authorization 헤더           │    │
│  └────────────┬─────────────────────────────────────┘    │
└───────────────┼──────────────────────────────────────────┘
                │ HTTP/REST  +  WebSocket (streaming)
                ▼
┌──────────────────────────────────────────────────────────┐
│  Fastify Backend  (port 4000)                            │
│                                                          │
│  - 세션 토큰 검증 (JWT / 포털 세션 미들웨어)              │
│  - REST: /api/me, /api/chat, /api/feedback               │
│  - WS:   /api/conversations/:id/stream                   │
│  - DB: PostgreSQL (conversations, messages, users)       │
│  - AI 서비스 프록시 역할                                  │
└────────────────┬─────────────────────────────────────────┘
                 │ HTTP (내부망)
                 ▼
┌──────────────────────────────────────────────────────────┐
│  FastAPI AI Service  (port 8001)                         │
│                                                          │
│  - /chat         LLM 호출 + RAG 결합                     │
│  - /chat/stream  SSE/chunked 스트리밍 응답               │
│  - /search       ChromaDB 시맨틱 검색                    │
│  - /documents/*  FAQ·문서 ingestion                      │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  ChromaDB  (port 8000)  — 벡터 DB                │   │
│  │  OpenAI API (외부)       — 임베딩 + LLM           │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
                 │
┌────────────────▼──────────────────────────────────────────┐
│  PostgreSQL (port 5432)                                    │
│  - users, conversations, messages                          │
└────────────────────────────────────────────────────────────┘
```

---

## 3. 포털 세션 연동 방식

### MVP 접근 방식
포털이 Chat-Ki-S 탭을 열 때 포털 JWT 또는 세션 토큰을 URL 파라미터 또는 `postMessage`로 전달한다.
Frontend는 이 토큰을 `Authorization: Bearer <token>` 헤더로 백엔드에 전달하고,
Backend의 `authenticate` 미들웨어가 토큰을 검증한다.

```
포털 → (token) → Frontend → (Bearer token) → Backend → 검증 → 사용자 식별
```

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

## 4. 서비스 경계 및 책임 분리

| 레이어 | 기술 | 책임 | 금지 사항 |
|--------|------|------|-----------|
| Frontend (Next.js) | React, Tailwind CSS | UI 렌더링, 사용자 입력, API 호출 | LLM 직접 호출 금지 |
| Backend (Fastify) | Node.js, TypeScript, Drizzle ORM | 인증, 비즈니스 로직, DB, AI 프록시 | - |
| AI Service (FastAPI) | Python, LangChain, ChromaDB | RAG 파이프라인, 임베딩, LLM 오케스트레이션 | 외부 직접 노출 금지 (백엔드 경유) |
| PostgreSQL | - | 사용자, 대화, 메시지 영속 | - |
| ChromaDB | - | 벡터 임베딩 저장/검색 | - |

---

## 5. 레포 구조

```
chat-ki-s/
├── apps/
│   ├── frontend/          # Next.js 14 App Router
│   │   ├── src/
│   │   │   ├── app/       # 페이지 (chat, login, root)
│   │   │   ├── components/ # ChatInput, Message, FloatingChat 등
│   │   │   └── lib/       # api.ts (fetch 래퍼)
│   │   ├── e2e/           # Playwright E2E 테스트
│   │   └── Dockerfile
│   ├── backend/           # Fastify Node.js API
│   │   ├── src/
│   │   │   ├── routes/    # auth, users, conversations, rag
│   │   │   ├── db/        # Drizzle schema, migrate, index
│   │   │   └── types/     # Fastify 타입 확장
│   │   └── Dockerfile
│   └── ai/                # Python FastAPI RAG 서비스
│       ├── app/
│       │   ├── routes/    # documents, search
│       │   ├── ingestion.py
│       │   ├── search.py
│       │   ├── embeddings.py
│       │   └── chroma_client.py
│       ├── main.py
│       └── Dockerfile
├── packages/
│   └── shared/            # 공용 TypeScript 타입
│       └── src/index.ts   # User, Message, Conversation, ChatMode 등
├── docs/                  # 아키텍처, API 명세, 개발 우선순위
├── data/                  # FAQ/문서 원본 (ingestion 대상)
├── docker-compose.yml
└── package.json           # npm workspace 루트
```

---

## 6. 브랜치 전략

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

## 7. 환경 변수 규칙

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
| `EMBED_MODEL` | 임베딩 모델 | `text-embedding-3-small` |
| `LLM_MODEL` | LLM 모델 | `gpt-4o-mini` |

---

## 8. 로컬 개발 실행

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
