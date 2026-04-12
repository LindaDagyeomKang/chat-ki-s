'use client'

import type { Message as MessageType, FeedbackRating } from '@chat-ki-s/shared'

interface MessageProps {
  message: MessageType
  onFeedback?: (messageId: string, rating: FeedbackRating) => void
  feedbackGiven?: FeedbackRating
  saved?: boolean
  onSave?: (messageId: string) => void
  highlighted?: boolean
  botName?: string
  onAgentConfirm?: (messageId: string) => void
  onAgentCancel?: (messageId: string) => void
  agentResolved?: boolean
}

function formatTime(date: Date | string) {
  const d = new Date(date)
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: true })
}

const AI_URL = process.env.NEXT_PUBLIC_AI_URL ?? 'http://localhost:8001'

// 출처 텍스트에서 원본 문서명 추출 → 다운로드 링크 생성
const SOURCE_DOC_MAP: Record<string, string> = {
  '키움증권 임직원 복리후생 제도': '키움증권_임직원_복리후생_제도',
  '연차 유급휴가 사용 및 신청 가이드': '연차_유급휴가_사용_및_신청_가이드',
  '법인카드 사용 및 경비 정산 가이드라인': '법인카드_사용_및_경비_정산_가이드라인',
  '키움증권 업무용 택시 서비스 이용 매뉴얼': '키움증권_업무용_택시_서비스_이용_매뉴얼',
  '법인차량 사용 및 관리 지침서': '법인차량_사용_및_관리_지침서',
  '신입사원 업무용 PC 프로그램 설치 및 세팅 가이드': '신입사원_업무용_PC_프로그램_설치_및_세팅_가이드',
  '신입사원 IT 시스템 및 인프라 권한 신청 가이드': '신입사원_IT_시스템_및_인프라_권한_신청_가이드',
}

