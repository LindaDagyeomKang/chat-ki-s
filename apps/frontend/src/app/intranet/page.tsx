'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getNotices, getLeaves, getExpenses, getInbox, getAssignments, getCalendarEvents, createCalendarEvent, deleteCalendarEvent, getDocuments } from '@/lib/api'
import type { Notice, LeaveRequest, Expense, Mail, Assignment, CalendarEvent, Document } from '@/lib/api'
import IntranetSidebar from '@/components/IntranetSidebar'
import SpeedActions from '@/components/SpeedActions'
import { useUser } from '@/hooks/useUser'

const STAT_CARDS = [
  { label: '전자우편', iconColor: '#3B82F6', iconBg: '#DBEAFE', href: '/intranet/mails', icon: <svg width="20" height="16" viewBox="0 0 20 16" fill="none"><path d="M18 0H2C0.9 0 0.01 0.9 0.01 2L0 14C0 15.1 0.9 16 2 16H18C19.1 16 20 15.1 20 14V2C20 0.9 19.1 0 18 0ZM18 4L10 9L2 4V2L10 7L18 2V4Z" fill="#3B82F6"/></svg> },
  { label: '결재함', iconColor: '#E1007F', iconBg: 'rgba(225,0,127,0.10)', href: '/intranet/documents', icon: <svg width="16" height="20" viewBox="0 0 16 20" fill="none"><path d="M10 0H2C0.9 0 0.01 0.9 0.01 2L0 18C0 19.1 0.89 20 1.99 20H14C15.1 20 16 19.1 16 18V6L10 0ZM2 18V2H9V7H14V18H2ZM4 14H12V16H4V14ZM4 10H12V12H4V10Z" fill="#E1007F"/></svg> },
  { label: '오늘의 일정', iconColor: '#F97316', iconBg: '#FFEDD5', href: '/intranet/hr', icon: <svg width="18" height="20" viewBox="0 0 18 20" fill="none"><path d="M14 2H17C17.55 2 18 2.45 18 3V19C18 19.55 17.55 20 17 20H1C0.45 20 0 19.55 0 19V3C0 2.45 0.45 2 1 2H4V0H6V2H12V0H14V2ZM2 8V18H16V8H2ZM4 10H8V14H4V10Z" fill="#F97316"/></svg> },
  { label: '프로젝트', iconColor: '#6366F1', iconBg: '#EEF2FF', href: '/intranet/onboarding', icon: <svg width="20" height="18" viewBox="0 0 20 18" fill="none"><path d="M10 0L0 6L10 12L18 7.74V14H20V6L10 0ZM10 16.18L2 11.36V8.27L10 13.09L18 8.27V11.36L10 16.18Z" fill="#6366F1"/></svg> },
]

