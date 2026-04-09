'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getNotices, getLeaves, getExpenses, getInbox, getAssignments, getCalendarEvents, createCalendarEvent, deleteCalendarEvent } from '@/lib/api'
import type { Notice, LeaveRequest, Expense, Mail, Assignment, CalendarEvent } from '@/lib/api'
import IntranetSidebar from '@/components/IntranetSidebar'
import SpeedActions from '@/components/SpeedActions'
import { useUser } from '@/hooks/useUser'

const STAT_CARDS = [
  { label: '전자우편', iconColor: '#3B82F6', iconBg: '#DBEAFE', href: '/intranet/mails', icon: <svg width="20" height="16" viewBox="0 0 20 16" fill="none"><path d="M18 0H2C0.9 0 0.01 0.9 0.01 2L0 14C0 15.1 0.9 16 2 16H18C19.1 16 20 15.1 20 14V2C20 0.9 19.1 0 18 0ZM18 4L10 9L2 4V2L10 7L18 2V4Z" fill="#3B82F6"/></svg> },
  { label: '전자결재', iconColor: '#E1007F', iconBg: 'rgba(225,0,127,0.10)', href: '/intranet/expenses', icon: <svg width="16" height="20" viewBox="0 0 16 20" fill="none"><path d="M10 0H2C0.9 0 0.01 0.9 0.01 2L0 18C0 19.1 0.89 20 1.99 20H14C15.1 20 16 19.1 16 18V6L10 0ZM2 18V2H9V7H14V18H2ZM4 14H12V16H4V14ZM4 10H12V12H4V10Z" fill="#E1007F"/></svg> },
  { label: '오늘의 일정', iconColor: '#F97316', iconBg: '#FFEDD5', href: '/intranet/hr', icon: <svg width="18" height="20" viewBox="0 0 18 20" fill="none"><path d="M14 2H17C17.55 2 18 2.45 18 3V19C18 19.55 17.55 20 17 20H1C0.45 20 0 19.55 0 19V3C0 2.45 0.45 2 1 2H4V0H6V2H12V0H14V2ZM2 8V18H16V8H2ZM4 10H8V14H4V10Z" fill="#F97316"/></svg> },
  { label: '프로젝트', iconColor: '#6366F1', iconBg: '#EEF2FF', href: '/intranet/onboarding', icon: <svg width="20" height="18" viewBox="0 0 20 18" fill="none"><path d="M10 0L0 6L10 12L18 7.74V14H20V6L10 0ZM10 16.18L2 11.36V8.27L10 13.09L18 8.27V11.36L10 16.18Z" fill="#6366F1"/></svg> },
]

const TAG_STYLES: Record<string, { color: string; bg: string }> = {
  REVIEW: { color: '#EA580C', bg: '#FFEDD5' },
  URGENT: { color: '#2563EB', bg: '#DBEAFE' },
  NORMAL: { color: '#46464F', bg: '#F1F5F9' },
}

