import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  integer,
  date,
  boolean as pgBoolean,
} from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  employeeId: varchar('employee_id', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  department: varchar('department', { length: 100 }).notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: varchar('role', { length: 20 }).notNull().default('mentee'),
  employeeRefId: uuid('employee_ref_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export type UserRow = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  title: varchar('title', { length: 255 }).notNull().default('New Conversation'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export type ConversationRow = typeof conversations.$inferSelect
export type NewConversation = typeof conversations.$inferInsert

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').notNull().references(() => conversations.id),
  role: varchar('role', { length: 20 }).notNull(), // 'user' | 'assistant'
  content: text('content').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export type MessageRow = typeof messages.$inferSelect
export type NewMessage = typeof messages.$inferInsert

export const chatLogs = pgTable('chat_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  question: text('question').notNull(),
  answer: text('answer').notNull(),
  sources: jsonb('sources').$type<Array<{ title: string; content: string }>>(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const feedback = pgTable('feedback', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  messageId: uuid('message_id'),
  rating: varchar('rating', { length: 20 }),
  comment: text('comment'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// ──────────────────────────────────────
// 인트라넷: 공지게시판
// ──────────────────────────────────────
export const notices = pgTable('notices', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content').notNull(),
  category: varchar('category', { length: 50 }).notNull().default('일반'),
  authorId: uuid('author_id').references(() => users.id),
  pinned: pgBoolean('pinned').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export type NoticeRow = typeof notices.$inferSelect
export type NewNotice = typeof notices.$inferInsert

// ──────────────────────────────────────
// 인트라넷: 연차/휴가 신청
// ──────────────────────────────────────
export const leaveRequests = pgTable('leave_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  leaveType: varchar('leave_type', { length: 30 }).notNull(), // 'annual' | 'half_am' | 'half_pm' | 'sick' | 'special'
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  reason: text('reason').notNull().default(''),
  status: varchar('status', { length: 20 }).notNull().default('pending'), // 'pending' | 'approved' | 'rejected'
  approverId: uuid('approver_id').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export type LeaveRequestRow = typeof leaveRequests.$inferSelect
export type NewLeaveRequest = typeof leaveRequests.$inferInsert

// ──────────────────────────────────────
// 인트라넷: 품의/경비 정산
// ──────────────────────────────────────
export const expenses = pgTable('expenses', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  title: varchar('title', { length: 255 }).notNull(),
  category: varchar('category', { length: 50 }).notNull(), // 'taxi' | 'meal' | 'supplies' | 'travel' | 'etc'
  amount: integer('amount').notNull(),
  description: text('description').notNull().default(''),
  expenseDate: date('expense_date').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'), // 'pending' | 'approved' | 'rejected'
  approverId: uuid('approver_id').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export type ExpenseRow = typeof expenses.$inferSelect
export type NewExpense = typeof expenses.$inferInsert

// ──────────────────────────────────────
// 인트라넷: 메일함
// ──────────────────────────────────────
export const mails = pgTable('mails', {
  id: uuid('id').primaryKey().defaultRandom(),
  fromId: uuid('from_id').notNull().references(() => users.id),
  toId: uuid('to_id').notNull().references(() => users.id),
  subject: varchar('subject', { length: 255 }).notNull(),
  body: text('body').notNull(),
  fromText: text('from_text').default(''),
  toText: text('to_text').default(''),
  cc: text('cc').default(''),
  isRead: pgBoolean('is_read').notNull().default(false),
  starred: pgBoolean('starred').notNull().default(false),
  deleted: pgBoolean('deleted').notNull().default(false),
  isDraft: pgBoolean('is_draft').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export type MailRow = typeof mails.$inferSelect
export type NewMail = typeof mails.$inferInsert

// ──────────────────────────────────────
// 온보딩: 과제
// ──────────────────────────────────────
export const assignments = pgTable('assignments', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull().default(''),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  assignedTo: uuid('assigned_to').notNull().references(() => users.id),
  status: varchar('status', { length: 20 }).notNull().default('pending'), // 'pending' | 'submitted' | 'completed'
  dueDate: date('due_date'),
  submission: text('submission'),
  feedback: text('feedback'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export type AssignmentRow = typeof assignments.$inferSelect
export type NewAssignment = typeof assignments.$inferInsert

// ──────────────────────────────────────
// 임직원 프로필 (주소록)
// ──────────────────────────────────────
export const employees = pgTable('employees', {
  id: uuid('id').primaryKey().defaultRandom(),
  employeeId: varchar('employee_id', { length: 20 }).notNull().unique(),
  name: varchar('name', { length: 50 }).notNull(),
  gender: varchar('gender', { length: 10 }),
  birthDate: date('birth_date'),
  division: varchar('division', { length: 100 }),   // 부문
  department: varchar('department', { length: 100 }), // 본부
  team: varchar('team', { length: 100 }),             // 팀
  rank: varchar('rank', { length: 50 }),              // 직급
  position: varchar('position', { length: 50 }),      // 직책
  joinDate: date('join_date'),
  tenure: varchar('tenure', { length: 20 }),          // 근속년수
  email: varchar('email', { length: 100 }),
  phone: varchar('phone', { length: 30 }),            // 내선번호
  mbti: varchar('mbti', { length: 10 }),
  duty: text('duty'),                                 // 담당업무
  status: varchar('status', { length: 20 }).default('온라인'), // 상태
})

export type EmployeeRow = typeof employees.$inferSelect

// ──────────────────────────────────────
// 캘린더 일정
// ──────────────────────────────────────
export const calendarEvents = pgTable('calendar_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').default(''),
  eventDate: date('event_date').notNull(),
  startTime: varchar('start_time', { length: 10 }).notNull(),
  endTime: varchar('end_time', { length: 10 }).default(''),
  location: varchar('location', { length: 100 }).default(''),
  color: varchar('color', { length: 20 }).default('#3B82F6'),
  isCompany: pgBoolean('is_company').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// ──────────────────────────────────────
// 회의실 예약
// ──────────────────────────────────────
export const meetingRooms = pgTable('meeting_rooms', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 50 }).notNull().unique(),
  floor: varchar('floor', { length: 10 }).default(''),
  capacity: integer('capacity').default(0),
  equipment: text('equipment').default(''),
  color: varchar('color', { length: 20 }).default('#3B82F6'),
})

export const roomReservations = pgTable('room_reservations', {
  id: uuid('id').primaryKey().defaultRandom(),
  roomId: uuid('room_id').notNull().references(() => meetingRooms.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  title: varchar('title', { length: 255 }).notNull(),
  reserveDate: date('reserve_date').notNull(),
  startTime: varchar('start_time', { length: 10 }).notNull(),
  endTime: varchar('end_time', { length: 10 }).notNull(),
  attendees: text('attendees').default(''),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// ──────────────────────────────────────
// 온보딩 설문
// ──────────────────────────────────────
export const surveyQuestions = pgTable('survey_questions', {
  id: uuid('id').primaryKey().defaultRandom(),
  quarter: integer('quarter').notNull(),
  quarterLabel: varchar('quarter_label', { length: 50 }).notNull(),
  stageName: varchar('stage_name', { length: 100 }).notNull(),
  goal: varchar('goal', { length: 200 }).notNull(),
  q1: text('q1').notNull(),
  q2: text('q2').notNull(),
  q3: text('q3').notNull(),
  freeQuestion: text('free_question').notNull(),
})

export const surveyResponses = pgTable('survey_responses', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  quarter: integer('quarter').notNull(),
  q1Score: integer('q1_score'),
  q2Score: integer('q2_score'),
  q3Score: integer('q3_score'),
  freeAnswer: text('free_answer'),
  analysis: text('analysis'),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  currentStep: integer('current_step').default(0),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// ──────────────────────────────────────
// 결재함 (보고서/기안)
// ──────────────────────────────────────
export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  title: varchar('title', { length: 255 }).notNull(),
  category: varchar('category', { length: 50 }).notNull(), // 'AB테스트' | 'KPI' | '알고리즘' | '고객분석' | '콘텐츠' | '주간동향'
  content: text('content').notNull(),
  author: varchar('author', { length: 100 }).notNull(), // 원 작성자 (ex. 구수아 과장)
  status: varchar('status', { length: 20 }).notNull().default('submitted'), // 'draft' | 'submitted' | 'approved' | 'rejected'
  approverId: uuid('approver_id').references(() => users.id),
  fileName: varchar('file_name', { length: 255 }),
  submittedAt: timestamp('submitted_at').defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export type DocumentRow = typeof documents.$inferSelect
export type NewDocument = typeof documents.$inferInsert

// ──────────────────────────────────────
// 좋은 질문-답변 저장 (도움이 됐어요 피드백)
// ──────────────────────────────────────
export const goodAnswers = pgTable('good_answers', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  conversationId: uuid('conversation_id'),
  question: text('question').notNull(),
  answer: text('answer').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})
