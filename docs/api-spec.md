# Chat-Ki-S API 명세

> 최종 업데이트: 2026-04-03
> 버전: MVP v1
> Base URL: `http://localhost:4000` (개발) / `https://chatki-s.kiwoom.internal` (프로덕션)

---

## 인증

모든 보호 엔드포인트는 `Authorization: Bearer <token>` 헤더가 필요하다.

- **개발(AUTH_MODE=local)**: `POST /api/auth/login` → JWT 발급 → 헤더에 첨부
- **프로덕션(AUTH_MODE=portal)**: 포털이 전달한 세션 토큰을 그대로 헤더에 첨부

인증 실패 시 `401 Unauthorized` 반환.

---

## 헬스 체크

### `GET /health`

서비스 상태 확인. 인증 불필요.

**Response 200**
```json
{
  "status": "ok",
  "service": "chat-ki-s-backend"
}
```

---

## 인증 (Auth)

### `POST /api/auth/login`
> 개발·테스트 전용. 프로덕션에서는 포털 세션 토큰 사용.

**Request Body**
```json
{
  "employeeId": "KW001",
  "password": "string"
}
```

**Response 200**
```json
{
  "accessToken": "eyJhbGci...",
  "user": {
    "id": "uuid",
    "employeeId": "KW001",
    "name": "홍길동",
    "email": "gildong@kiwoom.com",
    "department": "디지털전략팀",
    "createdAt": "2026-04-01T00:00:00.000Z"
  }
}
```

**Response 401**
```json
{ "error": "Invalid credentials" }
```

---

### `POST /api/auth/refresh`
> 인증 필요. 새 액세스 토큰 발급.

**Response 200**
```json
{ "accessToken": "eyJhbGci..." }
```

---

## 사용자 (User)

### `GET /api/me`
> 인증 필요. 현재 로그인 사용자 정보 반환.
>
> 현재 구현: `GET /api/users/me` (동일 기능, 경로 통일 예정)

**Response 200**
```json
{
  "id": "uuid",
  "employeeId": "KW001",
  "name": "홍길동",
  "email": "gildong@kiwoom.com",
  "department": "디지털전략팀",
  "createdAt": "2026-04-01T00:00:00.000Z"
}
```

**Response 404**
```json
{ "error": "User not found" }
```

---

## 채팅 (Chat)

### `POST /api/chat`
> 인증 필요. 사용자 질문을 받아 AI 답변을 반환한다 (동기 방식).
>
> 현재 구현: `POST /api/conversations/:id/messages` 로 처리.
> Frontend `api.ts`에서 호출하는 `/api/chat` 경로는 **Backend에 별도 라우트 추가 또는 alias 필요**.

**Request Body**
```json
{
  "conversationId": "uuid (선택, 없으면 새 대화 생성)",
  "content": "입사 후 첫 3개월 동안 해야 할 일이 뭔가요?",
  "mode": "rag"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `conversationId` | string (UUID) | 선택 | 기존 대화 ID. 없으면 새 대화 자동 생성 |
| `content` | string | 필수 | 사용자 메시지 |
| `mode` | `"rag"` \| `"objective"` | 필수 | `rag`: FAQ/문서 기반, `objective`: 직접 LLM |

**Response 200**
```json
{
  "conversationId": "uuid",
  "message": {
    "id": "uuid",
    "conversationId": "uuid",
    "role": "assistant",
    "content": "입사 후 3개월 간 다음을 진행하시면 됩니다...",
    "createdAt": "2026-04-03T10:00:00.000Z"
  }
}
```

**Response 404**
```json
{ "error": "Conversation not found" }
```

---

### `GET /api/conversations/:id/messages` (스트리밍용 히스토리)
> 인증 필요. 특정 대화의 메시지 목록 반환.

**Path Params**
- `id`: 대화 UUID

**Response 200**
```json
[
  {
    "id": "uuid",
    "conversationId": "uuid",
    "role": "user",
    "content": "입사 후 첫 3개월 동안 해야 할 일이 뭔가요?",
    "createdAt": "2026-04-03T09:59:00.000Z"
  },
  {
    "id": "uuid",
    "conversationId": "uuid",
    "role": "assistant",
    "content": "입사 후 3개월 간 다음을 진행하시면 됩니다...",
    "createdAt": "2026-04-03T10:00:00.000Z"
  }
]
```

---

### WebSocket `ws://<host>/api/conversations/:id/stream`
> 스트리밍 응답. AI 답변을 토큰 단위로 실시간 전송.

