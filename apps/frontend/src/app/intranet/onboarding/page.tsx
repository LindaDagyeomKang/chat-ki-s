'use client'

import { useEffect, useState, FormEvent } from 'react'
import { getAssignments, submitAssignment } from '@/lib/api'
import IntranetSidebar from '@/components/IntranetSidebar'
import { useUser } from '@/hooks/useUser'
import type { Assignment } from '@/lib/api'
import { usePageContext } from '@/contexts/PageContext'

const COLUMNS = [
  { key: 'pending', label: '시작 전', color: 'border-gray-300', bg: 'bg-gray-50', badge: 'bg-gray-200 text-gray-600' },
  { key: 'in_progress', label: '진행 중', color: 'border-blue-300', bg: 'bg-blue-50', badge: 'bg-blue-100 text-blue-700' },
  { key: 'submitted', label: '제출 완료', color: 'border-yellow-300', bg: 'bg-yellow-50', badge: 'bg-yellow-100 text-yellow-700' },
  { key: 'completed', label: '완료', color: 'border-green-300', bg: 'bg-green-50', badge: 'bg-green-100 text-green-700' },
]

// pending을 시작 전으로, 별도 in_progress 상태 추가를 위해 로컬에서 관리
const PROGRESS_KEY = 'chat-ki-s:assignment-progress'

function loadProgress(): Record<string, string> {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function saveProgress(data: Record<string, string>) {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(data))
}

export default function OnboardingPage() {
  const { userName, userDept, userRole } = useUser()
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [progress, setProgress] = useState<Record<string, string>>({})
  const [selected, setSelected] = useState<Assignment | null>(null)
  const [submissionText, setSubmissionText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { setPageContext, clearPageContext } = usePageContext()

  useEffect(() => {
    setProgress(loadProgress())
    getAssignments().then(setAssignments).catch(() => {})
  }, [])

  useEffect(() => {
    if (selected) {
      setPageContext({
        type: 'assignment',
        title: selected.title,
        content: selected.description || selected.title,
        metadata: `상태: ${selected.status}\n마감: ${selected.dueDate || '없음'}`,
      })
    } else {
      clearPageContext()
    }
  }, [selected])

  function getStatus(a: Assignment): string {
    if (a.status === 'completed') return 'completed'
    if (a.status === 'submitted') return 'submitted'
    return progress[a.id] || 'pending'
  }

  function startAssignment(id: string) {
    setProgress((prev) => {
      const next = { ...prev, [id]: 'in_progress' }
      saveProgress(next)
      return next
    })
  }

  function getColumnAssignments(columnKey: string) {
    return assignments.filter((a) => getStatus(a) === columnKey)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!selected || !submissionText.trim()) return
    setSubmitting(true)
    try {
      const updated = await submitAssignment(selected.id, submissionText.trim())
      setAssignments((prev) => prev.map((a) => a.id === updated.id ? updated : a))
      setSelected(null)
      setSubmissionText('')
    } catch {} finally {
      setSubmitting(false)
    }
  }

  const total = assignments.length
  const done = assignments.filter((a) => a.status === 'completed').length
  const progressPercent = total > 0 ? Math.round((done / total) * 100) : 0

  // 과제 상세/제출 모달
  if (selected) {
    const status = getStatus(selected)
    return (
    <div className="flex flex-1 min-h-0">
    <IntranetSidebar userName={userName} userDept={userDept} userRole={userRole} />
    <main className="flex-1 overflow-y-auto">
    <div className="p-6 max-w-3xl mx-auto">
        <button onClick={() => setSelected(null)} className="text-sm text-blue-600 hover:underline mb-4 flex items-center gap-1">
          <span>←</span> 온보딩 보드
        </button>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-3">
            {COLUMNS.map((c) => c.key === status ? (
              <span key={c.key} className={`text-xs px-2 py-0.5 rounded-full ${c.badge}`}>{c.label}</span>
            ) : null)}
            {selected.dueDate && <span className="text-xs text-gray-400">마감: {selected.dueDate}</span>}
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">{selected.title}</h1>
          {selected.description && <p className="text-sm text-gray-600 mb-4 whitespace-pre-wrap">{selected.description}</p>}

          {selected.submission && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-xs font-medium text-blue-700 mb-1">내 제출</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{selected.submission}</p>
            </div>
          )}

          {selected.feedback && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <p className="text-xs font-medium text-green-700 mb-1">사수 피드백</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{selected.feedback}</p>
            </div>
          )}

          {/* 시작 전 → 진행 시작 */}
          {status === 'pending' && (
            <button
              onClick={() => { startAssignment(selected.id); setSelected(null) }}
              className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              과제 시작하기
            </button>
          )}

          {/* 진행 중 → 제출 */}
          {status === 'in_progress' && (
            <form onSubmit={handleSubmit} className="mt-4 border-t border-gray-100 pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">과제 제출</label>
              <textarea
                value={submissionText}
                onChange={(e) => setSubmissionText(e.target.value)}
                placeholder="과제 답변을 작성해 주세요"
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <button
                type="submit"
                disabled={submitting || !submissionText.trim()}
                className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {submitting ? '제출 중...' : '제출하기'}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
    </div>
    )
  }

  return (
    <div className="flex flex-1 min-h-0">
    <IntranetSidebar userName={userName} userDept={userDept} userRole={userRole} />
    <main className="flex-1 overflow-y-auto">
    <div className="p-6 h-full flex flex-col">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">온보딩 프로세스</h1>
          <p className="text-sm text-gray-500 mt-1">모의 업무 과제를 진행하세요</p>
        </div>
        {total > 0 && (
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-bold text-blue-600">{done}/{total} 완료</p>
              <p className="text-xs text-gray-400">{progressPercent}%</p>
            </div>
            <div className="w-24 bg-gray-100 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
        )}
      </div>

      {total === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <span className="text-5xl mb-4 block">📋</span>
            <p className="text-gray-500 font-medium">아직 배정된 과제가 없습니다</p>
            <p className="text-xs text-gray-400 mt-1">사수가 챗봇으로 과제를 등록하면 여기에 표시됩니다</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-4 gap-4 min-h-0">
          {COLUMNS.map((col) => {
            const items = getColumnAssignments(col.key)
            return (
              <div key={col.key} className="flex flex-col min-h-0">
                {/* 열 헤더 */}
                <div className={`flex items-center gap-2 mb-3 px-1`}>
                  <h3 className="text-sm font-semibold text-gray-700">{col.label}</h3>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${col.badge}`}>{items.length}</span>
                </div>

                {/* 카드 목록 */}
                <div className={`flex-1 rounded-xl ${col.bg} border ${col.color} p-2 space-y-2 overflow-y-auto`}>
                  {items.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-8">없음</p>
                  )}
                  {items.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => setSelected(a)}
                      className="w-full text-left bg-white rounded-lg border border-gray-200 p-3 hover:shadow-md hover:border-blue-300 transition-all"
                    >
                      <p className="text-sm font-medium text-gray-900 mb-1">{a.title}</p>
                      {a.description && (
                        <p className="text-xs text-gray-500 line-clamp-2 mb-2">{a.description}</p>
                      )}
                      <div className="flex items-center justify-between">
                        {a.dueDate ? (
                          <span className="text-[11px] text-gray-400">~{a.dueDate}</span>
                        ) : (
                          <span />
                        )}
                        {a.feedback && <span className="text-[11px] text-green-600">💬 피드백</span>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
    </main>
    </div>
  )
}
