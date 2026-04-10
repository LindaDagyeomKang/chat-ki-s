import { Pool } from 'pg'
import { createHash } from 'crypto'

function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex')
}

const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  department VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  title VARCHAR(255) NOT NULL DEFAULT 'New Conversation',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id),
  role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  sources JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  message_id UUID,
  rating VARCHAR(20),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Drop the FK constraint if it exists (from earlier schema versions where
-- message_id incorrectly referenced only messages.id, conflicting with
-- chat_logs IDs passed from /api/chat)
ALTER TABLE feedback DROP CONSTRAINT IF EXISTS feedback_message_id_fkey;

-- Add role column to users (mentor/mentee)
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'mentee';

-- Add employee_ref_id column to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_ref_id UUID;

-- Add missing mails columns (for existing DBs)
ALTER TABLE mails ADD COLUMN IF NOT EXISTS from_text TEXT DEFAULT '';
ALTER TABLE mails ADD COLUMN IF NOT EXISTS to_text TEXT DEFAULT '';
ALTER TABLE mails ADD COLUMN IF NOT EXISTS cc TEXT DEFAULT '';
ALTER TABLE mails ADD COLUMN IF NOT EXISTS starred BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE mails ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE mails ADD COLUMN IF NOT EXISTS is_draft BOOLEAN NOT NULL DEFAULT false;

-- Add missing employees column
ALTER TABLE employees ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT '온라인';

-- Convert mails.is_read from varchar to boolean if needed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mails' AND column_name = 'is_read' AND data_type = 'character varying'
  ) THEN
    ALTER TABLE mails ALTER COLUMN is_read DROP DEFAULT;
    ALTER TABLE mails ALTER COLUMN is_read TYPE BOOLEAN USING (is_read = 'true');
    ALTER TABLE mails ALTER COLUMN is_read SET DEFAULT false;
  END IF;
END $$;

-- Convert notices.pinned from varchar to boolean if needed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notices' AND column_name = 'pinned' AND data_type = 'character varying'
  ) THEN
    ALTER TABLE notices ALTER COLUMN pinned DROP DEFAULT;
    ALTER TABLE notices ALTER COLUMN pinned TYPE BOOLEAN USING (pinned = 'true');
    ALTER TABLE notices ALTER COLUMN pinned SET DEFAULT false;
  END IF;
END $$;

-- Intranet: 공지게시판
CREATE TABLE IF NOT EXISTS notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT '일반',
  author_id UUID REFERENCES users(id),
  pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Intranet: 연차/휴가 신청
CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  leave_type VARCHAR(30) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  approver_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Agent 실행 로그
CREATE TABLE IF NOT EXISTS agent_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  conversation_id UUID,
  action VARCHAR(50) NOT NULL,
  params JSONB,
  result VARCHAR(20) NOT NULL,
  response_time_ms INTEGER,
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Intranet: 메일함
CREATE TABLE IF NOT EXISTS mails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_id UUID NOT NULL REFERENCES users(id),
  to_id UUID NOT NULL REFERENCES users(id),
  subject VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  from_text TEXT DEFAULT '',
  to_text TEXT DEFAULT '',
  cc TEXT DEFAULT '',
  is_read BOOLEAN NOT NULL DEFAULT false,
  starred BOOLEAN NOT NULL DEFAULT false,
  deleted BOOLEAN NOT NULL DEFAULT false,
  is_draft BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Onboarding: 과제
CREATE TABLE IF NOT EXISTS assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_by UUID NOT NULL REFERENCES users(id),
  assigned_to UUID NOT NULL REFERENCES users(id),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  due_date DATE,
  submission TEXT,
  feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 임직원 프로필
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(50) NOT NULL,
  gender VARCHAR(10),
  birth_date DATE,
  division VARCHAR(100),
  department VARCHAR(100),
  team VARCHAR(100),
  rank VARCHAR(50),
  position VARCHAR(50),
  join_date DATE,
  tenure VARCHAR(20),
  email VARCHAR(100),
  phone VARCHAR(30),
  mbti VARCHAR(10),
  duty TEXT,
  status VARCHAR(20) DEFAULT '온라인'
);

-- Intranet: 품의/경비 정산
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL,
  amount INTEGER NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  expense_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  approver_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 캘린더 일정
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  description TEXT DEFAULT '',
  event_date DATE NOT NULL,
  start_time VARCHAR(10) NOT NULL,
  end_time VARCHAR(10) DEFAULT '',
  location VARCHAR(100) DEFAULT '',
  color VARCHAR(20) DEFAULT '#3B82F6',
  is_company BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 회의실
