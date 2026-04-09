# Chat-Ki-S 출처 표시 가이드 (Source Labeling Guide)

> 최종 업데이트: 2026-04-04
> 작성자: Content Engineer Agent

---

## 1. 개요

RAG 기반 챗봇은 여러 내부 문서에서 정보를 가져온다.
사용자가 "이 정보가 어디서 왔나요?" 궁금해할 때 신뢰감 있게 출처를 보여주는 것이 중요하다.
이 가이드는 Chat-Ki-S 답변에서 출처를 표시하는 방식과 문구를 정의한다.

---

## 2. 출처 표시 원칙

| 원칙 | 설명 |
|------|------|
| **투명성** | 어떤 문서를 참고했는지 사용자가 확인할 수 있어야 한다 |
| **신뢰성** | 출처가 있으면 답변 신뢰도가 올라간다. 없으면 명확히 표시한다 |
| **간결성** | 출처 표시가 답변 본문을 가려서는 안 된다 |
| **접근성** | 가능하면 원본 문서로 이동할 수 있는 링크를 제공한다 |

---

## 3. 출처 표시 위치

출처는 답변 **하단**에 구분선(---) 이후 표시한다. 답변 본문 중간에 삽입하지 않는다.

```
[답변 본문]

---
📄 참고 출처: [문서명](링크)
```

---

## 4. 출처 유형별 표시 방법

### 4-1. 내부 정책 문서 (사내 wiki/정책 시스템)

```
📄 참고 출처: 인사 규정 — 연차 및 휴가 정책 (wiki.company.com/hr/vacation)
```

문서명은 사용자가 알아볼 수 있는 이름으로 표기한다. 내부 파일 경로(예: `data/seed/company_policy_vacation.md`)는 노출하지 않는다.

### 4-2. FAQ 문서

```
📄 참고 출처: 신입사원 온보딩 FAQ — IT 및 시스템 섹션
```

FAQ 문서의 경우 섹션명까지 포함해 어느 부분에서 왔는지 명확히 한다.

### 4-3. 부서 소개 문서

```
📄 참고 출처: 엔지니어링팀 소개 문서 (2026-Q1 기준)
```

### 4-4. 복수 출처 (여러 문서 참조 시)

```
📄 참고 출처:
- 인사 규정 — 급여 및 복리후생 정책
- 신입사원 온보딩 FAQ — 급여 섹션
```

최대 3개까지 나열한다. 그 이상은 "외 N건"으로 줄인다.

### 4-5. 출처 없음 (LLM 자체 생성 또는 일반 상식)

```
ℹ️ 이 답변은 일반적인 안내이며, 회사 정책과 다를 수 있어요.
정확한 내용은 HR팀(hr@company.com)에 확인해 주세요.
```

RAG 검색에서 관련 문서를 찾지 못한 경우에만 사용한다.

---

## 5. 출처 표시 문구 예시

### 케이스 1: 단일 출처, 링크 있음

```
---
📄 참고 출처: [인사 규정 — 연차 및 휴가 정책](wiki.company.com/hr/vacation)
```

### 케이스 2: 단일 출처, 링크 없음

```
---
📄 참고 출처: 인사 규정 — 연차 및 휴가 정책 (2026-Q1 기준)
```

### 케이스 3: 복수 출처

```
---
📄 참고 출처:
- 인사 규정 — 급여 및 복리후생 정책
- [신입사원 온보딩 FAQ](wiki.company.com/onboarding/faq) — 급여 섹션
```

### 케이스 4: 정보 불확실 (출처 미확보)

```
---
ℹ️ 정확한 내용은 HR팀(hr@company.com)에 확인하시는 걸 권장드려요.
```

### 케이스 5: 최신 정보 주의

```
---
📄 참고 출처: 인사 규정 — 복리후생 정책 (2025-Q4 기준)
⚠️ 정책이 변경됐을 수 있으니, 최신 내용은 HR팀에 문의해 주세요.
```

문서의 `updated_at`이 90일 이상 지난 경우 이 경고 문구를 자동으로 추가한다.

---

## 6. 구현 가이드 (AI Service)

### 6-1. ChromaDB 검색 결과에서 출처 추출

ChromaDB 검색 결과의 `metadata`에서 다음 필드를 출처 표시에 활용한다.

```python
source_display_name = metadata.get("title") or metadata.get("source")
source_url = metadata.get("source_url")  # None이면 링크 없이 텍스트만
updated_at = metadata.get("updated_at")
```

### 6-2. 출처 문자열 생성 로직

```python
from datetime import date, timedelta

def format_source_label(sources: list[dict]) -> str:
    if not sources:
        return "ℹ️ 정확한 내용은 담당 부서에 확인하시는 걸 권장드려요."

    lines = []
    for s in sources[:3]:  # 최대 3개
        name = s.get("title") or s.get("source", "내부 문서")
        url = s.get("source_url")
        updated = s.get("updated_at")

        # 링크 포함 여부
        label = f"[{name}]({url})" if url else name

        # 최신성 경고 (90일 초과)
        stale = False
        if updated:
            try:
                doc_date = date.fromisoformat(updated)
                stale = (date.today() - doc_date) > timedelta(days=90)
            except ValueError:
                pass

        lines.append(f"- {label}" + (" ⚠️ 최신 정보 확인 권장" if stale else ""))

    header = "📄 참고 출처:" if len(lines) == 1 else "📄 참고 출처:"
    body = "\n".join(lines) if len(lines) > 1 else lines[0].lstrip("- ")

    return f"---\n{header} {body}" if len(lines) == 1 else f"---\n{header}\n" + "\n".join(lines)
```

### 6-3. 프롬프트 내 출처 지시

시스템 프롬프트에 아래 지시를 포함한다.

```
답변 마지막에 참고한 출처 문서를 반드시 명시하세요.
출처는 답변 본문 아래 구분선(---) 다음에 "📄 참고 출처:" 형식으로 표시하세요.
내부 파일 경로(예: data/seed/...)는 절대 노출하지 마세요.
출처를 찾지 못한 경우 "ℹ️ 정확한 내용은 담당 부서에 확인하시는 걸 권장드려요."로 대체하세요.
```

---

## 7. 프론트엔드 렌더링

- 출처 섹션은 답변 본문보다 작은 폰트(text-sm)와 회색(text-gray-500)으로 구분해 표시한다
- 링크가 있으면 새 탭으로 열린다 (`target="_blank"`)
- 경고 아이콘(⚠️)은 주황색으로 강조 표시한다
- 모바일에서는 출처 섹션을 접을 수 있는 토글로 제공한다 (선택 구현)

---

## 8. 출처 표시 금지 사항

| 금지 | 이유 |
|------|------|
| 내부 파일 경로 노출 (예: `data/seed/vacation.md`) | 시스템 구조 노출 |
| 임베딩 청크 ID 노출 | 사용자에게 의미 없음 |
| "여러 내부 문서를 참고했습니다"만 표시 | 너무 모호함 |
| 출처 완전 생략 | 투명성 원칙 위반 |
| 출처를 답변 중간에 삽입 | 가독성 저해 |