export default function IntranetDashboard() {
  const { userName, userDept, userRole } = useUser()
  const [notices, setNotices] = useState<Notice[]>([])
  const [leaves, setLeaves] = useState<LeaveRequest[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [mails, setMails] = useState<Mail[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [calEvents, setCalEvents] = useState<CalendarEvent[]>([])
  const [noticeIndex, setNoticeIndex] = useState(0)
  const [showAddEvent, setShowAddEvent] = useState(false)
  const [newEvent, setNewEvent] = useState({ title: '', eventDate: '', startTime: '', endTime: '', location: '' })

  useEffect(() => {
    getNotices().then((d) => setNotices(d.slice(0, 5))).catch(() => {})
    getLeaves().then(setLeaves).catch(() => {})
    getExpenses().then(setExpenses).catch(() => {})
    getInbox().then(setMails).catch(() => {})
    getAssignments().then(setAssignments).catch(() => {})
    // 이번 주 캘린더
    const now = new Date()
    const dow = now.getDay()
    const mon = new Date(now)
    mon.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1))
    const fri = new Date(mon)
    fri.setDate(mon.getDate() + 4)
    getCalendarEvents(mon.toISOString().split('T')[0], fri.toISOString().split('T')[0]).then(setCalEvents).catch(() => {})
  }, [])

  // 공지사항 자동 롤링
  useEffect(() => {
    if (notices.length === 0) return
    const timer = setInterval(() => {
      setNoticeIndex((prev) => (prev + 1) % notices.length)
    }, 3000)
    return () => clearInterval(timer)
  }, [notices.length])

  const pendingLeaves = leaves.filter((l) => l.status === 'pending').length
  const pendingExpenses = expenses.filter((e) => e.status === 'pending').length

  // 당일 수신 메일 수
  const todayStr = new Date().toDateString()
  const todayMails = mails.filter((m) => new Date(m.createdAt).toDateString() === todayStr).length

  // 오늘의 일정 수 (주간 캘린더 이벤트 기준)
  const statValues = [
    todayMails,                                    // 전자우편: 당일 수신 메일
    pendingLeaves + pendingExpenses,               // 전자결재: 미결재 건수
    0,                                              // 오늘의 일정: 아래서 계산
    assignments.filter(a => a.status !== 'completed').length,  // 프로젝트: 진행중 과제
  ]

  // 주간 일정 데이터
  const today = new Date()
  const dayOfWeek = today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))

  const weekDays = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return { date: d.getDate(), day: ['MON', 'TUE', 'WED', 'THU', 'FRI'][i] }
  })

  // calEvents를 날짜별로 그룹핑
  const eventsByDate: Record<number, CalendarEvent[]> = {}
  for (const ev of calEvents) {
    const d = new Date(ev.eventDate).getDate()
    if (!eventsByDate[d]) eventsByDate[d] = []
    eventsByDate[d].push(ev)
  }

  // 오늘의 일정 수 반영
  const todayDate = today.getDate()
  statValues[2] = (eventsByDate[todayDate] || []).length

  return (
    <div className="flex flex-1 min-h-0">
    <IntranetSidebar userName={userName} userDept={userDept} userRole={userRole}>
      <SpeedActions actions={[
        { label: '메일쓰기', href: '/intranet/mails', iconSvg: <svg width="16" height="13" viewBox="0 0 20 16" fill="none"><path d="M18 0H2C.9 0 .01.9.01 2L0 14c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V2c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V2l8 5 8-5v2z" fill="#E1007F"/></svg> },
        { label: '기안하기', href: '/intranet/expenses', iconSvg: <svg width="14" height="16" viewBox="0 0 16 20" fill="none"><path d="M10 0H2C.9 0 .01.9.01 2L0 18c0 1.1.89 2 1.99 2H14c1.1 0 2-.9 2-2V6l-6-6zM2 18V2h7v5h5v11H2zm2-4h8v2H4v-2zm0-4h8v2H4v-2z" fill="#6366F1"/></svg> },
        { label: '일정작성', href: '/intranet/leaves', iconSvg: <svg width="16" height="16" viewBox="0 0 18 20" fill="none"><path d="M14 2h3c.55 0 1 .45 1 1v16c0 .55-.45 1-1 1H1c-.55 0-1-.45-1-1V3c0-.55.45-1 1-1h3V0h2v2h6V0h2v2zM2 8v10h14V8H2zm2 2h4v4H4v-4z" fill="#F97316"/></svg> },
        { label: '글쓰기', href: '/intranet/notices', iconSvg: <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M2.5 17.5h1.07l10.17-10.17-1.07-1.07L2.5 16.43V17.5zM17.81 6.36l-4.17-4.17 1.42-1.42a1.51 1.51 0 012.12 0l2.05 2.05a1.51 1.51 0 010 2.12l-1.42 1.42zM0 20v-4.24L14.37 1.39l4.24 4.24L4.24 20H0z" fill="#3B82F6"/></svg> },
        { label: '자원예약', href: '/intranet', iconSvg: <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M7 0h6v2H7V0zM9 12h2V7H9v5zm1-12C4.48 0 0 4.48 0 10s4.48 10 10 10 10-4.48 10-10S15.52 0 10 0zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z" fill="#10B981"/></svg> },
        { label: '더보기', href: '/intranet', iconSvg: <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><circle cx="4" cy="4" r="2" fill="#94A3B8"/><circle cx="10" cy="4" r="2" fill="#94A3B8"/><circle cx="16" cy="4" r="2" fill="#94A3B8"/><circle cx="4" cy="10" r="2" fill="#94A3B8"/><circle cx="10" cy="10" r="2" fill="#94A3B8"/><circle cx="16" cy="10" r="2" fill="#94A3B8"/></svg> },
      ]} />
    </IntranetSidebar>
    <main className="flex-1 overflow-y-auto p-8 flex flex-col gap-8">
      {/* 상단 Stat Cards + 챗봇 카드 */}
      <div className="grid grid-cols-5 gap-5">
        {STAT_CARDS.map((card, i) => (
          <Link key={card.label} href={card.href} className="bg-white p-5 flex flex-col items-center hover:shadow-md transition-shadow" style={{ borderRadius: 32, border: '1px solid #F8FAFC', boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)' }}>
            <div className="p-3 rounded-xl mb-3" style={{ background: card.iconBg }}>
              {card.icon}
            </div>
            <p className="text-[10px] mb-2" style={{ color: '#46464F', fontWeight: 500 }}>{card.label}</p>
            <p className="text-xl font-black" style={{ color: '#111547', fontFamily: 'Manrope, sans-serif' }}>{statValues[i]}</p>
          </Link>
        ))}
        {/* 챗봇 카드 */}
        <Link href="/chat" className="p-5 flex flex-col items-center justify-center hover:shadow-md transition-shadow" style={{ borderRadius: 32, background: '#111547', boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)' }}>
          <img src="/images/image 4.png" alt="챗봇" className="w-10 h-10 mb-2" />
          <p className="text-[11px] font-medium text-white">챗봇 바로가기</p>
        </Link>
      </div>

      {/* 공지사항 배너 + 롤링 */}
      <div className="flex gap-4">
        <Link href="/intranet/notices" className="flex items-center justify-center text-white font-medium flex-shrink-0" style={{ width: 165, height: 83, borderRadius: 32, background: '#E1017F', fontSize: 16 }}>
          공지사항
        </Link>
        <div className="flex-1 flex items-center bg-white px-8 overflow-hidden" style={{ height: 83, borderRadius: 32, border: '1px solid #F8FAFC' }}>
          {notices.length > 0 ? (
            <div className="relative w-full h-full flex items-center">
              {notices.map((n, i) => (
                <p
                  key={n.id}
                  className="absolute w-full transition-all duration-500 text-sm truncate"
                  style={{
                    color: '#46464F',
                    opacity: i === noticeIndex ? 1 : 0,
                    transform: i === noticeIndex ? 'translateY(0)' : 'translateY(12px)',
                  }}
                >
                  <span className="text-xs font-medium mr-2 px-2 py-0.5 rounded-full" style={{ background: '#F1F5F9', color: '#64748B' }}>{n.category}</span>
                  {n.title}
                </p>
              ))}
            </div>
          ) : (
            <p style={{ color: '#94A3B8', fontSize: 14 }}>공지사항이 없습니다</p>
          )}
        </div>
      </div>

      {/* 받은 편지함 + 결재할 문서 */}
      <div className="grid grid-cols-2 gap-8">
        {/* 받은 편지함 */}
        <div className="bg-white" style={{ borderRadius: 32, padding: '24px 24px 31px 24px', border: '1px solid #F8FAFC', boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)' }}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-medium" style={{ fontSize: 16, color: '#111547' }}>받은 편지함</h2>
            <Link href="/intranet/mails" className="text-xs font-medium" style={{ color: '#E1007F' }}>모두보기</Link>
          </div>
          <div className="flex items-center gap-6">
            {(() => {
              const maxMails = 500
              const usagePercent = Math.min(Math.round((mails.length / maxMails) * 100), 100)
              const circumference = 2 * Math.PI * 40
              const offset = circumference * (1 - usagePercent / 100)
              return (
                <div className="relative flex-shrink-0" style={{ width: 96, height: 96 }}>
                  <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
                    <circle cx="48" cy="48" r="40" stroke="#F1F3F6" strokeWidth="8" fill="none" />
                    <circle cx="48" cy="48" r="40" stroke="#E1007F" strokeWidth="8" fill="none"
                      strokeDasharray={`${circumference}`}
                      strokeDashoffset={`${offset}`}
                      strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="font-black" style={{ fontSize: 18, color: '#111547', fontFamily: 'Manrope' }}>{usagePercent}%</span>
                    <span style={{ fontSize: 8, color: '#46464F' }}>{mails.length}/500</span>
                  </div>
                </div>
              )
            })()}
            <div className="flex-1 space-y-3">
              {mails.length === 0 ? (
                <p className="text-sm" style={{ color: '#94A3B8' }}>새 메일이 없습니다</p>
              ) : (
                mails.slice(0, 3).map((m) => (
                  <div key={m.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: !m.isRead ? '#E1007F' : '#3B82F6' }} />
                      <span className="text-xs font-medium" style={{ color: '#111547' }}>{m.subject}</span>
                    </div>
                    <span style={{ fontSize: 10, color: '#46464F', fontFamily: 'Manrope' }}>
                      {new Date(m.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* 결재할 문서 */}
        <div className="bg-white" style={{ borderRadius: 32, padding: 24, border: '1px solid #F8FAFC', boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)' }}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-medium" style={{ fontSize: 16, color: '#111547' }}>결재할 문서</h2>
            {(pendingLeaves + pendingExpenses) > 0 && (
              <span className="text-[10px] font-medium" style={{ color: '#E1007F' }}>진행중 {pendingLeaves + pendingExpenses}</span>
            )}
          </div>
          <div className="space-y-2">
            {leaves.filter(l => l.status === 'pending').slice(0, 2).map((l) => (
              <Link key={l.id} href="/intranet/leaves" className="flex items-center justify-between p-4 rounded-xl hover:bg-gray-50 transition-colors">
                <div>
                  <p className="text-xs font-medium mb-1" style={{ color: '#111547' }}>연차 신청 ({l.startDate})</p>
                  <p style={{ fontSize: 10, color: '#46464F', fontFamily: 'Manrope' }}>{l.reason || '개인 사유'}</p>
                </div>
                <span className="font-black px-3 py-1 rounded-full" style={{ fontSize: 9, ...TAG_STYLES.REVIEW, fontFamily: 'Manrope' }}>REVIEW</span>
              </Link>
            ))}
            {expenses.filter(e => e.status === 'pending').slice(0, 2).map((e) => (
              <Link key={e.id} href="/intranet/expenses" className="flex items-center justify-between p-4 rounded-xl hover:bg-gray-50 transition-colors">
                <div>
                  <p className="text-xs font-medium mb-1" style={{ color: '#111547' }}>{e.title}</p>
                  <p style={{ fontSize: 10, color: '#46464F', fontFamily: 'Manrope' }}>{e.amount.toLocaleString()}원 · {e.expenseDate}</p>
                </div>
                <span className="font-black px-3 py-1 rounded-full" style={{ fontSize: 9, ...TAG_STYLES.NORMAL, fontFamily: 'Manrope' }}>NORMAL</span>
              </Link>
            ))}
            {(pendingLeaves + pendingExpenses) === 0 && (
              <p className="text-center py-6" style={{ fontSize: 12, color: '#94A3B8' }}>결재할 문서가 없습니다</p>
            )}
          </div>
        </div>
      </div>

      {/* 자원관리 - 주간 캘린더 */}
      <div className="bg-white" style={{ borderRadius: 32, padding: 32, border: '1px solid #F8FAFC', boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)' }}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-medium" style={{ fontSize: 16, color: '#111547' }}>일정관리</h2>
          <div className="flex items-center gap-3">
            <Link href="/intranet/calendar" className="text-xs font-medium" style={{ color: '#E1007F' }}>전체보기</Link>
            <button onClick={() => setShowAddEvent(true)} className="text-xs font-medium px-3 py-1.5 rounded-full" style={{ color: '#E1007F', border: '1px solid #E1007F' }}>+ 일정 추가</button>
          </div>
        </div>
        <div className="grid grid-cols-5 gap-4">
          {weekDays.map((wd) => {
            const dayEvents = eventsByDate[wd.date] || []
            const isToday = wd.date === today.getDate()
            return (
              <div key={wd.day} className="p-4" style={{ minHeight: 160 }}>
                <div className="text-center mb-4">
                  <p className="font-black" style={{ fontSize: 20, color: isToday ? '#E1007F' : '#111547', fontFamily: 'Manrope' }}>{wd.date}</p>
                  <p className="font-bold uppercase" style={{ fontSize: 10, color: isToday ? '#E1007F' : '#94A3B8', fontFamily: 'Manrope' }}>{wd.day}</p>
                </div>
                <div className="space-y-2">
                  {dayEvents.length === 0 ? (
                    <p className="text-center italic" style={{ fontSize: 10, color: '#CBD5E1' }}>일정 없음</p>
                  ) : (
                    dayEvents.map((ev) => (
                      <div key={ev.id} className="p-2 group relative" style={{ borderRadius: '0 24px 24px 0', borderLeft: `2px solid ${ev.color}`, background: `${ev.color}10` }}>
                        <p className="font-medium" style={{ fontSize: 10, color: ev.color }}>{ev.title}</p>
                        <p style={{ fontSize: 8, color: '#94A3B8', fontFamily: 'Manrope' }}>{ev.startTime}{ev.endTime ? `~${ev.endTime}` : ''} · {ev.location}</p>
                        <button
                          onClick={async () => { await deleteCalendarEvent(ev.id); setCalEvents((prev) => prev.filter((e) => e.id !== ev.id)) }}
                          className="absolute top-1 right-1 hidden group-hover:block text-[8px] text-red-400 hover:text-red-600"
                        >✕</button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </main>

    {/* 일정 추가 모달 */}
    {showAddEvent && (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.3)' }}>
        <div className="bg-white p-6 space-y-4" style={{ borderRadius: 24, width: 360 }}>
          <h3 className="font-medium" style={{ fontSize: 16, color: '#111547' }}>일정 추가</h3>
          <input placeholder="일정 제목" value={newEvent.title} onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
            className="w-full px-3 py-2 text-sm rounded-xl outline-none" style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }} />
          <input type="date" value={newEvent.eventDate} onChange={(e) => setNewEvent({ ...newEvent, eventDate: e.target.value })}
            className="w-full px-3 py-2 text-sm rounded-xl outline-none" style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }} />
          <div className="flex gap-2">
            <input type="time" value={newEvent.startTime} onChange={(e) => setNewEvent({ ...newEvent, startTime: e.target.value })} placeholder="시작"
              className="flex-1 px-3 py-2 text-sm rounded-xl outline-none" style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }} />
            <input type="time" value={newEvent.endTime} onChange={(e) => setNewEvent({ ...newEvent, endTime: e.target.value })} placeholder="종료"
              className="flex-1 px-3 py-2 text-sm rounded-xl outline-none" style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }} />
          </div>
          <input placeholder="장소" value={newEvent.location} onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
            className="w-full px-3 py-2 text-sm rounded-xl outline-none" style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }} />
          <div className="flex gap-2">
            <button
              onClick={async () => {
                if (!newEvent.title || !newEvent.eventDate || !newEvent.startTime) return
                const created = await createCalendarEvent(newEvent)
                setCalEvents((prev) => [...prev, created])
                setNewEvent({ title: '', eventDate: '', startTime: '', endTime: '', location: '' })
                setShowAddEvent(false)
              }}
              className="flex-1 py-2 text-white text-sm font-medium rounded-xl" style={{ background: '#E1007F' }}
            >추가</button>
            <button onClick={() => setShowAddEvent(false)} className="flex-1 py-2 text-sm font-medium rounded-xl" style={{ background: '#F1F5F9', color: '#475569' }}>취소</button>
          </div>
        </div>
      </div>
    )}
    </div>
  )
}