**Client → Server (메시지 전송)**
```json
{
  "content": "연차는 어떻게 신청하나요?",
  "mode": "rag"
}
```

**Server → Client (이벤트 시퀀스)**
```json
// 1. 스트리밍 시작
{ "type": "start" }

// 2. 토큰 청크 (반복)
{ "type": "chunk", "content": "연차 신청은 " }
{ "type": "chunk", "content": "인사 포털에서..." }

// 3. 완료
{ "type": "done", "messageId": "uuid" }

// 오류 시
{ "type": "error", "message": "Invalid JSON" }
```

---

## 피드백 (Feedback)

### `POST /api/feedback`
> 인증 필요. 답변에 대한 좋아요/싫어요 피드백 저장.
>
> **현재 미구현** — Backend 및 DB 스키마 추가 필요 (개발 우선순위 참조).

**Request Body**
```json
{
  "messageId": "uuid",
  "rating": 1,
  "comment": "도움이 됐어요 (선택)"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `messageId` | string (UUID) | 필수 | 피드백 대상 메시지 ID |
| `rating` | number | 필수 | `1` = 👍 긍정, `-1` = 👎 부정 |
| `comment` | string | 선택 | 자유 텍스트 |

**Response 201**
```json
{
  "id": "uuid",
  "messageId": "uuid",
  "rating": 1,
  "comment": "도움이 됐어요",
  "createdAt": "2026-04-03T10:05:00.000Z"
}
```

**Response 404**
```json
{ "error": "Message not found" }
```

**Response 409**
```json
{ "error": "Feedback already submitted" }
```

---

## AI 내부 서비스 (Backend → AI, 외부 노출 금지)

> 이 엔드포인트들은 Backend가 AI Service(port 8001)를 프록시할 때 내부적으로 사용한다.
> 클라이언트(Frontend)가 직접 호출하지 않는다.

### `POST /chat` (AI Service 내부)
```json
// Request
{
  "conversationId": "uuid",
  "message": "연차 신청은 어떻게 하나요?",
  "mode": "rag"
}

// Response
{
  "response": "연차는 인사 포털 > 근태관리 메뉴에서...",
  "sources": [
    { "doc_id": "hr-policy-2026", "source": "HR 정책 안내서.pdf", "page": 12 }
  ]
}
```

### `POST /chat/stream` (AI Service 내부)
> Backend가 WebSocket 스트리밍에 사용. Chunked HTTP 응답.

### `POST /search` (AI Service 내부 — RAG 검색)
```json
// Request
{ "query": "연차 신청", "top_k": 5 }

// Response
{
  "query": "연차 신청",
  "results": [
    {
      "content": "연차는 인사 포털에서...",
      "metadata": { "source": "HR 정책 안내서.pdf", "doc_id": "hr-policy-2026" },
      "score": 0.92
    }
  ]
}
```

---

## 에러 응답 형식 (공통)

```json
{
  "error": "에러 메시지",
  "detail": "선택적 상세 설명"
}
```

| HTTP 코드 | 의미 |
|-----------|------|
| 400 | 잘못된 요청 (유효성 실패) |
| 401 | 인증 실패 또는 토큰 만료 |
| 403 | 권한 없음 |
| 404 | 리소스 없음 |
| 409 | 중복 충돌 |
| 502 | AI 서비스 오류 |
| 500 | 서버 내부 오류 |
