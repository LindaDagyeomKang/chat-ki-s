// Shared types for Chat-Ki-S

export interface User {
  id: string
  employeeId: string
  name: string
  email: string
  department: string
  createdAt: Date
}

export interface Source {
  title: string
  url?: string
  excerpt?: string
}

export interface AgentAction {
  action: string
  params: Record<string, unknown>
  confirmationMessage: string
}

export interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
  agentAction?: AgentAction
  suggestedQuestions?: string[]
  createdAt: Date
}

export interface Conversation {
  id: string
  userId: string
  title: string
  messages: Message[]
  createdAt: Date
  updatedAt: Date
}

export type ChatMode = 'rag' | 'objective'

export interface SendMessageRequest {
  conversationId?: string
  content: string
  mode: ChatMode
  pageContext?: string
}

export interface SendMessageResponse {
  conversationId: string
  message: Message
}

export type FeedbackRating = 'helpful' | 'unhelpful'

export interface FeedbackRequest {
  messageId: string
  rating: FeedbackRating
}

export interface FeedbackResponse {
  id: string
  createdAt: Date
}

export interface LoginRequest {
  employeeId: string
  password: string
}

export interface LoginResponse {
  accessToken: string
  user: User
}
