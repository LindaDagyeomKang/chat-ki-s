'use client'

import { useRef, useEffect, useState } from 'react'
import type { FeedbackRating } from '@chat-ki-s/shared'
import type { UseChatReturn } from '@/hooks/useChat'
import Message from '@/components/Message'
import ChatInput from '@/components/ChatInput'
import type { ChatMode } from '@chat-ki-s/shared'
import type { PageContextData } from '@/contexts/PageContext'
import { getNotifications, markNotificationDelivered } from '@/lib/api'

interface FloatingChatProps {
  chat: Partial<UseChatReturn> & Pick<UseChatReturn, 'messages' | 'sending' | 'handleSend' | 'handleFeedback' | 'feedbackMap' | 'savedMessages' | 'handleSave'>
  onExpand?: () => void
  onOpenChange?: (open: boolean) => void
  botName?: string
  defaultOpen?: boolean
  pageContext?: PageContextData
}

export default function FloatingChat({ chat, onExpand, onOpenChange, botName = '키링', defaultOpen = true, pageContext }: FloatingChatProps) {
  const { messages, sending, handleSend: rawHandleSend, handleFeedback, feedbackMap, savedMessages, handleSave } = chat
  const loadConversation = (chat as any).loadConversation as ((id: string) => Promise<void>) | undefined

  // 페이지 컨텍스트를 useChat의 ref에 동기화
  const pageContextRef = (chat as any).pageContextRef as React.MutableRefObject<string> | undefined
  useEffect(() => {
    if (pageContextRef && pageContext?.type && pageContext.content) {
      const typeLabel = pageContext.type === 'mail' ? '메일' : pageContext.type === 'notice' ? '공지사항' : pageContext.type === 'employee' ? '직원 프로필' : pageContext.type === 'assignment' ? '과제' : pageContext.type === 'hr' ? '인사시스템' : '항목'
      pageContextRef.current = `[현재 보고 있는 ${typeLabel}]\n제목: ${pageContext.title}\n${pageContext.metadata ? pageContext.metadata + '\n' : ''}내용: ${pageContext.content.slice(0, 800)}`
    } else if (pageContextRef) {
      pageContextRef.current = ''
    }
  }, [pageContext, pageContextRef])

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const [size, setSize] = useState({ w: 380, h: 580 })
  const [pos, setPos] = useState({ x: -1, y: -1 }) // -1 = 기본 위치 (right:24, bottom:24)
  const resizing = useRef(false)
  const dragging = useRef(false)
  const startPos = useRef({ x: 0, y: 0, w: 0, h: 0 })
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 })
  const [unreadCount, setUnreadCount] = useState(0)
  const [pendingNotifications, setPendingNotifications] = useState<any[]>([])
  const [showFaq, setShowFaq] = useState(false)

  // 알림 체크 (30초마다)
  useEffect(() => {
    async function checkNotifications() {
      try {
        const data = await getNotifications()
        setUnreadCount(data.unreadCount)
        setPendingNotifications(data.notifications)
      } catch {}
    }
    checkNotifications()
    const timer = setInterval(checkNotifications, 30000)
    return () => clearInterval(timer)
  }, [])

  // 챗봇 열릴 때 알림 → 챗봇이 먼저 인사 메시지 표시
  const [surveyQuarter, setSurveyQuarter] = useState<number | null>(null)

  useEffect(() => {
    if (isOpen && pendingNotifications.length > 0) {
      (async () => {
        for (const n of pendingNotifications) {
          if (n.type === 'survey') {
            const quarter = n.payload?.quarter ?? 0
            const labels = ['1개월', '2개월', '4개월', '6개월', '1년']
            const label = labels[quarter] || `${quarter + 1}분기`
            setSurveyQuarter(quarter)

            // 새 대화 생성 후 전환
            if (loadConversation) {
              await loadConversation('')  // 빈 문자열 → 새 대화
            }

            // 챗봇이 먼저 말하기 — assistant 메시지 직접 삽입
            const setMessages = (chat as any).setMessages
            if (typeof setMessages === 'function') {
              setTimeout(() => {
                setMessages((prev: any[]) => [...prev, {
                  id: crypto.randomUUID(),
                  conversationId: '',
                  role: 'assistant' as const,
                  content: `강연님, 입사 ${label}을 축하드립니다! 🎉\n\n온보딩 과정이 잘 진행되고 있는지 짧은 설문을 통해 확인하고 싶어요.\n총 4개 질문이며, 약 1분 정도 소요됩니다.\n\n본 설문은 인사고과 등 평가에 일절 반영되지 않으며, 온전히 온보딩 프로세스 개선 목적으로만 활용되니 편하게 답변해 주세요.\n\n아래 버튼을 눌러 설문을 시작해 주세요!`,
                  createdAt: new Date(),
                  agentAction: {
                    action: 'start_survey',
                    params: { quarter },
                    confirmationMessage: `온보딩 ${label}차 설문을 시작할까요?`,
                  },
                }])
              }, 300)
            }

            markNotificationDelivered(n.id).catch(() => {})
          }
        }
        setPendingNotifications([])
        setUnreadCount(0)
      })()
    }
  }, [isOpen, pendingNotifications.length])

  // 미션 시작 시 챗봇 메시지 트리거 (칸반에서 in_progress로 이동)
  useEffect(() => {
    function handleMissionChat() {
      try {
        const raw = localStorage.getItem('chat-ki-s:mission-chat')
        if (!raw) return
        const data = JSON.parse(raw)
        if (Date.now() - data.timestamp > 5000) return // 5초 이내만

        localStorage.removeItem('chat-ki-s:mission-chat')
        setIsOpen(true)

        // 새 대화로 시작
        const setMessages = (chat as any).setMessages
        const setConversationId = (chat as any).setConversationId
        if (typeof setMessages === 'function') {
          if (typeof setConversationId === 'function') {
            setConversationId(undefined)
          }
          setTimeout(() => {
            setMessages([{
              id: crypto.randomUUID(),
              conversationId: '',
              role: 'assistant' as const,
              content: `'${data.title}' 미션을 시작하셨군요!\n\n${data.message}`,
              createdAt: new Date(),
            }])
          }, 300)
        }
      } catch {}
    }

    window.addEventListener('storage', handleMissionChat)
    return () => window.removeEventListener('storage', handleMissionChat)
  }, [chat])

  function handleSend(content: string, mode: ChatMode) {
    rawHandleSend(content, mode)
  }

  // 외부에서 defaultOpen이 바뀌면 동기화
  useEffect(() => {
    setIsOpen(defaultOpen)
  }, [defaultOpen])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleOpen() {
    setIsOpen(true)
    onOpenChange?.(true)
  }

  function handleClose() {
    setIsOpen(false)
    onOpenChange?.(false)
  }

  if (!isOpen) {
    return (
      <button
        onClick={handleOpen}
        className="fixed bottom-6 right-6 z-50 w-16 h-16 rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center"
        style={{ background: '#111547' }}
        aria-label="챗봇 열기"
      >
        <img src="/images/image 4.png" alt={botName} className="w-10 h-10" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-white font-bold" style={{ background: '#EF4444', fontSize: 10 }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
    )
  }

  function handleResizeStart(e: React.MouseEvent) {
    e.preventDefault()
    resizing.current = true
    startPos.current = { x: e.clientX, y: e.clientY, w: size.w, h: size.h }

    function onMove(ev: MouseEvent) {
      if (!resizing.current) return
      const dw = startPos.current.x - ev.clientX
      const dh = startPos.current.y - ev.clientY
      const newW = Math.max(300, Math.min(600, startPos.current.w + dw))
      const newH = Math.max(400, Math.min(window.innerHeight - 48, startPos.current.h + dh))
      setSize({ w: newW, h: newH })
      // 위치도 화면 안으로 보정
      setPos((prev) => {
        if (prev.x === -1) return prev
        return {
          x: Math.max(0, Math.min(window.innerWidth - newW, prev.x)),
          y: Math.max(0, Math.min(window.innerHeight - newH, prev.y)),
        }
      })
    }
    function onUp() {
      resizing.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  function handleDragStart(e: React.MouseEvent) {
    // 버튼 클릭은 드래그 제외
    if ((e.target as HTMLElement).closest('button')) return
    e.preventDefault()
    dragging.current = true
    const curX = pos.x === -1 ? window.innerWidth - size.w - 24 : pos.x
    const curY = pos.y === -1 ? window.innerHeight - size.h - 24 : pos.y
    dragStart.current = { mx: e.clientX, my: e.clientY, px: curX, py: curY }

    function onMove(ev: MouseEvent) {
      if (!dragging.current) return
      const dx = ev.clientX - dragStart.current.mx
      const dy = ev.clientY - dragStart.current.my
      const newX = Math.max(0, Math.min(window.innerWidth - size.w, dragStart.current.px + dx))
      const newY = Math.max(0, Math.min(window.innerHeight - size.h, dragStart.current.py + dy))
      setPos({ x: newX, y: newY })
    }
    function onUp() {
      dragging.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const posStyle = pos.x === -1
    ? { bottom: 24, right: 24 }
    : { top: pos.y, left: pos.x }

  return (
    <div className="fixed flex flex-col z-50 overflow-hidden" style={{ ...posStyle, width: size.w, height: size.h, borderRadius: 32, border: '1px solid #F1F5F9', background: '#FFF', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
      {/* 리사이즈 핸들 (좌상단 모서리) */}
      <div
        onMouseDown={handleResizeStart}
        className="absolute top-0 left-0 w-4 h-4 cursor-nw-resize z-10"
        style={{ borderTopLeftRadius: 32 }}
      />
      {/* Header (드래그 가능) */}
      <div
        onMouseDown={handleDragStart}
        className="flex items-center justify-between px-4 py-3 flex-shrink-0 cursor-move select-none"
        style={{ background: '#111547' }}
      >
        <div className="flex flex-col">
          <span className="text-white font-medium text-sm" style={{ fontFamily: 'Pretendard' }}>{botName}</span>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#34D399' }} />
            <span style={{ color: 'rgba(255,255,255,0.7)', fontFamily: 'Manrope', fontSize: 10 }}>Online</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && loadConversation && (
            <button
              onClick={() => loadConversation('')}
              className="p-1 rounded-full hover:bg-white/10 transition-colors"
              title="새 대화"
            >
              <svg width="12" height="12" viewBox="0 0 20 20" fill="white"><path d="M10 0v8H2v2h8v8h2v-8h8V8h-8V0h-2z"/></svg>
            </button>
          )}
          <button
            onClick={onExpand ?? (() => window.location.href = '/chat')}
            className="p-1 rounded-full hover:bg-white/10 transition-colors"
            title="전체 화면"
          >
            <svg width="12" height="12" viewBox="0 0 20 20" fill="white"><path fillRule="evenodd" d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 01-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zm9 1a1 1 0 010-2h4a1 1 0 011 1v4a1 1 0 01-2 0V6.414l-2.293 2.293a1 1 0 11-1.414-1.414L13.586 5H12zm-9 7a1 1 0 012 0v1.586l2.293-2.293a1 1 0 011.414 1.414L6.414 15H8a1 1 0 010 2H4a1 1 0 01-1-1v-4zm13-1a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 010-2h1.586l-2.293-2.293a1 1 0 011.414-1.414L15 13.586V12a1 1 0 011-1z" /></svg>
          </button>
          <button
            onClick={handleClose}
            className="p-1 rounded-full hover:bg-white/10 transition-colors"
            title="닫기"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="white"><path d="M1.167 11.667L0 10.5 4.667 5.833 0 1.167 1.167 0l4.666 4.667L10.5 0l1.167 1.167L7 5.833l4.667 4.667L10.5 11.667 5.833 7 1.167 11.667z" /></svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4" style={{ background: '#F8FAFC' }}>
        {messages.length === 0 ? (
          <div className="flex flex-col h-full px-2 py-4">
            {/* 상단: 타이틀 + 환영 인사 + CTA */}
            <div className="flex-1 flex flex-col gap-5">
              <div>
                <h2 className="text-[15px] font-bold mb-2" style={{ color: '#111547' }}>
                  키움증권 신입사원 온보딩 챗봇, 챗키스 🐱
                </h2>
                <p className="text-[12px] leading-relaxed" style={{ color: '#475569' }}>
                  안녕하세요! 궁금한 점을 물어보시면{'\n'}빠르게 안내해 드리겠습니다.
                </p>
              </div>

              <button
                onClick={() => handleSend('챗키스 활용 방법', 'rag')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-semibold transition-colors"
                style={{ border: '1.5px solid #E1007F', color: '#E1007F', background: '#FFF' }}
              >
                📋 챗키스 활용 가이드
              </button>
            </div>

            {/* 하단: FAQ 빠른 질문 (입력란 바로 위) */}
            <div className="flex flex-col gap-2 items-end pt-3">
              {[
                '인사팀 담당자가 누구예요?',
                '연차 신청 어떻게 해요?',
                '우리 회사 복지 규정이 뭔가요?',
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => handleSend(q, 'rag')}
                  className="px-4 py-3 rounded-xl text-[12px] font-medium transition-colors hover:bg-gray-50"
                  style={{ border: '1px solid #E2E8F0', background: '#FFF', color: '#111547' }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div>
            {messages.map((msg) => (
              <Message
                key={msg.id}
                message={msg}
                onFeedback={handleFeedback as (id: string, r: FeedbackRating) => void}
                feedbackGiven={feedbackMap[msg.id]}
                saved={savedMessages?.has(msg.id)}
                onSave={handleSave}
                botName={botName}
                onAgentConfirm={(chat as any).handleAgentConfirm}
                onAgentCancel={(chat as any).handleAgentCancel}
                agentResolved={(chat as any).agentResolved?.has(msg.id)}
              />
            ))}
            {sending && (
              <div className="flex justify-start mb-3">
                <div className="w-6 h-6 rounded-full flex items-center justify-center mr-2 flex-shrink-0 mt-1" style={{ background: '#111547' }}>
                  <img src="/images/image 4.png" alt="" className="w-4 h-4" />
                </div>
                <div className="px-3 py-2 flex items-center gap-2" style={{ borderRadius: '0 16px 16px 16px', background: '#FFF', border: '1px solid #F1F5F9' }}>
                  <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:0ms]" style={{ background: '#94A3B8' }} />
                    <span className="w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:150ms]" style={{ background: '#94A3B8' }} />
                    <span className="w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:300ms]" style={{ background: '#94A3B8' }} />
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* FAQ Toggle + Input */}
      <div className="px-4 py-4 flex-shrink-0" style={{ borderTop: '1px solid #F1F5F9', background: '#FFF' }}>
        {/* FAQ 빠른 질문 토글 */}
        {showFaq && messages.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {[
              '인사팀 담당자가 누구예요?',
              '연차 신청 어떻게 해요?',
              '우리 회사 복지 규정이 뭔가요?',
            ].map((q) => (
              <button
                key={q}
                onClick={() => { handleSend(q, 'rag'); setShowFaq(false) }}
                className="px-3 py-1.5 rounded-full text-[10px] font-medium transition-colors hover:bg-gray-100"
                style={{ border: '1px solid #E2E8F0', background: '#FFF', color: '#111547' }}
              >
                {q}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2 px-3 py-2" style={{ borderRadius: 16, background: '#F1F5F9' }}>
          {/* FAQ 토글 버튼 */}
          <button
            onClick={() => setShowFaq(!showFaq)}
            className="flex-shrink-0 transition-colors"
            title="빠른 질문"
            style={{ color: showFaq ? '#E1007F' : '#94A3B8' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h16v2H4v-2z"/>
            </svg>
          </button>
          <input
            type="text"
            placeholder="궁금한 내용을 입력하세요..."
            className="flex-1 text-xs font-medium bg-transparent outline-none"
            style={{ color: '#111547', fontFamily: 'Pretendard' }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                const input = e.currentTarget
                const val = input.value.trim()
                if (val) { handleSend(val, 'rag'); input.value = '' }
              }
            }}
          />
          <button
            onClick={() => {
              const input = document.querySelector('.floating-chat-input') as HTMLInputElement
              if (input?.value.trim()) { handleSend(input.value.trim(), 'rag'); input.value = '' }
            }}
          >
            <svg width="16" height="14" viewBox="0 0 16 14" fill="none">
              <path d="M0 13.333V0L15.833 6.667 0 13.333zM1.667 10.833l9.875-4.166L1.667 2.5v2.917L6.667 6.667l-5 1.25v2.916z" fill="#E1007F"/>
            </svg>
          </button>
        </div>
        <p className="text-center mt-2" style={{ fontSize: 10, color: '#94A3B8' }}>
          AI는 한정된 데이터에 기반하니, 중요한 정보는 추가 확인을 권장해요.
        </p>
      </div>
    </div>
  )
}