function renderContent(text: string) {
  // ** 마크다운 볼드 제거
  text = text.replace(/\*\*/g, '')

  // /intranet/... 경로를 클릭 가능한 링크로 변환
  // 📄 출처: 문서명 — 섹션 을 클릭 가능한 다운로드 링크로 변환
  const parts = text.split(/(\/intranet\/[a-z]+(?:\/[a-z]*)?|📄 출처: .+)/g)
  const linkLabels: Record<string, string> = {
    '/intranet/notices': '공지사항 바로가기',
    '/intranet/mails': '메일함 바로가기',
    '/intranet/leaves': '연차 관리 바로가기',
    '/intranet/expenses': '경비 정산 바로가기',
    '/intranet/approvals': '승인 대기 바로가기',
    '/intranet/addressbook': '주소록 바로가기',
    '/intranet/hr': '인사시스템 바로가기',
    '/intranet/onboarding': '온보딩 바로가기',
  }
  return parts.map((part, i) => {
    if (part.startsWith('/intranet/')) {
      return (
        <a key={i} href={part} className="inline-block mt-1 px-3 py-1.5 text-white text-xs rounded-lg transition-colors no-underline" style={{ background: '#E1007F' }}>
          {linkLabels[part] ?? part}
        </a>
      )
    }
    if (part.startsWith('📄 출처:')) {
      // "📄 출처: 문서명 — 섹션" 파싱
      const sourceText = part.replace('📄 출처: ', '').trim()
      const [docName] = sourceText.split(' — ')
      const sourceKey = Object.keys(SOURCE_DOC_MAP).find((k) => docName.includes(k))
      if (sourceKey) {
        const downloadUrl = `${AI_URL}/documents/source/${SOURCE_DOC_MAP[sourceKey]}`
        return (
          <span key={i} className="block mt-1 text-xs text-gray-500">
            📄 출처:{' '}
            <a href={downloadUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              {sourceText}
            </a>
          </span>
        )
      }
      return <span key={i} className="block mt-1 text-xs text-gray-500">{part}</span>
    }
    return <span key={i}>{part}</span>
  })
}

export default function Message({ message, onFeedback, feedbackGiven, saved, onSave, highlighted, botName = '키링', onAgentConfirm, onAgentCancel, agentResolved }: MessageProps) {
  const isUser = message.role === 'user'
  const hasSources = !isUser && message.sources && message.sources.length > 0
  const hasAgentAction = !isUser && message.agentAction && !agentResolved

  function handleSave() {
    if (onSave) onSave(message.id)
  }

  return (
    <div id={`msg-${message.id}`} className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3 rounded-lg transition-colors duration-300 ${highlighted ? 'bg-yellow-50' : ''}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full flex items-center justify-center mr-2 flex-shrink-0 mt-1" style={{ background: '#111547' }}>
          <img src="/images/image 4.png" alt={botName} className="w-5 h-5" />
        </div>
      )}
      <div className="max-w-[75%] flex flex-col gap-1">
        <div
          className="px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words"
          style={isUser
            ? { background: '#E1007F', color: '#FFF', borderRadius: '16px 16px 0 16px' }
            : { background: '#FFF', color: '#111547', borderRadius: '0 16px 16px 16px', border: '1px solid #F1F5F9', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }
          }
        >
          {renderContent(message.content)}
        </div>

        {/* Agent 확인/취소 버튼 */}
        {hasAgentAction && (
          <div className="flex gap-2 mt-1">
            <button
              onClick={() => onAgentConfirm?.(message.id)}
              className="px-4 py-1.5 text-white text-xs font-medium rounded-lg transition-colors"
              style={{ background: '#E1007F' }}
            >
              확인
            </button>
            <button
              onClick={() => onAgentCancel?.(message.id)}
              className="px-4 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-medium rounded-lg transition-colors"
            >
              취소
            </button>
          </div>
        )}

        {/* 전송 시간 */}
        <span className={`text-[11px] text-gray-400 ${isUser ? 'text-right' : 'text-left'}`}>
          {formatTime(message.createdAt)}
        </span>

        {hasSources && (
          <div className="bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-xs">
            {message.sources!.map((src, i) => (
              <div key={i} className="flex items-center gap-2 text-gray-600">
                <span className="text-gray-400">📄</span>
                <span>
                  <span className="text-gray-500 font-medium">출처: </span>
                  {src.url ? (
                    <a href={src.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">
                      {src.title}
                    </a>
                  ) : (
                    <span className="font-medium">{src.title}</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}

        {!isUser && (
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {onFeedback && (
              <>
                <span className="text-xs text-gray-400">도움이 됐나요?</span>
                <button
                  onClick={() => onFeedback(message.id, 'helpful')}
                  disabled={!!feedbackGiven}
                  className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                    feedbackGiven === 'helpful'
                      ? 'bg-green-100 border-green-400 text-green-700'
                      : feedbackGiven
                      ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                      : 'border-gray-300 text-gray-500 hover:bg-green-50 hover:border-green-400 hover:text-green-700'
                  }`}
                >
                  👍 도움됐어요
                </button>
                <button
                  onClick={() => onFeedback(message.id, 'unhelpful')}
                  disabled={!!feedbackGiven}
                  className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                    feedbackGiven === 'unhelpful'
                      ? 'bg-red-100 border-red-400 text-red-700'
                      : feedbackGiven
                      ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                      : 'border-gray-300 text-gray-500 hover:bg-red-50 hover:border-red-400 hover:text-red-700'
                  }`}
                >
                  👎 아쉬워요
                </button>
              </>
            )}

            {/* 저장 버튼 */}
            {onSave && (
              <button
                onClick={handleSave}
                className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                  saved
                    ? 'bg-yellow-100 border-yellow-400 text-yellow-700'
                    : 'border-gray-300 text-gray-500 hover:bg-yellow-50 hover:border-yellow-400 hover:text-yellow-700'
                }`}
                title={saved ? '저장됨' : '저장'}
              >
                {saved ? '★ 저장됨' : '☆ 저장'}
              </button>
            )}
          </div>
        )}
      </div>
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 text-xs font-bold ml-2 flex-shrink-0 mt-1">
          나
        </div>
      )}
    </div>
  )
}
