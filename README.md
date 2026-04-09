# Chat-Ki-S

**키움증권 신입사원 온보딩 지원 챗봇**

사내 문서 기반 RAG(검색 증강 생성) 파이프라인을 활용하여 신입사원이 온보딩 관련 질문에 빠르게 답변받을 수 있는 채팅 서비스입니다.

---

## 서비스 구성

| 서비스 | 기술 스택 | 포트 |
|--------|-----------|------|
| Frontend | Next.js | 3000 |
| Backend | Node.js (Express/NestJS) | 4000 |
| AI (RAG) | Python FastAPI + LangChain + ChromaDB | 8001 |
| PostgreSQL | postgres:16-alpine | 5432 |
| ChromaDB | chromadb/chroma | 8000 |

---

## 환경 설정

### 1. 환경 변수 준비

`.env.example`을 복사하여 `.env` 파일을 생성합니다.

```bash
cp .env.example .env
```

`.env` 파일을 열어 아래 항목을 설정합니다.

```env
# Backend
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/chat_ki_s
JWT_SECRET=change-me-in-production
JWT_EXPIRES_IN=7d

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:4000

# Vector DB (Chroma)
CHROMA_HOST=http://localhost:8000

# AI Service (RAG pipeline - Python FastAPI)
AI_SERVICE_URL=http://localhost:8001

# OpenAI (필수: LLM 및 임베딩에 사용)
OPENAI_API_KEY=sk-...
```

> **주의:** `OPENAI_API_KEY`는 반드시 실제 OpenAI API 키로 교체해야 합니다.

---

## 실행 방법

### Docker Compose (권장)

Docker와 Docker Compose가 설치되어 있어야 합니다.

```bash
# 전체 서비스 빌드 및 실행
docker-compose up --build

# 백그라운드 실행
docker-compose up --build -d

# 서비스 중지
docker-compose down

# 데이터 볼륨 포함 완전 초기화
docker-compose down -v
```

서비스가 정상적으로 실행되면 아래 주소에서 접근할 수 있습니다.

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:4000
- **AI Service:** http://localhost:8001

### 로컬 개발 모드 (Docker 없이)

Node.js >= 20, npm >= 10, Python >= 3.10이 필요합니다.

```bash
# 의존성 설치
npm install

# Frontend + Backend 동시 실행 (concurrently)
npm run dev
```

AI 서비스(Python)는 별도로 실행합니다.

```bash
cd apps/ai
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

---

## 주요 명령어

```bash
# 개발 서버 실행 (frontend + backend)
npm run dev

# 전체 빌드
npm run build

# 테스트 실행
npm run test

# 린트 검사
npm run lint
```

### 워크스페이스별 실행

```bash
# Frontend만 실행
npm run dev --workspace=apps/frontend

# Backend만 실행
npm run dev --workspace=apps/backend
```

---

## 프로젝트 구조

```
chat-ki-s/
├── apps/
│   ├── frontend/      # Next.js 프론트엔드
│   ├── backend/       # Node.js 백엔드 API
│   └── ai/            # Python FastAPI RAG 서비스
├── packages/          # 공유 패키지
├── data/              # RAG용 문서 데이터
├── docs/              # 설계 문서
├── docker-compose.yml
├── .env.example
└── package.json
```

---

## 요구 사항

- **Docker:** 24.x 이상 (Docker Compose V2 포함)
- **Node.js:** 20.x 이상 (로컬 개발 시)
- **npm:** 10.x 이상 (로컬 개발 시)
- **Python:** 3.10 이상 (AI 서비스 로컬 실행 시)
- **OpenAI API Key:** RAG 파이프라인 필수
