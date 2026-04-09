# Chat-Ki-S 개발 우선순위 및 Agent 인터페이스 정의

> 최종 업데이트: 2026-04-03
> 작성자: CTO Agent

---

## 1. 개발 우선순위 (MVP 기준)

### Phase 1 — 코어 플로우 완성 (최우선)

MVP의 핵심 경로: **사용자가 질문하면 AI가 답변을 반환하는 E2E 흐름**

| # | 작업 | 담당 | 의존성 | 상태 |
|---|------|------|--------|------|
| 1 | AI 서비스에 `/chat` 및 `/chat/stream` 엔드포인트 추가 | AI Agent | - | 미구현 |
| 2 | Backend `/api/chat` 라우트 추가 (또는 `/api/conversations/:id/messages` alias) | Backend Agent | AI `/chat` | 부분 구현 |
| 3 | Backend WebSocket 스트리밍 AI 연동 완성 | Backend Agent | AI `/chat/stream` | 부분 구현 |
| 4 | Frontend 채팅 페이지 (풀페이지) 완성 | Frontend Agent | Backend `/api/chat` | 부분 구현 |
| 5 | Frontend 플로팅 챗 컴포넌트 | Frontend Agent | 4 완료 후 | 미구현 |

### Phase 2 — 포털 연동 및 데이터 (높음)

| # | 작업 | 담당 | 의존성 |
|---|------|------|--------|
| 6 | 포털 세션 토큰 검증 미들웨어 (AUTH_MODE=portal) | Backend Agent | - |
| 7 | FAQ/문서 초기 ingestion | Content Agent | AI 서비스 `/documents/ingest` |
| 8 | 답변 없을 때 fallback 문구 처리 | AI Agent + Content Agent | - |

### Phase 3 — 피드백 및 품질 (중간)

| # | 작업 | 담당 | 의존성 |
|---|------|------|--------|
| 9 | `POST /api/feedback` 엔드포인트 + DB 스키마 | Backend Agent | - |
| 10 | Frontend 피드백 버튼 (👍 👎) | Frontend Agent | Backend `/api/feedback` |
| 11 | 출처 표시 영역 UI | Frontend Agent | AI 소스 메타데이터 |
| 12 | E2E 테스트 시나리오 작성 | QA Agent | Phase 1-2 완료 후 |

### MVP 범위 밖 (구현 금지)

- 관리자 대시보드 / CMS
- 운영 통계 API
- 추천 질문 고도화
- 파인튜닝 / 멀티턴 에이전트 오케스트레이션
- 권한 매트릭스
- 별도 로그인 화면 (프로덕션)

---

## 2. Agent별 인터페이스 정의

### 2-1. Frontend Agent

**담당**: Next.js 챗 UI 구현

**구현 파일 위치**
```
apps/frontend/src/
├── app/chat/page.tsx        # 풀페이지 챗 메인 (기존)
├── components/
│   ├── ChatInput.tsx        # 입력창 (기존)
│   ├── Message.tsx          # 메시지 컴포넌트 (기존)
│   ├── FloatingChat.tsx     # 플로팅 컴포넌트 (신규 구현 필요)
│   └── FeedbackButtons.tsx  # 👍👎 버튼 (신규 구현 필요)
└── lib/api.ts               # HTTP 클라이언트 (기존)
```

**Backend 의존 엔드포인트**
| 기능 | 호출 API |
|------|----------|
| 사용자 정보 | `GET /api/me` |
| 메시지 전송 (동기) | `POST /api/chat` |
| 메시지 스트리밍 | `WS /api/conversations/:id/stream` |
| 피드백 | `POST /api/feedback` |

**환경 변수**
```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

**인터페이스 계약 (packages/shared)**
```typescript
// 사용하는 타입
import type {
  User,               // GET /api/me 응답
  Message,            // 채팅 메시지
  Conversation,       // 대화 객체
  SendMessageRequest, // POST /api/chat 요청
  SendMessageResponse // POST /api/chat 응답
} from '@chat-ki-s/shared'