const TAG_STYLES: Record<string, { color: string; bg: string }> = {
  pending: { color: '#EA580C', bg: '#FFEDD5' },
  approved: { color: '#047857', bg: '#ECFDF5' },
  rejected: { color: '#DC2626', bg: '#FEF2F2' },
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
  const [documents, setDocuments] = useState<Document[]>([])
  const [noticeIndex, setNoticeIndex] = useState(0)
  const [showAddEvent, setShowAddEvent] = useState(false)
  const [newEvent, setNewEvent] = useState({ title: '', eventDate: '', startTime: '', endTime: '', location: '' })

  useEffect(() => {
    getNotices().then((d) => setNotices(d.slice(0, 5))).catch(() => {})
    getLeaves().then(setLeaves).catch(() => {})
    getExpenses().then(setExpenses).catch(() => {})
    getInbox().then(setMails).catch(() => {})
    getAssignments().then(setAssignments).catch(() => {})
    getDocuments().then(setDocuments).catch(() => {})
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
  const todayMails = mails.filter((m) => new Date(m.receivedAt || m.createdAt).toDateString() === todayStr).length

  // 오늘의 일정 수 (주간 캘린더 이벤트 기준)
  const statValues = [
    todayMails,                                    // 전자우편: 당일 수신 메일
    documents.length,                                // 결재함: 문서 수
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
        { label: '품의/결재', href: '/intranet/expenses', iconSvg: <svg width="14" height="16" viewBox="0 0 16 20" fill="none"><path d="M10 0H2C.9 0 .01.9.01 2L0 18c0 1.1.89 2 1.99 2H14c1.1 0 2-.9 2-2V6l-6-6zM2 18V2h7v5h5v11H2zm2-4h8v2H4v-2zm0-4h8v2H4v-2z" fill="#6366F1"/></svg> },
        { label: '시설예약', href: '/intranet/rooms', iconSvg: <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M7 0h6v2H7V0zM9 12h2V7H9v5zm1-12C4.48 0 0 4.48 0 10s4.48 10 10 10 10-4.48 10-10S15.52 0 10 0zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z" fill="#10B981"/></svg> },
        { label: '주소록', href: '/intranet/addressbook', iconSvg: <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M15 8a3 3 0 100-6 3 3 0 000 6zm-8 0a3 3 0 100-6 3 3 0 000 6zm0 2c-2.33 0-7 1.17-7 3.5V16h14v-2.5C14 11.17 9.33 10 7 10zm8 0c-.29 0-.62.02-.97.05A4.22 4.22 0 0118 13.5V16h2v-2.5C20 11.17 17.33 10 15 10z" fill="#F97316"/></svg> },
        { label: '일정관리', href: '/intranet/calendar', iconSvg: <svg width="16" height="16" viewBox="0 0 18 20" fill="none"><path d="M14 2h3c.55 0 1 .45 1 1v16c0 .55-.45 1-1 1H1c-.55 0-1-.45-1-1V3c0-.55.45-1 1-1h3V0h2v2h6V0h2v2zM2 8v10h14V8H2zm2 2h4v4H4v-4z" fill="#3B82F6"/></svg> },
        { label: '더보기', href: '/intranet', iconSvg: <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><circle cx="4" cy="4" r="2" fill="#94A3B8"/><circle cx="10" cy="4" r="2" fill="#94A3B8"/><circle cx="16" cy="4" r="2" fill="#94A3B8"/><circle cx="4" cy="10" r="2" fill="#94A3B8"/><circle cx="10" cy="10" r="2" fill="#94A3B8"/><circle cx="16" cy="10" r="2" fill="#94A3B8"/></svg> },
      ]} />
    </IntranetSidebar>
    <main className="flex-1 overflow-y-auto p-8 flex flex-col gap-8">
      {/* 챗키스 소개 배너 */}
      <div className="flex items-center justify-between px-16" style={{ borderRadius: 32, background: '#111547', minHeight: 240 }}>
        <div className="flex flex-col gap-4">
          <span className="px-3 py-1 rounded-full text-xs font-medium self-start" style={{ background: 'rgba(225,0,127,0.80)', color: '#FFF' }}>Chat-Ki-S</span>
          <h2 className="text-white" style={{ fontSize: 28, fontWeight: 600, lineHeight: '36px' }}>Chat-Ki-S: Chatbot과 함께하는 Kiwoom Life Study</h2>
          <p style={{ color: 'rgba(255,255,255,0.60)', fontSize: 15, lineHeight: '24px' }}>임직원 여러분의 많은 관심과 적극적인 사용 부탁드립니다.</p>
          <div className="flex gap-3 mt-1">
            <Link href="/intranet/onboarding" className="text-white text-sm font-medium px-6 py-2.5 rounded-full hover:bg-white/10 transition-colors" style={{ border: '1px solid rgba(255,255,255,0.30)' }}>챗키스 알아보기</Link>
            <Link href="/chat" className="text-sm font-medium px-6 py-2.5 rounded-full" style={{ background: '#E1007F', color: '#FFF' }}>키링에게 물어보기</Link>
          </div>
        </div>
        <img src="/images/image 4.png" alt="Chat-Ki-S" className="w-40 h-40 opacity-80" />
      </div>

      {/* 공지사항 롤링 */}
      <div className="flex gap-4">
        <Link href="/intranet/notices" className="flex items-center justify-center text-white font-medium flex-shrink-0" style={{ width: 120, height: 52, borderRadius: 32, background: '#E1017F', fontSize: 14 }}>
          공지사항
        </Link>
        <div className="flex-1 flex items-center bg-white px-8 overflow-hidden" style={{ height: 52, borderRadius: 32, border: '1px solid #F8FAFC' }}>
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
                      {new Date(m.receivedAt || m.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* 결재함 */}
        <div className="bg-white" style={{ borderRadius: 32, padding: 24, border: '1px solid #F8FAFC', boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)' }}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-medium" style={{ fontSize: 16, color: '#111547' }}>결재함</h2>
            <Link href="/intranet/documents" className="text-xs font-medium" style={{ color: '#E1007F' }}>전체보기</Link>
          </div>
          <div className="space-y-2">
            {documents.length > 0 ? (
              documents.slice(0, 4).map((d) => (
                <Link key={d.id} href={`/intranet/documents?id=${d.id}`} className="flex items-center justify-between p-4 rounded-xl hover:bg-gray-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium mb-1 truncate" style={{ color: '#111547' }}>{d.title}</p>
                    <p style={{ fontSize: 10, color: '#46464F', fontFamily: 'Manrope' }}>{d.author} · {new Date(d.submittedAt).toLocaleDateString('ko-KR')}</p>
                  </div>
                  <span className="flex-shrink-0 ml-2 px-3 py-1 rounded-full font-black" style={{ fontSize: 9, fontFamily: 'Manrope', ...(TAG_STYLES[d.status] || { color: '#047857', bg: '#ECFDF5' }) }}>
                    {d.status === 'approved' ? '승인' : d.status === 'rejected' ? '반려' : d.status === 'submitted' ? '제출됨' : '임시저장'}
                  </span>
                </Link>
              ))
            ) : (
              <p className="text-center py-6" style={{ fontSize: 12, color: '#94A3B8' }}>결재 문서가 없습니다</p>
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
