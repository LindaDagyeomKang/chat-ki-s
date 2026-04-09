# Chat-Ki-S 응답 스키마 (Answer Schema)

> 최종 업데이트: 2026-04-04
> 작성자: AI Engineer Agent

---

## 1. AI 서비스 응답 스키마

`POST /chat` 및 `GET /chat/stream` 엔드포인트가 반환하는 JSON 구조입니다.

### 1.1 일반 응답 (`/chat`)

```json
{
  "answer": "string",
  "sources": [
    {
      "doc_id": "string",
      "source": "string",
      "section": "string | null",
      "score": "number (0~1)",
      "chunk_index": "integer"
    }
  ],
  "is_fallback": "boolean",
  "model": "string",
  "usage": {
    "prompt_tokens": "integer",
    "completion_tokens": "integer",
    "total_tokens": "integer"
  }
}
```

### 1.2 스트리밍 응답 (`/chat/stream`)

SSE(Server-Sent Events) 또는 chunked 형식으로 텍스트 토큰을 전달합니다.

```
data: {"token": "안녕하세요"}
data: {"token": ", 신입사원"}
...
data: {"done": true, "sources": [...], "is_fallback": false}
```

---

## 2. 필드 설명

### `answer`
- LLM이 생성한 최종 텍스트 답변입니다.
- fallback인 경우 `fallback-policy.md`의 지정 문구가 들어갑니다.
- 3~5문장, 최대 512 토큰.

### `sources`
- RAG 파이프라인이 참조한 문서 청크 목록입니다.
- `is_fallback: true`인 경우에도 검색된 청크가 있으면 포함합니다 (점수가 낮아 사용하지 않았음을 표시).
- 최대 5개 청크, 유사도 내림차순 정렬.

| 필드 | 타입 | 설명 |
|------|------|------|
| `doc_id` | string | ChromaDB 내 문서 고유 ID |
| `source` | string | 원본 파일명 또는 URL |
| `section` | string \| null | 문서 내 섹션명 (메타데이터에서 추출) |
| `score` | number | 코사인 유사도 (0~1, 높을수록 관련도 높음) |
| `chunk_index` | integer | 문서 내 청크 순번 |

### `is_fallback`
- `true`: 검색 결과가 임계값 미만이거나 문서에 정보가 없어 fallback 문구를 반환한 경우.
- `false`: 정상 문서 기반 답변.

### `usage`
- OpenAI API 토큰 사용량. 비용 모니터링 및 최적화에 사용합니다.

---

## 3. 백엔드 → 프론트엔드 응답 스키마

백엔드(`Fastify`)가 AI 서비스 응답을 받아 클라이언트에 전달하는 형식입니다.
`packages/shared/src/index.ts`의 `Message` 타입과 일치해야 합니다.

```json
{
  "id": "string (UUID)",
  "conversationId": "string (UUID)",
  "role": "assistant",
  "content": "string",
  "sources": [
    {
      "source": "string",
      "section": "string | null",
      "score": "number"
    }
  ],
  "isFallback": "boolean",
  "createdAt": "string (ISO 8601)"
}
```

> `doc_id`와 `chunk_index`는 내부 정보이므로 프론트엔드에 노출하지 않습니다.

---

## 4. 프론트엔드 표시 규칙

| 조건 | 표시 방식 |
|------|-----------|
| `isFallback: false` | 답변 본문 + 출처 섹션 |
| `isFallback: true` | 답변 본문(fallback 문구) + 안내 메시지 (출처 섹션 숨김) |
| `sources` 있음 | "📄 출처: {source} — {section}" 형식으로 답변 하단에 표시 |
| `score < 0.75` | "⚠️ 참고용 정보입니다. 정확한 내용은 담당 부서에 확인하세요." 주의 문구 추가 |

---

## 5. 에러 응답

AI 서비스 장애, OpenAI API 오류 등 예외 상황의 응답 형식입니다.

```json
{
  "error": "string",
  "code": "string",
  "is_fallback": true,
  "answer": "죄송합니다. 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."
}
```

| 코드 | 설명 |
|------|------|
| `LLM_ERROR` | OpenAI API 호출 실패 |
| `SEARCH_ERROR` | ChromaDB 검색 실패 |
| `TIMEOUT` | 응답 시간 초과 (30초) |
| `INVALID_INPUT` | 빈 질문 또는 너무 긴 입력 (4000자 초과) |
