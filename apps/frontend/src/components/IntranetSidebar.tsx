'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import MiniCalendar from './MiniCalendar'
import { getMe } from '@/lib/api'

interface IntranetSidebarProps {
  userName: string
  userDept: string
  userRole: string
  children?: React.ReactNode
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

export default function IntranetSidebar({ userName, userDept, userRole, children }: IntranetSidebarProps) {
  const router = useRouter()
  const [status, setStatus] = useState('온라인')
  const [duty, setDuty] = useState('')
  const [editingStatus, setEditingStatus] = useState(false)
  const [editingDuty, setEditingDuty] = useState(false)
  const [statusDraft, setStatusDraft] = useState('')
  const [dutyDraft, setDutyDraft] = useState('')

  // 프로필 로드
  useEffect(() => {
    async function load() {
      try {
        const token = localStorage.getItem('accessToken')
        const res = await fetch(`${API_URL}/api/me/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          if (data.status) setStatus(data.status)
          if (data.duty) setDuty(data.duty)
        }
      } catch {}
    }
    load()
  }, [])

  async function saveField(field: 'status' | 'duty', value: string) {
    try {
      const token = localStorage.getItem('accessToken')
      await fetch(`${API_URL}/api/me/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ [field]: value }),
      })
    } catch {}
  }

  function handleStatusSave() {
    const val = statusDraft.trim() || '온라인'
    setStatus(val)
    setEditingStatus(false)
    saveField('status', val)
  }

  function handleDutySave() {
    const val = dutyDraft.trim()
    setDuty(val)
    setEditingDuty(false)
    saveField('duty', val)
  }

  const statusColor = status === '온라인' ? '#34D399' : status === '자리비움' ? '#FBBF24' : status === '회의중' ? '#F87171' : '#94A3B8'

  return (
    <aside className="w-72 bg-white flex flex-col flex-shrink-0 overflow-y-auto overflow-x-hidden" style={{ borderRight: '1px solid #F1F5F9' }}>
      {/* 프로필 */}
      <div className="p-6 flex flex-col items-center" style={{ borderBottom: '1px solid #F8FAFC', paddingBottom: 24 }}>
        <div className="w-20 h-20 rounded-full overflow-hidden mb-3" style={{ border: '2px solid #F1F5F9' }}>
          <div className="w-full h-full bg-gradient-to-br from-purple-300 to-cyan-300 flex items-center justify-center text-white text-2xl font-bold">
            {userName.slice(0, 1) || '?'}
          </div>
        </div>
        <p className="text-[11px] uppercase tracking-wider mb-2" style={{ color: '#46464F' }}>{userDept}</p>
        <div className="w-full py-2.5 rounded-full text-white font-medium text-sm text-center" style={{ background: '#E1007F', boxShadow: '0px 4px 6px -4px rgba(225,0,127,0.20), 0px 10px 15px -3px rgba(225,0,127,0.20)' }}>
          {userName} {userRole === 'mentor' ? '팀장' : '신입사원'}
        </div>

        {/* 상태 & 담당업무 */}
        <div className="w-full mt-4 px-3 py-3 rounded-2xl space-y-3" style={{ background: '#F8FAFC' }}>
          {/* 상태 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: statusColor }} />
              {editingStatus ? (
                <select
                  autoFocus
                  value={statusDraft}
                  onChange={(e) => setStatusDraft(e.target.value)}
                  onBlur={handleStatusSave}
                  className="text-xs bg-white border rounded px-2 py-1 outline-none"
                >
                  {['온라인', '자리비움', '회의중', '오프라인'].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              ) : (
                <span className="text-xs" style={{ color: '#46464F' }}>상태: {status}</span>
              )}
            </div>
            <button
              onClick={() => { setStatusDraft(status); setEditingStatus(true) }}
              className="text-[10px] hover:underline"
              style={{ color: '#94A3B8' }}
            >
              변경
            </button>
          </div>

          {/* 담당업무 */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs" style={{ color: '#94A3B8' }}>담당업무</span>
              <button
                onClick={() => { setDutyDraft(duty); setEditingDuty(true) }}
                className="text-[10px] hover:underline"
                style={{ color: '#94A3B8' }}
              >
                변경
              </button>
            </div>
            {editingDuty ? (
              <input
                autoFocus
                value={dutyDraft}
                onChange={(e) => setDutyDraft(e.target.value)}
                onBlur={handleDutySave}
                onKeyDown={(e) => e.key === 'Enter' && handleDutySave()}
                placeholder="담당 업무를 입력하세요"
                className="w-full text-xs bg-white border rounded-lg px-2 py-1.5 outline-none"
              />
            ) : (
              <p className="text-xs leading-relaxed" style={{ color: '#46464F', wordBreak: 'keep-all' }}>{duty || '미설정'}</p>
            )}
          </div>
        </div>
      </div>

      {/* 페이지별 커스텀 메뉴 */}
      {children && (
        <div className="flex-1" style={{ borderBottom: '1px solid #F8FAFC' }}>
          {children}
        </div>
      )}

      {/* 미니 캘린더 */}
      <MiniCalendar />

      {/* 하단 */}
      <div className="px-6 pb-6 mt-auto" style={{ borderTop: '1px solid #F8FAFC', paddingTop: 24 }}>
        <button className="flex items-center gap-3 py-2 text-xs" style={{ color: '#46464F' }}>
          <img src="/icons/Icon-9.svg" alt="" width={15} height={15} />
          환경설정
        </button>
        <button onClick={() => { localStorage.removeItem('accessToken'); router.replace('/login') }} className="flex items-center gap-3 py-2 text-xs" style={{ color: '#BA1A1A' }}>
          <img src="/icons/Icon-8.svg" alt="" width={14} height={14} />
          로그아웃
        </button>
      </div>
    </aside>
  )
}
