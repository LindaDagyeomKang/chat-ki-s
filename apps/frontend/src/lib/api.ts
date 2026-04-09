import type {
  LoginRequest,
  LoginResponse,
  SendMessageRequest,
  SendMessageResponse,
  FeedbackRequest,
  FeedbackResponse,
  Conversation,
} from '@chat-ki-s/shared'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

// Token management
export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('accessToken')
}

export function setToken(token: string): void {
  localStorage.setItem('accessToken', token)
}

export function clearToken(): void {
  localStorage.removeItem('accessToken')
}

// Nickname management
const NICKNAME_KEY = 'chat-ki-s:bot-nickname'
const DEFAULT_NICKNAME = '루키'

export function getBotNickname(): string {
  if (typeof window === 'undefined') return DEFAULT_NICKNAME
  return localStorage.getItem(NICKNAME_KEY) || DEFAULT_NICKNAME
}

export function setBotNickname(name: string): void {
  localStorage.setItem(NICKNAME_KEY, name.trim() || DEFAULT_NICKNAME)
}

// User info
export async function getMe(): Promise<{ id: string; employeeId: string; name: string; email: string; department: string; role: string }> {
  return apiFetch('/api/me')
}

// Auto login (백그라운드에서 기본 계정으로 자동 인증)
export async function ensureAuth(): Promise<void> {
  const token = getToken()
  if (token) {
    // 토큰 유효성 확인
    try {
      await apiFetch('/api/me')
      return
    } catch {
      clearToken()
    }
  }
  // 자동 로그인
  await login({ employeeId: '20260001', password: 'jhc0001' })
}

// Base fetch with auth header
async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken()
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }

  return res.json() as Promise<T>
}

// Auth
export async function login(data: LoginRequest): Promise<LoginResponse> {
  const result = await apiFetch<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  setToken(result.accessToken)
  return result
}

export async function logout(): Promise<void> {
  clearToken()
}

// Conversations
export async function getConversations(): Promise<Conversation[]> {
  return apiFetch<Conversation[]>('/api/conversations')
}

export async function deleteConversation(conversationId: string): Promise<{ success: boolean }> {
  return apiFetch(`/api/conversations/${conversationId}`, { method: 'DELETE' })
}

export async function getConversationMessages(conversationId: string) {
  return apiFetch<import('@chat-ki-s/shared').Message[]>(`/api/conversations/${conversationId}/messages`)
}

