import { Pool } from 'pg'
import { readFileSync } from 'fs'
import { join } from 'path'

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

-- agent_logs 테이블 삭제 (good_answers로 대체)
DROP TABLE IF EXISTS agent_logs;

-- 좋은 질문-답변 저장 (도움이 됐어요 피드백)
CREATE TABLE IF NOT EXISTS good_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  conversation_id UUID,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
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

-- 결재함 (보고서/기안)
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  author VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'submitted',
  approver_id UUID REFERENCES users(id),
  file_name VARCHAR(255),
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══ ALTER statements (must come after all CREATE TABLEs) ═══

-- Add file_name to documents
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_name VARCHAR(255);

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
`

export async function runMigrations(): Promise<void> {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/chat_ki_s',
  })
  try {
    await pool.query(CREATE_TABLES_SQL)
    console.log('Migrations complete')

    // Seed data if no users exist or FORCE_RESEED is set
    const { rows } = await pool.query('SELECT id FROM users LIMIT 1')
    if (rows.length === 0 || process.env.FORCE_RESEED === 'true') {
      if (rows.length > 0) {
        // Clear existing data for reseed (FK order)
        await pool.query(`
          DELETE FROM documents;
          DELETE FROM room_reservations; DELETE FROM meeting_rooms;
          DELETE FROM calendar_events; DELETE FROM survey_responses; DELETE FROM survey_questions;
          DELETE FROM mails; DELETE FROM assignments; DELETE FROM notices;
          DELETE FROM leave_requests; DELETE FROM expenses;
          DELETE FROM good_answers; DELETE FROM feedback; DELETE FROM chat_logs;
          DELETE FROM messages; DELETE FROM conversations;
          DELETE FROM employees; DELETE FROM users;
        `)
        console.log('Existing data cleared for reseed')
      }
      const seedPath = join(__dirname, 'seed.sql')
      const seedSql = readFileSync(seedPath, 'utf-8')
      await pool.query(seedSql)
      console.log('Seed data loaded from seed.sql')
    }
  } finally {
    await pool.end()
  }
}