// 추가 필요 타입 (Backend Agent와 합의)
interface FeedbackRequest {
  messageId: string
  rating: 1 | -1
  comment?: string
}
interface FeedbackResponse {
  id: string
  messageId: string
  rating: number
  createdAt: Date
}
```

**완료 기준 (Acceptance Criteria)**
- [ ] 풀페이지 채팅 화면에서 메시지 전송 → 스트리밍 응답 표시
- [ ] 플로팅 버튼으로 축소/확대 전환
- [ ] 출처 영역에 `source` 파일명 표시
- [ ] 피드백 버튼 클릭 → 한 번만 허용, 클릭 후 비활성화
- [ ] 로딩 상태 표시 (스피너 또는 타이핑 인디케이터)

---

### 2-2. Backend Agent

**담당**: Fastify API 서버

**구현 파일 위치**
```
apps/backend/src/
├── routes/
│   ├── auth.ts           # 기존
│   ├── users.ts          # 기존 (GET /api/users/me → /api/me alias 추가)
│   ├── conversations.ts  # 기존 (POST /api/chat alias 추가)
│   ├── feedback.ts       # 신규 구현 필요
│   └── rag.ts            # 기존
├── db/
│   └── schema.ts         # feedbacks 테이블 추가 필요
└── middleware/
    └── portalAuth.ts     # 신규 (AUTH_MODE=portal 검증)