CREATE TABLE IF NOT EXISTS meeting_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL UNIQUE,
  floor VARCHAR(10) DEFAULT '',
  capacity INTEGER DEFAULT 0,
  equipment TEXT DEFAULT '',
  color VARCHAR(20) DEFAULT '#3B82F6'
);

-- 회의실 예약
CREATE TABLE IF NOT EXISTS room_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES meeting_rooms(id),
  user_id UUID NOT NULL REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  reserve_date DATE NOT NULL,
  start_time VARCHAR(10) NOT NULL,
  end_time VARCHAR(10) NOT NULL,
  attendees TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 온보딩 설문 질문
CREATE TABLE IF NOT EXISTS survey_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quarter INTEGER NOT NULL,
  quarter_label VARCHAR(50) NOT NULL,
  stage_name VARCHAR(100) NOT NULL,
  goal VARCHAR(200) NOT NULL,
  q1 TEXT NOT NULL,
  q2 TEXT NOT NULL,
  q3 TEXT NOT NULL,
  free_question TEXT NOT NULL
);

-- 온보딩 설문 응답
CREATE TABLE IF NOT EXISTS survey_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  quarter INTEGER NOT NULL,
  q1_score INTEGER,
  q2_score INTEGER,
  q3_score INTEGER,
  free_answer TEXT,
  analysis TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  current_step INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`

export async function runMigrations(): Promise<void> {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/chat_ki_s',
  })
  try {
    await pool.query(CREATE_TABLES_SQL)
    console.log('Migrations complete')

    // Seed users if none exist
    const { rows } = await pool.query('SELECT id FROM users LIMIT 1')
    if (rows.length === 0) {
      // ── 사용자 계정 (6명) ──
      const users = [
        { empId: '20260001', name: '전호철', email: 'jhc0001@kiwoom.com', pw: 'jhc0001', dept: '주식운용팀', role: 'mentee' },
        { empId: '20260002', name: '진강연', email: 'jky0002@kiwoom.com', pw: 'jky0002', dept: '인사이트랩팀', role: 'mentee' },
        { empId: '20260003', name: '이소현', email: 'lsh0003@kiwoom.com', pw: 'lsh0003', dept: '인사팀', role: 'mentee' },
        { empId: '20260004', name: '박진영', email: 'jyp0004@kiwoom.com', pw: 'jyp0004', dept: '혁신성장리서치팀', role: 'mentee' },
        { empId: '20260005', name: '강다겸', email: 'kdg0005@kiwoom.com', pw: 'kdg0005', dept: 'AIX팀', role: 'mentee' },
        { empId: '20260006', name: '김지원', email: 'kjw0006@kiwoom.com', pw: 'kjw0006', dept: 'ESG추진팀', role: 'mentee' },
      ]

      const userIds: Record<string, string> = {}
      for (const u of users) {
        const result = await pool.query(
          `INSERT INTO users (employee_id, name, email, department, password_hash, role)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
          [u.empId, u.name, u.email, u.dept, hashPassword(u.pw), u.role]
        )
        userIds[u.empId] = result.rows[0].id
        console.log(`Seed user created: ${u.empId} (${u.name}) / ${u.pw}`)
      }

      // 첫 번째 유저를 기준으로 시드 데이터 생성
      const defaultUserId = userIds['20260001']

      // ── 공지사항 ──
      await pool.query(`
        INSERT INTO notices (title, content, category, author_id, pinned) VALUES
        ('2026년 상반기 신입사원 온보딩 일정 안내', '2026년 상반기 신입사원 여러분, 환영합니다!\n\n■ 온보딩 일정\n- 1주차: 회사소개, 정보보안 교육, 사내 시스템 안내\n- 2주차: 부서 배치 및 멘토 매칭, 업무용 PC 세팅\n- 3~4주차: 실무 적응 및 첫 과제 수행\n\n■ 필수 이수 항목\n- 정보보안 교육 (온라인, 30분)\n- 준법감시 교육 (온라인, 1시간)\n- 사내 시스템 권한 신청\n\n문의: 인사팀 (내선 2000)', '인사', '${defaultUserId}', true),
        ('전사 정보보안 교육 실시 안내 (필수)', '전 임직원 대상 연 1회 정보보안 교육을 아래와 같이 실시합니다.\n\n- 기간: 2026.04.07 ~ 2026.04.18\n- 방법: 온라인 교육 (인트라넷 → 인사시스템 → 교육)\n- 소요시간: 약 30분\n- 미이수 시 인사평가 반영\n\n보안 관련 문의: ICT부문 정보보안팀', '보안', '${defaultUserId}', true),
        ('법인카드 사용 기준 변경 안내', '4월부터 법인카드 사용 기준이 변경됩니다.\n\n■ 주요 변경 사항\n- 심야(23시 이후) 사용 시 사유서 필수 첨부\n- 접대비 건당 한도: 30만원\n- 월 누적 한도 초과 시 팀장 사전승인 필요\n\n상세 기준은 인트라넷 → 경영지원 → 법인카드 가이드를 참고해 주세요.', '경영지원', '${defaultUserId}', false),
        ('업무용 택시 서비스(카카오T 비즈니스) 이용 안내', '업무용 택시 서비스 이용 절차를 안내드립니다.\n\n■ 이용 가능 시간\n- 야근: 21시 이후 (팀장 사전승인)\n- 외근: 업무 시간 내 (사유 기재)\n- 출장: 공항/역 이동 시\n\n■ 신청 방법\n1. 카카오T 비즈니스 앱 설치\n2. 회사 이메일로 가입\n3. 총무팀에서 승인 후 이용 가능\n\n문의: 전략기획부문 총무팀', '총무', '${defaultUserId}', false),
        ('4월 사내 식당 메뉴 리뉴얼 안내', '4월부터 사내 식당 메뉴가 리뉴얼됩니다.\n\n- 샐러드바 상시 운영\n- 저염식 메뉴 추가\n- 간식 코너 운영시간: 14:00~16:00\n\n식단은 인트라넷 → 총무 게시판에서 매주 월요일 업데이트됩니다.', '총무', '${defaultUserId}', false)
      `)
      console.log('Seed notices created')

      // ── 메일 (첫 번째 유저에게) ──
      const hrUserId = userIds['20260003'] // 이소현 (인사팀)
      await pool.query(`
        INSERT INTO mails (from_id, to_id, subject, body) VALUES
        ('${hrUserId}', '${defaultUserId}', '환영합니다! 신입사원 온보딩 안내', '전호철님, 인사팀 이소현입니다.\n\n입사를 축하드립니다! 온보딩 일정을 안내드립니다.\n\n■ 이번 주 필수 사항\n1. 업무용 PC 프로그램 설치 (HTS, 보안 프로그램 등)\n2. 인트라넷 → 인사시스템 → IT 서비스 데스크에서 권한 신청\n3. 정보보안 교육 이수\n\n궁금한 점은 언제든 문의해 주세요!\n\n이소현 드림'),
        ('${hrUserId}', '${defaultUserId}', 'IT 시스템 권한 신청 안내', '전호철님,\n\nIT 시스템 권한 신청 방법 안내드립니다.\n\n■ 신청 경로\n인트라넷 상단 → 인사시스템 → IT 서비스 데스크 → 권한 신청\n\n■ 필수 신청 항목\n- 그룹웨어/메일 계정\n- VPN 접속 권한\n- ERP 시스템 접근\n- 업무 관련 DB 접근 (팀장 승인 필요)\n\n모든 권한은 소속 팀장 승인 후 IT 지원팀에서 처리됩니다.\n\n이소현 드림')
      `)
      console.log('Seed mails created')

      // ── 회의실 ──
      await pool.query(`
        INSERT INTO meeting_rooms (name, floor, capacity, equipment, color) VALUES
        ('대회의실 A', '3F', 20, '프로젝터, 화이트보드, 화상회의', '#3B82F6'),
        ('대회의실 B', '3F', 20, '프로젝터, 화이트보드', '#10B981'),
        ('소회의실 1', '4F', 6, '모니터, 화이트보드', '#F59E0B'),
        ('소회의실 2', '4F', 6, '모니터', '#EF4444'),
        ('소회의실 3', '5F', 4, '모니터', '#8B5CF6'),
        ('임원회의실', '6F', 12, '프로젝터, 화상회의, 음향시스템', '#EC4899')
        ON CONFLICT (name) DO NOTHING
      `)
      console.log('Seed meeting rooms created')
    }
  } finally {
    await pool.end()
  }
}
