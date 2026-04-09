# Chat-Ki-S

**키움증권 신입사원 온보딩 지원 챗봇 + 가상 인트라넷**

사내 문서 기반 RAG + OpenAI Function Calling을 활용한 AI 챗봇과, 전자우편/게시판/인사시스템/주소록/캘린더 등을 포함한 가상 인트라넷 시스템입니다.

---

## 로컬 실행 가이드

### 사전 요구사항

- **Node.js** 18+ ([다운로드](https://nodejs.org))
- **Python** 3.11+ ([다운로드](https://python.org))
- **PostgreSQL** 14+ ([다운로드](https://postgresql.org))
- **Docker** (ChromaDB용) ([다운로드](https://docker.com))
- **OpenAI API Key** ([발급](https://platform.openai.com/api-keys))

### 1단계: 프로젝트 클론

```bash
git clone https://github.com/LindaDagyeomKang/chat-ki-s.git
cd chat-ki-s
```

### 2단계: 환경변수 설정

```bash
cp .env.example .env
```

`.env` 파일을 열어서 아래 값을 수정:

```env
# 필수
OPENAI_API_KEY=sk-proj-여기에-키-입력
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/chat_ki_s

# 선택 (기본값 그대로 사용 가능)
PORT=4000
JWT_SECRET=my_local_secret
AI_SERVICE_URL=http://localhost:8001
NEXT_PUBLIC_API_URL=http://localhost:4000
```

### 3단계: PostgreSQL DB 생성

```bash
createdb chat_ki_s
# 또는 psql에서:
# CREATE DATABASE chat_ki_s;
```

### 4단계: Node.js 패키지 설치

```bash
npm install
```

### 5단계: Python 패키지 설치

```bash
cd apps/ai
pip install -r requirements.txt
cd ../..
```

### 6단계: ChromaDB 실행 (Docker)

```bash
docker run -d --name chromadb -p 8000:8000 chromadb/chroma
```

### 7단계: AI 서비스 실행 (터미널 1)

```bash
cd apps/ai
ln -sf ../../.env .env
python3 -m uvicorn main:app --port 8001 --reload
```

> 시작 시 자동으로 seed 문서 25개가 ChromaDB에 인덱싱됩니다.

### 8단계: 백엔드 실행 (터미널 2)

```bash
npx dotenv -e .env -- npx tsx apps/backend/src/index.ts
```

> 첫 실행 시 자동으로 DB 테이블 생성 + 시드 데이터(유저 6명, 공지 5개, 메일 등) 삽입

### 9단계: 임직원 프로필 + 금융용어 DB 적재

```bash
# 임직원 1,254명 프로필 적재
python3 -c "
import openpyxl, psycopg2
wb = openpyxl.load_workbook('data/seed_data/키움증권_임직원프로필_최종.xlsx')
ws = wb.active
conn = psycopg2.connect('postgresql://postgres:postgres@localhost:5432/chat_ki_s')
cur = conn.cursor()
for row in ws.iter_rows(min_row=4, values_only=True):
    emp_id, name, gender, birth, division, dept, team, rank, position, join_date, tenure, email, phone, mbti, duty = row[:15]
    if not emp_id or not name: continue
    birth_str = birth.strftime('%Y-%m-%d') if hasattr(birth, 'strftime') else str(birth) if birth else None
    join_str = join_date.strftime('%Y-%m-%d') if hasattr(join_date, 'strftime') else str(join_date) if join_date else None
    cur.execute('''INSERT INTO employees (employee_id, name, gender, birth_date, division, department, team, rank, position, join_date, tenure, email, phone, mbti, duty)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT (employee_id) DO NOTHING''',
        (str(emp_id), name, gender, birth_str, division, dept, team, rank, position, join_str, str(tenure) if tenure else None, email, phone, mbti, duty))
conn.commit(); cur.close(); conn.close()
print('임직원 프로필 적재 완료')
"

# 금융용어사전 1,622개 적재
python3 -c "
import csv, psycopg2
conn = psycopg2.connect('postgresql://postgres:postgres@localhost:5432/chat_ki_s')
cur = conn.cursor()
cur.execute('CREATE TABLE IF NOT EXISTS glossary (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), term VARCHAR(200) NOT NULL, description TEXT NOT NULL)')
with open('data/seed_data/금융용어사전.csv', 'r', encoding='utf-8-sig') as f:
    reader = csv.reader(f); next(reader)
    for row in reader:
        if len(row) >= 2 and row[0].strip():
            cur.execute('INSERT INTO glossary (term, description) VALUES (%s, %s) ON CONFLICT DO NOTHING', (row[0].strip(), row[1].strip()))
conn.commit(); cur.close(); conn.close()
print('금융용어사전 적재 완료')
"

# 메일 더미데이터 적재 (진강연 계정용)
python3 -c "
import openpyxl, psycopg2, re, hashlib
conn = psycopg2.connect('postgresql://postgres:postgres@localhost:5432/chat_ki_s')
cur = conn.cursor()
# 추가 유저 생성 (메일 발신자)
for eid, name, email, dept, pw in [('20100077','채영희','coh0077@kiwoom.com','채널기획팀','coh0077'),('20100634','제민재','jmj0634@kiwoom.com','SQUAD','jmj0634'),('20100774','천규리','cgr0774@kiwoom.com','플랫폼전략팀','cgr0774')]:
    cur.execute('INSERT INTO users (employee_id, name, email, department, password_hash, role) VALUES (%s,%s,%s,%s,%s,%s) ON CONFLICT (employee_id) DO NOTHING', (eid, name, email, dept, hashlib.sha256(pw.encode()).hexdigest(), 'mentor'))
# 메일 파싱 및 삽입
wb = openpyxl.load_workbook('data/seed_data/영웅문S#_회원가입로그인_개선_메일내역.xlsx')
ws = wb.active
mails = []; current = {}
for row in ws.iter_rows(min_row=2, values_only=True):
    a, b = str(row[0] or '').strip(), str(row[1] or '').strip()
    if a.startswith('[메일'):
        if current and 'subject' in current: mails.append(current)
        dm = re.search(r'(\d{4}-\d{2}-\d{2}).*?(\d{2}:\d{2})', a)
        current = {'date': dm.group(1) if dm else '2026-04-08', 'time': dm.group(2) if dm else '09:00'}
    elif a == '제목': current['subject'] = b
    elif a == '발신': current['from_text'] = b
    elif a == '수신': current['to_text'] = b
    elif a == '참조': current['cc'] = b
    elif a == '본문': current['body'] = b
if current and 'subject' in current: mails.append(current)
name_map = {}
for n in ['진강연','채영희','천규리','제민재']:
    cur.execute('SELECT id FROM users WHERE name = %s', (n,))
    r = cur.fetchone()
    if r: name_map[n] = r[0]
for m in mails:
    sender = next((n for n in name_map if n in m.get('from_text','')), None)
    if not sender: continue
    receiver = '진강연' if sender != '진강연' else next((n for n in ['채영희','천규리','제민재'] if n in m.get('to_text','')), '채영희')
    cur.execute('INSERT INTO mails (from_id, to_id, subject, body, from_text, to_text, cc, is_read, created_at) VALUES (%s,%s,%s,%s,%s,%s,%s,true,%s)',
        (name_map[sender], name_map[receiver], m['subject'], m.get('body',''), m.get('from_text',''), m.get('to_text',''), m.get('cc',''), f\"{m['date']}T{m['time']}:00+09:00\"))
conn.commit(); cur.close(); conn.close()
print(f'메일 {len(mails)}건 적재 완료')
"
```

### 10단계: 프론트엔드 실행 (터미널 3)

```bash
npx --workspace=apps/frontend next dev -p 3000
```

### 접속

- **인트라넷**: http://localhost:3000/intranet
- **챗봇 전체화면**: http://localhost:3000/chat
- **로그인**: http://localhost:3000/login

### 테스트 계정

| 사번 | 이름 | 비밀번호 | 부서 |
|------|------|----------|------|
| 20260001 | 전호철 | jhc0001 | 주식운용팀 |
| 20260002 | 진강연 | jky0002 | 인사이트랩팀 |
| 20260003 | 이소현 | lsh0003 | 인사팀 |
| 20260004 | 박진영 | jyp0004 | 혁신성장리서치팀 |
| 20260005 | 강다겸 | kdg0005 | AIX팀 |
| 20260006 | 김지원 | kjw0006 | ESG추진팀 |

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프론트엔드 | Next.js 14, Tailwind CSS, TypeScript |
| 백엔드 | Fastify, Drizzle ORM, PostgreSQL |
| AI 서비스 | FastAPI, OpenAI GPT-4o-mini, Function Calling |
| 벡터 검색 | ChromaDB, LangChain Embeddings |
| 문서 | RAG (Retrieval-Augmented Generation) |

---

## 주요 기능

- **AI 챗봇**: Function Calling 기반 — 메일 조회, 연차 신청, 담당자 검색, 금융 용어, 일정 관리
- **가상 인트라넷**: 전자우편, 게시판, 인사시스템, 온보딩 칸반, 주소록, 캘린더
- **페이지 컨텍스트**: 메일/공지를 보면서 챗봇에게 "이 메일 요약해줘" 가능
- **온보딩 설문**: 입사 분기별 자동 설문 + AI 분석
- **금융 용어 사전**: 1,622개 용어 DB + 벡터 유사 검색
