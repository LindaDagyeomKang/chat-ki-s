# Chat-Ki-S FAQ 카테고리 체계 (Knowledge Taxonomy)

> 최종 업데이트: 2026-04-04
> 작성자: Content Engineer Agent

---

## 1. 개요

신입사원이 온보딩 과정에서 가장 자주 접하는 질문과 정보를 5개 카테고리로 분류한다.
각 카테고리는 ChromaDB에 컬렉션 단위로 구성되며, RAG 검색 시 필터 기준으로 활용된다.

---

## 2. 카테고리 체계

### 2-1. 인사 / 휴가 (hr-vacation)

**설명:** 급여, 복리후생, 휴가 정책, 경조사 등 HR 제도 전반

| 하위 주제 | 예시 질문 |
|-----------|-----------|
| 급여·지급일 | "급여는 언제 들어오나요?" |
| 연차·반차 | "연차는 언제부터 쓸 수 있나요?" |
| 병가·경조사 | "병가 신청은 어떻게 하나요?" |
| 복리후생 | "식대, 교통비 지원이 어떻게 되나요?" |
| 재택근무 | "재택근무 신청은 어떻게 하나요?" |
| 퇴직 절차 | "퇴직 시 어떤 절차가 필요한가요?" |

**관련 seed 문서:** `company_policy_vacation.md`, `company_policy_benefits.md`

---

### 2-2. 권한 / 시스템 (access-systems)

**설명:** IT 계정, 소프트웨어 권한, 보안 정책, VPN·장비 관련 문의

| 하위 주제 | 예시 질문 |
|-----------|-----------|
| 이메일 계정 | "이메일 계정은 언제 만들어지나요?" |
| 장비 지급 | "노트북은 어떻게 받나요?" |
| 소프트웨어 설치 | "프로그램 설치 권한이 없는데 어떻게 하나요?" |
| VPN·네트워크 | "VPN 설정은 어떻게 하나요?" |
| 보안 정책 | "고객 정보를 외부로 보내도 되나요?" |
| 사고 대응 | "노트북을 잃어버렸어요. 어떻게 해야 하나요?" |

**관련 seed 문서:** `guide_dev_environment.md`, `onboarding_faq.md` (IT/보안 섹션)

---

### 2-3. 교육 / 온보딩 (education-onboarding)

**설명:** 온보딩 프로그램, 교육 지원, 성과 평가, 멘토 제도

| 하위 주제 | 예시 질문 |
|-----------|-----------|
| 온보딩 일정 | "입사 첫 주에 무엇을 하나요?" |
| 멘토·버디 | "버디는 어떻게 배정되나요?" |
| 외부 교육 지원 | "컨퍼런스 참가 비용을 지원받을 수 있나요?" |
| 도서 구매 | "업무 관련 책 구매 지원이 있나요?" |
| 성과 평가 | "성과 평가는 언제 이루어지나요?" |
| 개발 환경 | "개발 환경 세팅은 어떻게 하나요?" |

**관련 seed 문서:** `guide_dev_environment.md`, `guide_git.md`, `guide_jira.md`, `guide_slack.md`

---

### 2-4. 조직 / 연락처 (org-contacts)

**설명:** 부서 구성, 담당자 연락처, 조직도, 회의/협업 도구

| 하위 주제 | 예시 질문 |
|-----------|-----------|
| 부서 소개 | "각 팀이 어떤 일을 하나요?" |
| 담당자 문의 | "IT 지원은 누구에게 연락하나요?" |
| 협업 도구 | "회의실 예약은 어떻게 하나요?" |
| 호칭 문화 | "상사를 뭐라고 불러야 하나요?" |
| 사내 게시판 | "사내 공지는 어디서 확인하나요?" |

**관련 seed 문서:** `dept_intro_engineering.md`, `dept_intro_hr_finance.md`, `dept_intro_product_design.md`

---

### 2-5. 회사생활 (company-life)

**설명:** 복지시설, 사무실 생활, 주차, 동호회, 복장 등

| 하위 주제 | 예시 질문 |
|-----------|-----------|
| 복지시설 | "사내 피트니스 센터는 어떻게 이용하나요?" |
| 식사·카페테리아 | "카페테리아는 어디에 있나요?" |
| 주차 | "주차 등록은 어떻게 하나요?" |
| 복장 규정 | "복장 규정이 있나요?" |
| 회식·동호회 | "동호회 참여는 어떻게 하나요?" |
| 사무실 이용 | "음식을 자리에서 먹어도 되나요?" |

**관련 seed 문서:** `onboarding_faq.md` (복지 시설, 조직 문화 섹션)

---

## 3. 문서 메타데이터 기준

모든 FAQ/지식 문서는 YAML 프론트매터로 아래 메타데이터를 포함한다.

```yaml
---
title: string           # 문서 제목 (검색 노출용)
category: string        # 2절의 카테고리 ID (예: hr-vacation)
subcategory: string     # 하위 주제 슬러그 (예: annual-leave)
tags: [string]          # 키워드 태그 (최대 5개)
source: string          # 원본 문서 경로 또는 정책 이름
source_url: string|null # 원본 URL (내부 wiki 등), 없으면 null
created_at: YYYY-MM-DD  # 문서 최초 작성일
updated_at: YYYY-MM-DD  # 최종 수정일
version: string         # 정책 버전 (예: 2026-Q1)
visibility: public|internal # 노출 범위 (MVP: 모두 internal)
---
```

### 메타데이터 작성 규칙

| 필드 | 필수 | 규칙 |
|------|------|------|
| `title` | ✅ | 검색 쿼리와 매칭되도록 구체적으로 작성 |
| `category` | ✅ | 위 5개 카테고리 ID 중 하나 |
| `subcategory` | ✅ | 영문 소문자 + 하이픈 슬러그 |
| `tags` | ✅ | 동의어·약어 포함 (예: `연차, 휴가, annual-leave`) |
| `source` | ✅ | 사내 정책명 또는 문서 파일명 |
| `source_url` | 권장 | 내부 wiki 링크 (없으면 null) |
| `created_at` | ✅ | ISO 날짜 형식 |
| `updated_at` | ✅ | 내용 변경 시 반드시 갱신 |
| `version` | 권장 | 정책 개정 버전 추적용 |
| `visibility` | ✅ | MVP에서는 `internal` 고정 |

---

## 4. ChromaDB 컬렉션 매핑

| 카테고리 ID | ChromaDB 컬렉션명 | 설명 |
|-------------|-------------------|------|
| `hr-vacation` | `faq_hr_vacation` | 인사/휴가 문서 |
| `access-systems` | `faq_access_systems` | IT/권한/보안 문서 |
| `education-onboarding` | `faq_education_onboarding` | 교육/온보딩 문서 |
| `org-contacts` | `faq_org_contacts` | 조직/연락처 문서 |
| `company-life` | `faq_company_life` | 회사생활 문서 |
| (통합 검색) | `faq_all` | 전체 범용 검색용 |

MVP에서는 `faq_all` 단일 컬렉션으로 시작하고, 카테고리 필드를 ChromaDB `where` 필터로 활용한다.

---

## 5. 향후 확장 계획 (MVP 이후)

- **보안/컴플라이언스** 카테고리 별도 분리 (금융규제 관련 문서 증가 시)
- **업무 도구** 카테고리 추가 (Jira, Slack, Git 상세 가이드)
- 카테고리별 **자동 만료일** 설정 (정책 문서 freshness 관리)
