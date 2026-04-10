'use client'

import { useEffect, useState } from 'react'
import { getLeaves, getExpenses } from '@/lib/api'
import type { LeaveRequest, Expense } from '@/lib/api'
import { usePageContext } from '@/contexts/PageContext'
import IntranetSidebar from '@/components/IntranetSidebar'
import SpeedActions from '@/components/SpeedActions'
import LeaveRequestCard from '@/components/LeaveRequestCard'
import StatusBadge from '@/components/StatusBadge'
import { useUser } from '@/hooks/useUser'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

interface TeamEvent {
  type: 'birthday' | 'leave' | 'company'
  name: string
  date: string
  detail: string
  color: string
}

export default function HRPage() {
  const { userName, userDept, userRole } = useUser()
  const [leaves, setLeaves] = useState<LeaveRequest[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [teamEvents, setTeamEvents] = useState<TeamEvent[]>([])
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() } })
  const { setPageContext } = usePageContext()

  useEffect(() => {
    getLeaves().then(setLeaves).catch(() => {})
    getExpenses().then(setExpenses).catch(() => {})
    // 팀원 근태/일정 조회
    fetchTeamEvents()
  }, [])

  async function fetchTeamEvents() {
    try {
      const token = localStorage.getItem('accessToken')
      const res = await fetch(`${API_URL}/api/hr/team-events`, { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) setTeamEvents(await res.json())
    } catch {}
  }

  useEffect(() => {
    const leaveSummary = leaves.map((l) => `${l.startDate} ${l.leaveType} (${l.status})`).join(', ')
    const expenseSummary = expenses.map((e) => `${e.title} ${e.amount}원 (${e.status})`).join(', ')
    setPageContext({
      type: 'hr',
      title: '인사시스템',
      content: `연차 신청: ${leaves.length}건 (${leaveSummary || '없음'})\n경비 정산: ${expenses.length}건 (${expenseSummary || '없음'})`,
    })
  }, [leaves, expenses])

  const pendingCount = leaves.filter((l) => l.status === 'pending').length
  const approvedCount = leaves.filter((l) => l.status === 'approved').length

  // 캘린더
  const { year, month } = calMonth
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const prevDays = new Date(year, month, 0).getDate()
  const today = new Date()

  // 팀 이벤트를 날짜별로
  const eventDates: Record<number, { color: string; type: string }> = {}
  for (const ev of teamEvents) {
    const d = new Date(ev.date)
    if (d.getMonth() === month && d.getFullYear() === year) {
      eventDates[d.getDate()] = { color: ev.color, type: ev.type }
    }
  }

  return (
    <div className="flex flex-1 min-h-0">
    <IntranetSidebar userName={userName} userDept={userDept} userRole={userRole}>
      <SpeedActions actions={[
        { label: '메일쓰기', href: '/intranet/mails', iconSvg: <svg width="16" height="13" viewBox="0 0 20 16" fill="none"><path d="M18 0H2C.9 0 .01.9.01 2L0 14c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V2c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V2l8 5 8-5v2z" fill="#E1007F"/></svg> },
        { label: '기안하기', href: '/intranet/expenses', iconSvg: <svg width="14" height="16" viewBox="0 0 16 20" fill="none"><path d="M10 0H2C.9 0 .01.9.01 2L0 18c0 1.1.89 2 1.99 2H14c1.1 0 2-.9 2-2V6l-6-6zM2 18V2h7v5h5v11H2zm2-4h8v2H4v-2zm0-4h8v2H4v-2z" fill="#6366F1"/></svg> },
        { label: '자원예약', href: '/intranet/rooms', iconSvg: <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M7 0h6v2H7V0zM9 12h2V7H9v5zm1-12C4.48 0 0 4.48 0 10s4.48 10 10 10 10-4.48 10-10S15.52 0 10 0zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z" fill="#10B981"/></svg> },
        { label: '주소록', href: '/intranet/addressbook', iconSvg: <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M15 8a3 3 0 100-6 3 3 0 000 6zm-8 0a3 3 0 100-6 3 3 0 000 6zm0 2c-2.33 0-7 1.17-7 3.5V16h14v-2.5C14 11.17 9.33 10 7 10zm8 0c-.29 0-.62.02-.97.05A4.22 4.22 0 0118 13.5V16h2v-2.5C20 11.17 17.33 10 15 10z" fill="#F97316"/></svg> },
        { label: '일정관리', href: '/intranet/calendar', iconSvg: <svg width="16" height="16" viewBox="0 0 18 20" fill="none"><path d="M14 2h3c.55 0 1 .45 1 1v16c0 .55-.45 1-1 1H1c-.55 0-1-.45-1-1V3c0-.55.45-1 1-1h3V0h2v2h6V0h2v2zM2 8v10h14V8H2zm2 2h4v4H4v-4z" fill="#3B82F6"/></svg> },
        { label: '더보기', href: '/intranet', iconSvg: <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><circle cx="4" cy="4" r="2" fill="#94A3B8"/><circle cx="10" cy="4" r="2" fill="#94A3B8"/><circle cx="16" cy="4" r="2" fill="#94A3B8"/><circle cx="4" cy="10" r="2" fill="#94A3B8"/><circle cx="10" cy="10" r="2" fill="#94A3B8"/><circle cx="16" cy="10" r="2" fill="#94A3B8"/></svg> },
      ]} />
    </IntranetSidebar>

    <main className="flex-1 overflow-y-auto p-8 flex flex-col gap-8">
      <div>
        <h1 style={{ color: '#111547', fontSize: 30, fontWeight: 500 }}>인사시스템</h1>
        <p style={{ color: 'rgba(17,21,71,0.50)', fontSize: 14, fontWeight: 500 }}>{userName} 님의 인사 현황을 한눈에 확인하세요.</p>
      </div>

      <div className="flex gap-6">
        {/* 좌: 휴가/신청 관리 */}
        <div className="flex-1 bg-white p-8 flex flex-col gap-6" style={{ borderRadius: 32, boxShadow: '0px 32px 48px rgba(17,21,71,0.04)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 18 20" fill="none"><path d="M14 2h3c.55 0 1 .45 1 1v16c0 .55-.45 1-1 1H1c-.55 0-1-.45-1-1V3c0-.55.45-1 1-1h3V0h2v2h6V0h2v2zM2 8v10h14V8H2zm2 2h4v4H4v-4z" fill="#E1007F"/></svg>
              <h2 style={{ color: '#111547', fontSize: 20, fontWeight: 500 }}>휴가 / 신청 관리</h2>
            </div>
            <a href="/intranet/leaves" style={{ color: '#E1007F', fontSize: 12, fontWeight: 500 }}>전체보기</a>
          </div>

          <div className="flex gap-3">
            <div className="flex-1 p-6 flex flex-col items-center gap-1" style={{ background: '#F8FAFC', borderRadius: 32, borderTop: '4px solid #E1007F' }}>
              <span style={{ color: '#64748B', fontSize: 12, fontWeight: 500 }}>잔여 연차</span>
              <div className="flex items-end gap-1">
                <span style={{ color: '#111547', fontSize: 36, fontFamily: 'Manrope', fontWeight: 800 }}>{Math.max(0, 15 - approvedCount)}</span>
                <span style={{ color: '#111547', fontSize: 14, marginBottom: 6 }}>일</span>
              </div>
            </div>
            <div className="flex-1 p-6 flex flex-col items-center gap-1" style={{ background: '#F8FAFC', borderRadius: 32 }}>
              <span style={{ color: '#64748B', fontSize: 12, fontWeight: 500 }}>올해 사용</span>
              <div className="flex items-end gap-1">
                <span style={{ color: '#94A3B8', fontSize: 36, fontFamily: 'Manrope', fontWeight: 800 }}>{String(approvedCount).padStart(2, '0')}</span>
                <span style={{ color: '#94A3B8', fontSize: 14, marginBottom: 6 }}>일</span>
              </div>
            </div>
            <div className="flex-1 p-6 flex flex-col items-center gap-1" style={{ background: '#F8FAFC', borderRadius: 32 }}>
              <span style={{ color: '#64748B', fontSize: 12, fontWeight: 500 }}>승인 대기</span>
              <div className="flex items-end gap-1">
                <span style={{ color: '#94A3B8', fontSize: 36, fontFamily: 'Manrope', fontWeight: 800 }}>{String(pendingCount).padStart(2, '0')}</span>
                <span style={{ color: '#94A3B8', fontSize: 14, marginBottom: 6 }}>건</span>
              </div>
            </div>
          </div>

          <div>
            <h3 style={{ color: '#111547', fontSize: 14, fontWeight: 500, marginBottom: 16 }}>최근 신청 내역</h3>
            <div className="space-y-3">
              {leaves.length === 0 ? (
                <p style={{ color: '#94A3B8', fontSize: 14, textAlign: 'center', padding: 24 }}>신청 내역이 없습니다</p>
              ) : (
                leaves.slice(0, 3).map((l) => <LeaveRequestCard key={l.id} leave={l} />)
              )}
            </div>
          </div>
        </div>

        {/* 우: 팀원 일정 + 급여 */}
        <div className="flex flex-col gap-6" style={{ width: 340, flexShrink: 0 }}>
          <div className="bg-white p-8 flex flex-col gap-4" style={{ borderRadius: 32, boxShadow: '0px 32px 48px rgba(17,21,71,0.04)' }}>
            <div className="flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M15 8a3 3 0 100-6 3 3 0 000 6zm-8 0a3 3 0 100-6 3 3 0 000 6zm0 2c-2.33 0-7 1.17-7 3.5V16h14v-2.5C14 11.17 9.33 10 7 10zm8 0c-.29 0-.62.02-.97.05A4.22 4.22 0 0118 13.5V16h2v-2.5C20 11.17 17.33 10 15 10z" fill="#E1007F"/></svg>
              <h2 style={{ color: '#111547', fontSize: 16, fontWeight: 500 }}>팀원 근태 및 주요 일정</h2>
            </div>

            <div className="flex items-center justify-between">
              <span style={{ color: '#111547', fontSize: 12, fontWeight: 700 }}>{year}년 {month + 1}월</span>
              <div className="flex gap-2">
                <button onClick={() => setCalMonth(m => m.month === 0 ? { year: m.year - 1, month: 11 } : { ...m, month: m.month - 1 })} style={{ color: '#191C1D' }}>&lt;</button>
                <button onClick={() => setCalMonth(m => m.month === 11 ? { year: m.year + 1, month: 0 } : { ...m, month: m.month + 1 })} style={{ color: '#191C1D' }}>&gt;</button>
              </div>
            </div>

            {/* 미니 캘린더 */}
            <div className="grid grid-cols-7 gap-1 text-center" style={{ fontFamily: 'Manrope' }}>
              {['일','월','화','수','목','금','토'].map((d, i) => (
                <span key={`${d}${i}`} className="text-[10px] font-bold py-1" style={{ color: i === 0 || i === 6 ? '#CBD5E1' : '#94A3B8' }}>{d}</span>
              ))}
              {Array.from({ length: firstDay }, (_, i) => (
                <span key={`p${i}`} className="text-[10px] py-2" style={{ color: '#E2E8F0' }}>{prevDays - firstDay + i + 1}</span>
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const d = i + 1
                const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear()
                const ev = eventDates[d]
                const isSunday = (firstDay + i) % 7 === 0
                return (
                  <div key={d} className="flex justify-center py-1">
                    <span className="text-[11px] font-bold w-7 h-7 flex items-center justify-center rounded-full"
                      style={isToday ? { background: '#111547', color: '#FFF' } : ev ? { background: ev.color, color: '#FFF' } : { color: isSunday ? '#E1007F' : '#191C1D' }}>
                      {d}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* 범례 - 해당 월 이벤트만 */}
            <div className="space-y-2 mt-2">
              {teamEvents
                .filter((ev) => { const d = new Date(ev.date); return d.getMonth() === month && d.getFullYear() === year })
                .map((ev, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: ev.color }} />
                  <span style={{ color: '#64748B', fontSize: 11 }}>{ev.name} {ev.detail} ({new Date(ev.date).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })})</span>
                </div>
              ))}
              {teamEvents.filter((ev) => { const d = new Date(ev.date); return d.getMonth() === month && d.getFullYear() === year }).length === 0 &&
                <p style={{ color: '#94A3B8', fontSize: 11 }}>이 달의 팀 일정이 없습니다</p>}
            </div>
          </div>

          {/* 급여 관리 */}
          <div className="p-6 flex flex-col gap-3" style={{ borderRadius: 32, background: '#111547', color: '#FFF' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 style={{ fontSize: 20, fontWeight: 700 }}>급여 관리</h2>
                <span className="px-2.5 py-1 rounded-full" style={{ background: 'rgba(255,255,255,0.15)', fontSize: 11 }}>최근 지급 월: {year}년 {month + 1}월</span>
              </div>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="white"><path d="M10 0C4.48 0 0 4.48 0 10s4.48 10 10 10 10-4.48 10-10S15.52 0 10 0zm1 15H9v-2h2v2zm0-4H9V5h2v6z"/></svg>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.60)', fontSize: 13 }}>실수령액</p>
            <a href="/intranet/hr" className="flex items-center justify-center py-2.5 rounded-full" style={{ background: '#FFF', color: '#111547', fontSize: 13, fontWeight: 500 }}>
              급여 명세서 자세히 보기
            </a>
          </div>
        </div>
      </div>

      {/* 하단: 근태 현황 + 경비 정산 */}
      <div className="flex gap-6">
        <div className="flex-1 bg-white p-6 flex flex-col gap-4" style={{ borderRadius: 32, boxShadow: '0px 32px 48px rgba(17,21,71,0.04)' }}>
          <div className="flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M10 0C4.48 0 0 4.48 0 10s4.48 10 10 10 10-4.48 10-10S15.52 0 10 0zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H9v6l5.25 3.15.75-1.23-4.5-2.67V5z" fill="#6366F1"/></svg>
            <h2 style={{ color: '#111547', fontSize: 20, fontWeight: 500 }}>근태 현황</h2>
          </div>
          <div className="flex items-end justify-center gap-6 py-2">
            <div className="flex flex-col items-center gap-1.5">
              <div className="w-10 rounded-t-lg" style={{ height: 80, background: 'linear-gradient(180deg, #6366F1, #818CF8)' }} />
              <span style={{ color: '#64748B', fontSize: 10 }}>정상근무</span>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <div className="w-10 rounded-t-lg" style={{ height: 56, background: 'linear-gradient(180deg, #A78BFA, #C4B5FD)' }} />
              <span style={{ color: '#64748B', fontSize: 10 }}>연장근무</span>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <div className="w-10 rounded-t-lg" style={{ height: 32, background: 'linear-gradient(180deg, #F472B6, #FBCFE8)' }} />
              <span style={{ color: '#64748B', fontSize: 10 }}>지각/조퇴</span>
            </div>
          </div>
          <div className="flex justify-center gap-12 pt-3" style={{ borderTop: '1px solid #F1F5F9' }}>
            <div className="text-center">
              <span style={{ color: '#64748B', fontSize: 11 }}>이번 주 연장</span>
              <p style={{ color: '#111547', fontSize: 22, fontFamily: 'Manrope', fontWeight: 800, marginTop: 2 }}>4.5 <span style={{ fontSize: 13, fontWeight: 500 }}>시간</span></p>
            </div>
            <div className="text-center">
              <span style={{ color: '#64748B', fontSize: 11 }}>평균 퇴근</span>
              <p style={{ color: '#111547', fontSize: 22, fontFamily: 'Manrope', fontWeight: 800, marginTop: 2 }}>18:42</p>
            </div>
          </div>
        </div>

        <div className="flex-1 bg-white p-6 flex flex-col gap-4" style={{ borderRadius: 32, boxShadow: '0px 32px 48px rgba(17,21,71,0.04)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M11 8h3l-4-4-4 4h3v4H6l4 4 4-4h-3V8zM2 2h16v2H2V2zm0 14h16v2H2v-2z" fill="#F97316"/></svg>
              <h2 style={{ color: '#111547', fontSize: 20, fontWeight: 500 }}>경비 정산</h2>
            </div>
            <a href="/intranet/expenses" style={{ color: '#E1007F', fontSize: 12, fontWeight: 500 }}>전체보기</a>
          </div>
          <div className="flex gap-3">
            <div className="flex-1 p-4 flex flex-col items-center gap-1" style={{ background: '#F8FAFC', borderRadius: 32 }}>
              <span style={{ color: '#64748B', fontSize: 11, fontWeight: 500 }}>이번 달 정산</span>
              <span style={{ color: '#111547', fontSize: 20, fontFamily: 'Manrope', fontWeight: 800 }}>
                {expenses.reduce((sum, e) => sum + e.amount, 0).toLocaleString()}<span style={{ fontSize: 12, fontWeight: 500 }}>원</span>
              </span>
            </div>
            <div className="flex-1 p-4 flex flex-col items-center gap-1" style={{ background: '#F8FAFC', borderRadius: 32 }}>
              <span style={{ color: '#64748B', fontSize: 11, fontWeight: 500 }}>승인 대기</span>
              <span style={{ color: '#D97706', fontSize: 20, fontFamily: 'Manrope', fontWeight: 800 }}>
                {expenses.filter(e => e.status === 'pending').length}<span style={{ fontSize: 12, fontWeight: 500 }}>건</span>
              </span>
            </div>
          </div>
          <div className="space-y-2">
            {expenses.length === 0 ? (
              <p style={{ color: '#94A3B8', fontSize: 13, textAlign: 'center', padding: 16 }}>정산 내역이 없습니다</p>
            ) : (
              expenses.slice(0, 3).map((e) => (
                <div key={e.id} className="flex items-center justify-between p-3" style={{ background: '#F8FAFC', borderRadius: 24 }}>
                  <div>
                    <p style={{ color: '#111547', fontSize: 13, fontWeight: 500 }}>{e.title}</p>
                    <p style={{ color: '#94A3B8', fontSize: 11 }}>{e.expenseDate}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span style={{ color: '#111547', fontSize: 13, fontFamily: 'Manrope', fontWeight: 700 }}>{e.amount.toLocaleString()}원</span>
                    <StatusBadge status={e.status} label={e.status === 'approved' ? '승인 완료' : e.status === 'rejected' ? '반려' : '승인 대기'} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
    </div>
  )
}
