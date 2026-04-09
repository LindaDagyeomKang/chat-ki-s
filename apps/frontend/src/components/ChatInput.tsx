'use client'

import { useState, KeyboardEvent, FormEvent } from 'react'
import type { ChatMode } from '@chat-ki-s/shared'

interface ChatInputProps {
  onSend: (content: string, mode: ChatMode) => void
  disabled?: boolean
}

export default function ChatInput({ onSend, disabled = false }: ChatInputProps) {
  const [content, setContent] = useState('')
  const mode: ChatMode = 'rag'

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = content.trim()
    if (!trimmed || disabled) return
    onSend(trimmed, mode)
    setContent('')
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // 한글 IME 조합 중이면 무시 (조합 완료 후 Enter만 처리)
    if (e.nativeEvent.isComposing) return
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const trimmed = content.trim()
      if (!trimmed || disabled) return
      onSend(trimmed, mode)
      setContent('')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex gap-2 items-end">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="메시지를 입력하세요 (Shift+Enter로 줄바꿈)"
          rows={1}
          className="flex-1 resize-none px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400 max-h-32 overflow-y-auto"
          style={{ minHeight: '40px' }}
        />
        <button
          type="submit"
          disabled={disabled || !content.trim()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-lg text-sm font-medium transition-colors flex-shrink-0"
        >
          전송
        </button>
      </div>
    </form>
  )
}
