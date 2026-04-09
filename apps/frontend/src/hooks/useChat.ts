'use client'

import { useState, useEffect, useRef } from 'react'
import type { Message, ChatMode, FeedbackRating, Conversation } from '@chat-ki-s/shared'
import { sendMessage, sendFeedback, getConversations, getConversationMessages, executeAgentAction, deleteConversation as deleteConversationApi } from '@/lib/api'

export interface SavedMessage {
  id: string
  content: string
  createdAt: Date
  conversationId: string
}

export interface UseChatReturn {
  messages: Message[]
  conversationId: string | undefined
  sending: boolean
  pageContextRef: React.MutableRefObject<string>
  handleSend: (content: string, mode: ChatMode) => Promise<void>
  handleFeedback: (messageId: string, rating: FeedbackRating) => Promise<void>
  feedbackMap: Record<string, FeedbackRating>
  savedMessages: Set<string>
  savedMessagesList: SavedMessage[]
  handleSave: (messageId: string) => void
  conversations: Conversation[]
  loadConversation: (conversationId: string) => Promise<void>
  deleteConversation: (conversationId: string) => void
  handleAgentConfirm: (messageId: string) => Promise<void>
  handleAgentCancel: (messageId: string) => void
  agentResolved: Set<string>
}

const SAVED_KEY = 'chat-ki-s:saved-messages'

function loadSavedList(): SavedMessage[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function persistSavedList(list: SavedMessage[]) {
  localStorage.setItem(SAVED_KEY, JSON.stringify(list))
}

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>([])
  const [conversationId, setConversationId] = useState<string | undefined>()
  const [sending, setSending] = useState(false)
  const pageContextRef = useRef<string>('')
  const [feedbackMap, setFeedbackMap] = useState<Record<string, FeedbackRating>>({})
  const [savedMessagesList, setSavedMessagesList] = useState<SavedMessage[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])

  const savedMessages = new Set(savedMessagesList.map((m) => m.id))

  useEffect(() => {
    setSavedMessagesList(loadSavedList())
    getConversations().then(setConversations).catch(() => {})
  }, [])

  async function handleSend(content: string, mode: ChatMode) {
    const userMessage: Message = {
      id: crypto.randomUUID(),
      conversationId: conversationId ?? '',
      role: 'user',
      content,
      createdAt: new Date(),
    }
    setMessages((prev) => [...prev, userMessage])
    setSending(true)

    try {
      const res = await sendMessage({ content, mode, conversationId, pageContext: pageContextRef.current || undefined })
      setConversationId(res.conversationId)
      setMessages((prev) => [...prev, res.message])
      getConversations().then(setConversations).catch(() => {})
    } catch (err) {
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        conversationId: conversationId ?? '',
        role: 'assistant',
        content: `죄송해요, 일시적인 오류가 발생했어요 😢\n다시 한번 질문해 주세요!`,
        createdAt: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setSending(false)
    }
  }

  async function handleFeedback(messageId: string, rating: FeedbackRating) {
    if (feedbackMap[messageId]) return
    setFeedbackMap((prev) => ({ ...prev, [messageId]: rating }))
    try {
      await sendFeedback({ messageId, rating })
    } catch {
      setFeedbackMap((prev) => {
        const next = { ...prev }
        delete next[messageId]
        return next
      })
    }
  }

  function handleSave(messageId: string) {
    setSavedMessagesList((prev) => {
      let next: SavedMessage[]
      if (prev.some((m) => m.id === messageId)) {
        next = prev.filter((m) => m.id !== messageId)
      } else {
        const msg = messages.find((m) => m.id === messageId)
        if (!msg) return prev
        next = [...prev, {
          id: msg.id,
          content: msg.content,
          createdAt: msg.createdAt,
          conversationId: msg.conversationId || conversationId || '',
        }]
      }
      persistSavedList(next)
      return next
    })
  }

  const [agentResolved, setAgentResolved] = useState<Set<string>>(new Set())

  async function handleAgentConfirm(messageId: string) {
    const msg = messages.find((m) => m.id === messageId)
    if (!msg?.agentAction) return

    try {
      const result = await executeAgentAction({
        action: msg.agentAction.action,
        params: msg.agentAction.params,
      })
      setAgentResolved((prev) => new Set([...prev, messageId]))

      // 설문 시작 → 유저 메시지 없이 바로 설문 시작
      if (msg.agentAction.action === 'start_survey') {
        const quarter = msg.agentAction.params.quarter ?? 0
        setSending(true)
        try {
          const res = await sendMessage({ content: `설문 ${quarter}분기 시작`, mode: 'rag', conversationId })
          setConversationId(res.conversationId)
          // 유저 메시지 제거하고 봇 응답만 추가
          setMessages((prev) => [...prev, res.message])
        } catch {} finally { setSending(false) }
        return
      }

      // 일반 액션 → 결과 메시지 추가
      const resultMessage: Message = {
        id: crypto.randomUUID(),
        conversationId: msg.conversationId,
        role: 'assistant',
        content: result.message,
        createdAt: new Date(),
      }
      setMessages((prev) => [...prev, resultMessage])
    } catch {
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        conversationId: msg.conversationId,
        role: 'assistant',
        content: '처리 중 오류가 발생했습니다. 다시 시도해 주세요.',
        createdAt: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    }
  }

  function handleAgentCancel(messageId: string) {
    setAgentResolved((prev) => new Set([...prev, messageId]))
    const cancelMessage: Message = {
      id: crypto.randomUUID(),
      conversationId: conversationId ?? '',
      role: 'assistant',
      content: '취소했어요. 다른 도움이 필요하면 말씀해 주세요!',
      createdAt: new Date(),
    }
    setMessages((prev) => [...prev, cancelMessage])
  }

  async function deleteConversation(id: string) {
    // 서버에서 삭제
    try { await deleteConversationApi(id) } catch {}
    // 해당 대화에 속하는 메시지 ID들 수집 (conversationId가 빈 문자열인 경우도 처리)
    const msgIdsInConv = new Set(
      messages.filter((m) => m.conversationId === id || (m.conversationId === '' && conversationId === id)).map((m) => m.id)
    )
    // 저장된 채팅에서 해당 대화의 메시지 제거
    setSavedMessagesList((prev) => {
      const next = prev.filter((m) => m.conversationId !== id && !msgIdsInConv.has(m.id))
      persistSavedList(next)
      return next
    })
    // 대화 목록에서 제거
    setConversations((prev) => prev.filter((c) => c.id !== id))
    // 현재 보고 있던 대화가 삭제된 경우 초기화
    if (conversationId === id) {
      setMessages([])
      setConversationId(undefined)
    }
  }

  async function loadConversation(id: string) {
    if (!id) {
      setMessages([])
      setConversationId(undefined)
      return
    }
    try {
      const msgs = await getConversationMessages(id)
      setMessages(msgs)
      setConversationId(id)
    } catch {}
  }

  return {
    messages,
    setMessages,
    conversationId,
    sending,
    pageContextRef,
    handleSend,
    handleFeedback,
    feedbackMap,
    savedMessages,
    savedMessagesList,
    handleSave,
    conversations,
    loadConversation,
    deleteConversation,
    handleAgentConfirm,
    handleAgentCancel,
    agentResolved,
  }
}
