'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { FeedbackRating } from '@chat-ki-s/shared'
import Message from '@/components/Message'
import ChatInput from '@/components/ChatInput'
import { useChat } from '@/hooks/useChat'
import { getToken, getBotNickname, setBotNickname } from '@/lib/api'
import ConversationItem from '@/components/ConversationItem'

function formatTime(date: Date | string) {
  const d = new Date(date)
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }) + ' ' +
    d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: true })
}

export default function ChatPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const {
    messages, sending, handleSend, handleFeedback, feedbackMap,
    savedMessages, savedMessagesList, handleSave,
    conversations, loadConversation, conversationId,
    deleteConversation, handleAgentConfirm, handleAgentCancel, agentResolved,
  } = useChat()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [minimized, setMinimized] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sidebarTab, setSidebarTab] = useState<'conversations' | 'saved'>('conversations')
  const [highlightedId, setHighlightedId] = useState<string | undefined>()
  const [botName, setBotName] = useState('키링')
  const [editingName, setEditingName] = useState(false)
  const [editNameValue, setEditNameValue] = useState('')

  // FloatingChat에서 전체화면으로 돌아올 때 대화 복원
  const convIdParam = searchParams.get('convId')
  useEffect(() => {
    if (convIdParam) {
      loadConversation(convIdParam)
    }
  }, [convIdParam])

  useEffect(() => {
    setBotName(getBotNickname())
  }, [])

  function handleDelete(id: string) {
    deleteConversation(id)
  }

  async function handleSavedMessageClick(msgId: string, convId: string) {
    setSidebarTab('conversations')
    await loadConversation(convId)
    setHighlightedId(msgId)
    setTimeout(() => {
      document.getElementById(`msg-${msgId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
    setTimeout(() => setHighlightedId(undefined), 2000)
  }

  function handleNameEdit() {
    setEditNameValue(botName)
    setEditingName(true)
  }

  function handleNameSave() {
    const name = editNameValue.trim() || '키링'
    setBotNickname(name)
    setBotName(name)
    setEditingName(false)
  }

  const visibleConversations = conversations

  useEffect(() => {
    if (!getToken()) router.replace('/login')
  }, [router])

  useEffect(() => {
    if (!minimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, minimized])

  if (minimized) {
    const returnPath = searchParams.get('returnPath') || '/intranet'
    const params = conversationId ? `?chatOpen=1&convId=${conversationId}` : '?chatOpen=1'
    router.push(`${returnPath}${params}`)
    return null
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* 사이드바 */}
      <aside
        className={`flex-shrink-0 bg-white border-r border-gray-200 flex flex-col transition-all duration-200 ${
          sidebarOpen ? 'w-60' : 'w-0 overflow-hidden'
        }`}
      >
        {/* 탭 */}
        <div className="flex border-b border-gray-100 flex-shrink-0">
          <button
            onClick={() => setSidebarTab('conversations')}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
              sidebarTab === 'conversations'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            대화 목록
          </button>
          <button
            onClick={() => setSidebarTab('saved')}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors relative ${
              sidebarTab === 'saved'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            저장된 채팅
            {savedMessagesList.length > 0 && (
              <span className="ml-1 bg-blue-100 text-blue-600 text-[10px] px-1.5 py-0.5 rounded-full">
                {savedMessagesList.length}
              </span>
            )}
          </button>
        </div>

        {/* 대화 목록 탭 */}
        {sidebarTab === 'conversations' && (
          <>
            <div className="px-4 py-2 border-b border-gray-100 flex justify-end flex-shrink-0">
              <button
                onClick={() => loadConversation('')}
                className="text-xs text-blue-600 hover:underline"
              >
                + 새 대화
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
              {visibleConversations.length === 0 ? (
                <p className="text-xs text-gray-400 text-center mt-6 px-4">대화 기록이 없습니다</p>
              ) : (
                visibleConversations.map((conv) => (
                  <ConversationItem
                    key={conv.id}
                    conversation={conv}
                    isActive={conversationId === conv.id}
                    onSelect={() => loadConversation(conv.id)}
                    onDelete={handleDelete}
                  />
                ))
              )}
            </div>
          </>
        )}

        {/* 저장된 채팅 탭 */}
        {sidebarTab === 'saved' && (
          <div className="flex-1 overflow-y-auto py-2">
            {savedMessagesList.length === 0 ? (
              <p className="text-xs text-gray-400 text-center mt-6 px-4">저장된 채팅이 없습니다</p>
            ) : (
              savedMessagesList.map((msg) => (
                <div
                  key={msg.id}
                  onClick={() => handleSavedMessageClick(msg.id, msg.conversationId)}
                  className="px-4 py-3 border-b border-gray-50 hover:bg-yellow-50 cursor-pointer transition-colors"
                >
                  <p className="text-xs text-gray-800 leading-relaxed line-clamp-3">{msg.content}</p>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[11px] text-gray-400">{formatTime(msg.createdAt)}</span>
                    <button
                      onClick={() => handleSave(msg.id)}
                      className="text-[11px] text-yellow-500 hover:text-gray-400 transition-colors"
                      title="저장 취소"
                    >
                      ★
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </aside>

      {/* 메인 */}
      <div className="flex flex-col flex-1 min-w-0">
        <header className="px-4 py-3 flex items-center justify-between flex-shrink-0" style={{ background: '#111547' }}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="text-white/70 hover:text-white transition-colors p-1 rounded"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <img src="/images/image 4.png" alt="" className="w-8 h-8" />
              <div>
                {editingName ? (
                  <div className="flex items-center gap-1">
                    <input
                      autoFocus
                      value={editNameValue}
                      onChange={(e) => setEditNameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleNameSave()
                        if (e.key === 'Escape') setEditingName(false)
                      }}
                      onBlur={handleNameSave}
                      maxLength={20}
                      className="font-bold text-white border-b-2 border-white/50 outline-none bg-transparent w-24 text-sm"
                    />
                  </div>
                ) : (
                  <button
                    onClick={handleNameEdit}
                    className="group flex items-center gap-1"
                    title="이름 변경"
                  >
                    <h1 className="font-medium text-white text-sm">{botName}</h1>
                    <svg className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                )}
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#34D399' }} />
                  <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, fontFamily: 'Manrope' }}>Online</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href="/intranet" className="text-white/70 hover:text-white p-1.5 rounded-full transition-colors" title="인트라넷">
              <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2L2 9h3v8h4v-5h2v5h4V9h3L10 2z"/></svg>
            </a>
            <button onClick={() => setMinimized(true)} className="text-white/70 hover:text-white p-1.5 rounded-full transition-colors" title="최소화">
              <svg width="12" height="2" viewBox="0 0 12 2" fill="currentColor"><rect width="12" height="2" rx="1"/></svg>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4" style={{ background: '#F8FAFC' }}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center max-w-lg mx-auto gap-6">
              {/* 타이틀 + 환영 인사 */}
              <div>
                <img src="/images/image 4.png" alt="" className="w-20 h-20 mb-4 mx-auto" />
                <h2 className="text-xl font-bold mb-2" style={{ color: '#111547' }}>
                  키움증권 신입사원 온보딩 챗봇, 챗키스 🐱
                </h2>
                <p className="text-sm" style={{ color: '#94A3B8' }}>
                  안녕하세요! 궁금한 점을 물어보시면 빠르게 안내해 드리겠습니다.
                </p>
              </div>

              {/* CTA 버튼 */}
              <button
                onClick={() => handleSend('챗키스 활용 방법', 'rag')}
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-colors hover:bg-pink-50"
                style={{ border: '1.5px solid #E1007F', color: '#E1007F', background: '#FFF' }}
              >
                📋 챗키스 활용 가이드
              </button>

              {/* FAQ 빠른 질문 (오른쪽 정렬) */}
              <div className="flex flex-col gap-2 items-end w-full">
                {[
                  '인사팀 담당자가 누구예요?',
                  '연차 신청 어떻게 해요?',
                  '우리 회사 복지 규정이 뭔가요?',
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => handleSend(q, 'rag')}
                    className="px-5 py-3 rounded-xl text-sm font-medium transition-colors hover:bg-gray-50"
                    style={{ border: '1px solid #E2E8F0', background: '#FFF', color: '#111547' }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto">
              {messages.map((msg) => (
                <Message
                  key={msg.id}
                  message={msg}
                  onFeedback={handleFeedback as (id: string, r: FeedbackRating) => void}
                  feedbackGiven={feedbackMap[msg.id]}
                  saved={savedMessages.has(msg.id)}
                  onSave={handleSave}
                  highlighted={highlightedId === msg.id}
                  botName={botName}
                  onAgentConfirm={handleAgentConfirm}
                  onAgentCancel={handleAgentCancel}
                  agentResolved={agentResolved.has(msg.id)}
                />
              ))}
              {sending && (
                <div className="flex justify-start mb-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center mr-2 flex-shrink-0 mt-1" style={{ background: '#111547' }}>
                    <img src="/images/image 4.png" alt="" className="w-5 h-5" />
                  </div>
                  <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderRadius: '0 16px 16px 16px', background: '#FFF', border: '1px solid #F1F5F9' }}>
                    <span className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:0ms]" style={{ background: '#94A3B8' }} />
                      <span className="w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:150ms]" style={{ background: '#94A3B8' }} />
                      <span className="w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:300ms]" style={{ background: '#94A3B8' }} />
                    </span>
                    <span style={{ color: '#94A3B8', fontSize: 11 }}>답변 생성 중...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div className="bg-white px-4 py-3 flex-shrink-0" style={{ borderTop: '1px solid #F1F5F9' }}>
          <div className="max-w-3xl mx-auto">
            {/* 추천 질문 버튼 */}
            {!sending && messages.length > 0 && (() => {
              const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')
              const sq = lastAssistant?.suggestedQuestions
              if (!sq?.length) return null
              // 이미 질문한 내용 제외
              const asked = new Set(messages.filter((m) => m.role === 'user').map((m) => m.content))
              const filtered = sq.filter((q) => !asked.has(q)).slice(0, 3)
              return (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {filtered.map((q) => (
                    <button
                      key={q}
                      onClick={() => handleSend(q, 'rag')}
                      className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )
            })()}
            <ChatInput onSend={handleSend} disabled={sending} />
            <p className="text-center mt-2" style={{ fontSize: 11, color: '#94A3B8' }}>
              AI는 한정된 데이터에 기반하니, 중요한 정보는 추가 확인을 권장해요.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