```

**필요 구현 사항**

1. **`/api/chat` 라우트 추가**
   - `POST /api/chat` → 내부적으로 conversations/:id/messages 로직 실행
   - `conversationId` 없으면 자동 생성

2. **`/api/me` alias**
   - `GET /api/me` → `GET /api/users/me` 와 동일한 응답

3. **`/api/feedback` 엔드포인트**
   - DB 스키마: `feedbacks(id, messageId, userId, rating, comment, createdAt)`
   - `POST /api/feedback` → 저장 후 201 반환
   - 중복 피드백 방지 (메시지당 사용자 1회)

4. **AI Service `/chat` 연동**
   - conversations.ts의 AI 호출 부분을 `POST /chat` (AI Service)로 연결
   - 응답의 `sources` 필드를 메시지 메타데이터에 포함

5. **포털 세션 미들웨어 (AUTH_MODE=portal)**
   - `middleware/portalAuth.ts`: 포털 토큰 헤더 추출 → 검증 → req.user 설정
   - 환경변수 `AUTH_MODE`로 local/portal 분기

**DB 스키마 추가**
```typescript
// apps/backend/src/db/schema.ts 에 추가
export const feedbacks = pgTable('feedbacks', {
  id: uuid('id').primaryKey().defaultRandom(),
  messageId: uuid('message_id').notNull().references(() => messages.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  rating: integer('rating').notNull(),  // 1 or -1
  comment: text('comment'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})
```

**환경 변수**
```env
PORT=4000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/chat_ki_s
JWT_SECRET=change-in-production
JWT_EXPIRES_IN=7d
AI_SERVICE_URL=http://localhost:8001
AUTH_MODE=local
```

---

### 2-3. AI Agent

**담당**: Python FastAPI RAG 파이프라인

**구현 파일 위치**
```
apps/ai/
├── main.py
└── app/
    ├── routes/
    │   ├── documents.py  # 기존
    │   ├── search.py     # 기존
    │   └── chat.py       # 신규 구현 필요
    ├── chat.py           # LLM 호출 로직 신규
    ├── prompt.py         # 프롬프트 템플릿 신규
    ├── search.py         # 기존
    ├── ingestion.py      # 기존
    ├── embeddings.py     # 기존
    └── chroma_client.py  # 기존
```

**필요 구현 사항**

1. **`POST /chat` 엔드포인트**
```python
class ChatRequest(BaseModel):
    conversationId: str
    message: str
    mode: str = "rag"  # "rag" | "objective"

class Source(BaseModel):
    doc_id: str
    source: str
    page: Optional[int]

class ChatResponse(BaseModel):
    response: str
    sources: List[Source]
```

2. **`POST /chat/stream` 엔드포인트**
   - Chunked HTTP 응답으로 LLM 토큰 스트리밍
   - Backend WebSocket이 이 스트림을 Frontend로 중계

3. **프롬프트 정책**
   - RAG 모드: 검색된 문서 청크를 컨텍스트로 주입
   - 신입사원 친화적 말투 (존댓말, 간결하게)
   - 답변 없을 때 fallback: "죄송합니다, 해당 내용을 찾지 못했어요. HR팀(hr@kiwoom.com)에 문의해 주세요."

4. **`main.py` 라우터 등록**
```python
from app.routes.chat import router as chat_router
app.include_router(chat_router)
```

**환경 변수**
```env
OPENAI_API_KEY=sk-...
CHROMA_HOST=http://localhost:8000
EMBED_MODEL=text-embedding-3-small
LLM_MODEL=gpt-4o-mini
```

---

### 2-4. Content Agent

**담당**: FAQ/문서 구조 + 답변 톤 가이드

**산출물**
```
data/
├── faq/              # FAQ 원본 텍스트/PDF
├── hr-policy/        # 인사 정책 문서
└── onboarding/       # 온보딩 가이드
```

**AI Agent에 제공할 인터페이스**
- ingestion 완료된 문서 목록 (doc_id, source 파일명)
- 답변 톤 가이드: `docs/content-tone-guide.md` (별도 작성)
- Fallback 문구 목록

---

### 2-5. QA Agent

**담당**: 전체 흐름 테스트

**테스트 대상 API**
```
GET  /health                          → 200 ok
GET  /api/me                          → 200 사용자 정보
POST /api/chat (rag mode)             → 200 AI 답변 + 출처
POST /api/chat (question not found)   → 200 fallback 문구
POST /api/feedback (rating=1)         → 201
POST /api/feedback (duplicate)        → 409
WS   /api/conversations/:id/stream    → chunk 스트리밍
```

**E2E 시나리오 (Playwright)**
```
apps/frontend/e2e/
├── auth.spec.ts    # 기존
└── chat.spec.ts    # 확장 필요: 플로팅, 피드백, 출처 표시
```

---

## 3. Agent 간 의존 관계

```
Content Agent
  └→ (문서 ingestion) → AI Agent
                          └→ (POST /chat, /chat/stream) → Backend Agent
                                                            ├→ (POST /api/chat) → Frontend Agent
                                                            └→ (POST /api/feedback) → Frontend Agent
```

**병렬 작업 가능**
- Frontend + Backend: Phase 1 기준으로 API 계약 고정 후 병렬 진행
- AI + Content: RAG 파이프라인 + FAQ 문서 병렬 준비

---

## 4. 현재 코드 상태 요약 (Gap 분석)

| 항목 | 상태 | 필요 작업 |
|------|------|-----------|
| `GET /health` | ✅ 완료 | - |
| `POST /api/auth/login` | ✅ 완료 | - |
| `GET /api/users/me` | ✅ 완료 | `/api/me` alias 추가 |
| `POST /api/chat` | ⚠️ 부분 | `/api/conversations/:id/messages` 존재, alias 필요 |
| `POST /api/feedback` | ❌ 미구현 | 신규 구현 필요 |
| AI `/chat` endpoint | ❌ 미구현 | FastAPI 신규 라우트 |
| AI `/chat/stream` | ❌ 미구현 | FastAPI 신규 라우트 |
| 플로팅 챗 컴포넌트 | ❌ 미구현 | Frontend 신규 구현 |
| 피드백 버튼 UI | ❌ 미구현 | Frontend 신규 구현 |
| 포털 세션 미들웨어 | ❌ 미구현 | Backend 신규 구현 |
| FAQ 문서 ingestion | ❌ 미구현 | Content → AI 작업 |