// Chat
export async function sendMessage(
  data: SendMessageRequest
): Promise<SendMessageResponse> {
  let { conversationId } = data
  if (!conversationId) {
    const conv = await apiFetch<{ id: string }>('/api/conversations', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    conversationId = conv.id
  }
  return apiFetch<SendMessageResponse>(`/api/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content: data.content, mode: data.mode, ...(data.pageContext ? { pageContext: data.pageContext } : {}) }),
  })
}

// Feedback
export async function sendFeedback(
  data: FeedbackRequest
): Promise<FeedbackResponse> {
  return apiFetch<FeedbackResponse>('/api/feedback', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// ── Intranet APIs ──

export interface Notice {
  id: string
  title: string
  content: string
  category: string
  authorId: string | null
  pinned: boolean
  createdAt: string
  updatedAt: string
}

export interface LeaveRequest {
  id: string
  userId: string
  leaveType: string
  startDate: string
  endDate: string
  reason: string
  status: string
  approverId: string | null
  createdAt: string
  updatedAt: string
}

export interface Expense {
  id: string
  userId: string
  title: string
  category: string
  amount: number
  description: string
  expenseDate: string
  status: string
  approverId: string | null
  createdAt: string
  updatedAt: string
}

// Notices
export async function getNotices(): Promise<Notice[]> {
  return apiFetch<Notice[]>('/api/notices')
}

export async function getNotice(id: string): Promise<Notice> {
  return apiFetch<Notice>(`/api/notices/${id}`)
}

// Leaves
export async function getLeaves(): Promise<LeaveRequest[]> {
  return apiFetch<LeaveRequest[]>('/api/leaves')
}

export async function createLeave(data: { leaveType: string; startDate: string; endDate: string; reason?: string }): Promise<LeaveRequest> {
  return apiFetch<LeaveRequest>('/api/leaves', { method: 'POST', body: JSON.stringify(data) })
}

// Expenses
export async function getExpenses(): Promise<Expense[]> {
  return apiFetch<Expense[]>('/api/expenses')
}

export async function createExpense(data: { title: string; category: string; amount: number; description?: string; expenseDate: string }): Promise<Expense> {
  return apiFetch<Expense>('/api/expenses', { method: 'POST', body: JSON.stringify(data) })
}

export async function deleteLeave(id: string): Promise<{ success: boolean }> {
  return apiFetch(`/api/leaves/${id}`, { method: 'DELETE' })
}

export async function deleteExpense(id: string): Promise<{ success: boolean }> {
  return apiFetch(`/api/expenses/${id}`, { method: 'DELETE' })
}

// Mails
export interface Mail {
  id: string
  fromId: string
  toId: string
  subject: string
  body: string
  fromText?: string
  toText?: string
  cc?: string
  isRead: boolean
  starred?: boolean
  createdAt: string
}

export async function getInbox(): Promise<Mail[]> {
  return apiFetch<Mail[]>('/api/mails/inbox')
}

export async function getSentMails(): Promise<Mail[]> {
  return apiFetch<Mail[]>('/api/mails/sent')
}

export async function getStarredMails(): Promise<Mail[]> {
  return apiFetch<Mail[]>('/api/mails/starred')
}

export async function getDraftMails(): Promise<Mail[]> {
  return apiFetch<Mail[]>('/api/mails/drafts')
}

export async function getTrashMails(): Promise<Mail[]> {
  return apiFetch<Mail[]>('/api/mails/trash')
}

export async function getMail(id: string): Promise<Mail> {
  return apiFetch<Mail>(`/api/mails/${id}`)
}

export async function toggleStarMail(id: string): Promise<{ starred: string }> {
  return apiFetch(`/api/mails/${id}/star`, { method: 'PATCH', body: '{}' })
}

export async function deleteMail(id: string): Promise<{ success: boolean }> {
  return apiFetch(`/api/mails/${id}/delete`, { method: 'PATCH', body: '{}' })
}

export async function restoreMail(id: string): Promise<{ success: boolean }> {
  return apiFetch(`/api/mails/${id}/restore`, { method: 'PATCH', body: '{}' })
}

export async function sendMail(data: { toEmployeeId: string; subject: string; body: string }): Promise<Mail> {
  return apiFetch<Mail>('/api/mails', { method: 'POST', body: JSON.stringify(data) })
}

// Employees
export interface Employee {
  id: string; employeeId: string; name: string; gender?: string; division?: string
  department?: string; team?: string; rank?: string; position?: string
  email?: string; phone?: string; duty?: string; notice?: string; status?: string
}

export async function searchEmployees(q: string, division?: string): Promise<Employee[]> {
  if (division) return apiFetch<Employee[]>(`/api/employees/search?division=${encodeURIComponent(division)}`)
  return apiFetch<Employee[]>(`/api/employees/search?q=${encodeURIComponent(q)}`)
}

export async function getEmployeeDivisions(): Promise<string[]> {
  return apiFetch<string[]>('/api/employees/divisions')
}

export async function getEmployeeTeams(division?: string): Promise<string[]> {
  const q = division ? `?division=${encodeURIComponent(division)}` : ''
  return apiFetch<string[]>(`/api/employees/teams${q}`)
}

export async function getEmployeeList(page: number = 1): Promise<{ data: Employee[]; total: number }> {
  return apiFetch(`/api/employees?page=${page}&limit=20`)
}

// Assignments
export interface Assignment {
  id: string; title: string; description: string; createdBy: string; assignedTo: string
  status: string; dueDate: string | null; submission: string | null; feedback: string | null
  createdAt: string; updatedAt: string
}

export async function getAssignments(): Promise<Assignment[]> {
  return apiFetch<Assignment[]>('/api/assignments')
}

export async function submitAssignment(id: string, submission: string): Promise<Assignment> {
  return apiFetch(`/api/assignments/${id}/submit`, { method: 'PATCH', body: JSON.stringify({ submission }) })
}

// Calendar
export interface CalendarEvent {
  id: string; userId: string; title: string; description: string
  eventDate: string; startTime: string; endTime: string
  location: string; color: string; createdAt: string
}

export async function getCalendarEvents(start?: string, end?: string): Promise<CalendarEvent[]> {
  const params = new URLSearchParams()
  if (start) params.set('start', start)
  if (end) params.set('end', end)
  return apiFetch<CalendarEvent[]>(`/api/calendar?${params}`)
}

export async function createCalendarEvent(data: { title: string; eventDate: string; startTime: string; endTime?: string; location?: string; description?: string; color?: string }): Promise<CalendarEvent> {
  return apiFetch<CalendarEvent>('/api/calendar', { method: 'POST', body: JSON.stringify(data) })
}

export async function deleteCalendarEvent(id: string): Promise<{ success: boolean }> {
  return apiFetch(`/api/calendar/${id}`, { method: 'DELETE' })
}

export async function updateCalendarEvent(id: string, data: Partial<{ title: string; eventDate: string; startTime: string; endTime: string; location: string }>): Promise<{ success: boolean }> {
  return apiFetch(`/api/calendar/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
}

// Notifications
export async function getNotifications(): Promise<{ notifications: { id: string; type: string; payload: any; created_at: string }[]; unreadCount: number }> {
  return apiFetch('/api/notifications')
}

export async function markNotificationDelivered(id: string): Promise<{ success: boolean }> {
  return apiFetch(`/api/notifications/${id}/delivered`, { method: 'POST', body: '{}' })
}

// Agent
export async function executeAgentAction(data: { action: string; params: Record<string, unknown> }): Promise<{ success: boolean; message: string }> {
  return apiFetch('/api/agent/execute', { method: 'POST', body: JSON.stringify(data) })
}

// Approvals (mentor)
export interface PendingLeave {
  id: string; userId: string; leaveType: string; startDate: string; endDate: string
  reason: string; status: string; createdAt: string; userName: string; employeeId: string; department: string
}
export interface PendingExpense {
  id: string; userId: string; title: string; category: string; amount: number
  description: string; expenseDate: string; status: string; createdAt: string; userName: string; employeeId: string; department: string
}

export async function getApprovals(): Promise<{ leaves: PendingLeave[]; expenses: PendingExpense[]; total: number }> {
  return apiFetch('/api/approvals')
}

export async function approveLeave(id: string, status: 'approved' | 'rejected'): Promise<LeaveRequest> {
  return apiFetch(`/api/leaves/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
}

export async function approveExpense(id: string, status: 'approved' | 'rejected'): Promise<Expense> {
  return apiFetch(`/api/expenses/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
}
