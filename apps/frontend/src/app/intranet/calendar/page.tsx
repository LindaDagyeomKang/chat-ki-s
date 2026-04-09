'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getCalendarEvents, createCalendarEvent, deleteCalendarEvent, updateCalendarEvent } from '@/lib/api'
import type { CalendarEvent } from '@/lib/api'
import IntranetSidebar from '@/components/IntranetSidebar'
import { useUser } from '@/hooks/useUser'
import { usePageContext } from '@/contexts/PageContext'

export default function CalendarPage() {
  const { userName, userDept, userRole } = useUser()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() } })
  const [selectedDate, setSelectedDate] = useState<number | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newEvent, setNewEvent] = useState({ title: '', startTime: '', endTime: '', location: '' })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ title: '', startTime: '', endTime: '', location: '' })
  const { setPageContext } = usePageContext()

  const { year, month } = calMonth
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const prevDays = new Date(year, month, 0).getDate()
  const today = new Date()

  useEffect(() => {
    const start = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const end = `${year}-${String(month + 1).padStart(2, '0')}-${daysInMonth}`
    getCalendarEvents(start, end).then(setEvents).catch(() => {})
  }, [year, month, daysInMonth])

  useEffect(() => {
    setPageContext({ type: 'calendar', title: '캘린더', content: `${year}년 ${month + 1}월 일정 ${events.length}건` })
  }, [events, year, month])

  // 날짜별 이벤트 그룹핑
  const eventsByDate: Record<number, CalendarEvent[]> = {}
  for (const ev of events) {
    const d = new Date(ev.eventDate).getDate()
    if (!eventsByDate[d]) eventsByDate[d] = []
    eventsByDate[d].push(ev)
  }

  const selectedEvents = selectedDate ? (eventsByDate[selectedDate] || []) : []

  async function handleAddEvent() {
    if (!newEvent.title || !newEvent.startTime || !selectedDate) return
    const eventDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(selectedDate).padStart(2, '0')}`
    const created = await createCalendarEvent({ ...newEvent, eventDate })
    setEvents((prev) => [...prev, created])
    setNewEvent({ title: '', startTime: '', endTime: '', location: '' })
    setShowAdd(false)
  }

  async function handleDeleteEvent(id: string) {
    await deleteCalendarEvent(id)
    setEvents((prev) => prev.filter((e) => e.id !== id))
  }

  function startEdit(ev: CalendarEvent) {
    setEditingId(ev.id)
    setEditForm({ title: ev.title, startTime: ev.startTime, endTime: ev.endTime || '', location: ev.location || '' })
  }

  async function handleEditSave() {
    if (!editingId || !editForm.title) return
    await updateCalendarEvent(editingId, editForm)
    setEvents((prev) => prev.map((e) => e.id === editingId ? { ...e, ...editForm } : e))
    setEditingId(null)
  }

  function prevMonth() {
    setCalMonth((m) => m.month === 0 ? { year: m.year - 1, month: 11 } : { ...m, month: m.month - 1 })
    setSelectedDate(null)
  }

  function nextMonth() {
    setCalMonth((m) => m.month === 11 ? { year: m.year + 1, month: 0 } : { ...m, month: m.month + 1 })
    setSelectedDate(null)
  }

  return (
    <div className="flex flex-1 min-h-0">
      <IntranetSidebar userName={userName} userDept={userDept} userRole={userRole} />

      <main className="flex-1 overflow-y-auto p-8 flex flex-col gap-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 style={{ color: '#111547', fontSize: 30, fontWeight: 500 }}>일정관리</h1>
            <p style={{ color: 'rgba(17,21,71,0.50)', fontSize: 14 }}>이번 달 일정 {events.length}건</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/intranet" className="text-sm px-4 py-2 rounded-full" style={{ border: '1px solid #E2E8F0', color: '#475569' }}>홈으로</Link>
          </div>
        </div>

        <div className="flex gap-6 flex-1 min-h-0">
          {/* 캘린더 그리드 */}
          <div className="flex-1 bg-white p-8 flex flex-col" style={{ borderRadius: 32, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            {/* 월 네비 */}
            <div className="flex items-center justify-between mb-6">
              <button onClick={prevMonth} className="p-2 rounded-full hover:bg-gray-100" style={{ color: '#111547' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
              </button>
              <h2 style={{ color: '#111547', fontSize: 22, fontWeight: 700, fontFamily: 'Manrope' }}>{year}년 {month + 1}월</h2>
              <button onClick={nextMonth} className="p-2 rounded-full hover:bg-gray-100" style={{ color: '#111547' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            </div>

            {/* 요일 헤더 */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
                <div key={d} className="text-center py-2 text-xs font-bold" style={{ color: i === 0 ? '#E1007F' : i === 6 ? '#3B82F6' : '#94A3B8' }}>{d}</div>
              ))}
            </div>

            {/* 날짜 그리드 */}
            <div className="grid grid-cols-7 gap-1 flex-1">
              {/* 이전 달 */}
              {Array.from({ length: firstDay }, (_, i) => (
                <div key={`p${i}`} className="p-2 text-center rounded-xl" style={{ color: '#E2E8F0' }}>
                  <span className="text-sm">{prevDays - firstDay + i + 1}</span>
                </div>
              ))}
              {/* 이번 달 */}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const d = i + 1
                const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear()
                const isSelected = d === selectedDate
                const dayEvents = eventsByDate[d] || []
                const isSunday = (firstDay + i) % 7 === 0
                const isSaturday = (firstDay + i) % 7 === 6

                return (
                  <button
                    key={d}
                    onClick={() => setSelectedDate(d)}
                    className="p-2 rounded-xl text-left transition-colors hover:bg-gray-50 flex flex-col"
                    style={{
                      background: isSelected ? 'rgba(225,0,127,0.05)' : 'transparent',
                      border: isSelected ? '2px solid #E1007F' : '2px solid transparent',
                      minHeight: 70,
                    }}
                  >
                    <span
                      className="text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full self-start"
                      style={isToday ? { background: '#111547', color: '#FFF' } : { color: isSunday ? '#E1007F' : isSaturday ? '#3B82F6' : '#111547' }}
                    >
                      {d}
                    </span>
                    {dayEvents.length > 0 && (
                      <div className="mt-1 space-y-0.5 w-full">
                        {dayEvents.slice(0, 2).map((ev) => (
                          <div key={ev.id} className="text-[9px] px-1.5 py-0.5 rounded truncate" style={{ background: `${ev.color}20`, color: ev.color }}>
                            {ev.startTime} {ev.title}
                          </div>
                        ))}
                        {dayEvents.length > 2 && (
                          <span className="text-[8px] px-1.5" style={{ color: '#94A3B8' }}>+{dayEvents.length - 2}건</span>
                        )}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 우측: 선택한 날짜의 일정 상세 */}
          <div className="w-80 flex-shrink-0 bg-white p-6 flex flex-col gap-4" style={{ borderRadius: 32, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            {selectedDate ? (
              <>
                <div className="flex items-center justify-between">
                  <h3 style={{ color: '#111547', fontSize: 18, fontWeight: 600 }}>
                    {month + 1}월 {selectedDate}일
                  </h3>
                  <button
                    onClick={() => setShowAdd(true)}
                    className="text-xs px-3 py-1.5 rounded-full font-medium"
                    style={{ color: '#E1007F', border: '1px solid #E1007F' }}
                  >
                    + 일정 추가
                  </button>
                </div>

                {selectedEvents.length === 0 ? (
                  <p className="text-center py-12" style={{ color: '#94A3B8', fontSize: 13 }}>등록된 일정이 없습니다</p>
                ) : (
                  <div className="space-y-3 flex-1 overflow-y-auto">
                    {selectedEvents.map((ev) => (
                      editingId === ev.id ? (
                        <div key={ev.id} className="p-4 rounded-2xl space-y-2" style={{ background: '#F8FAFC', borderLeft: `3px solid ${ev.color}` }}>
                          <input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                            className="w-full px-2 py-1.5 text-sm rounded-lg outline-none bg-white" style={{ border: '1px solid #E2E8F0' }} />
                          <div className="flex gap-2">
                            <input type="time" value={editForm.startTime} onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })}
                              className="flex-1 px-2 py-1.5 text-sm rounded-lg outline-none bg-white" style={{ border: '1px solid #E2E8F0' }} />
                            <input type="time" value={editForm.endTime} onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })}
                              className="flex-1 px-2 py-1.5 text-sm rounded-lg outline-none bg-white" style={{ border: '1px solid #E2E8F0' }} />
                          </div>
                          <input value={editForm.location} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} placeholder="장소"
                            className="w-full px-2 py-1.5 text-sm rounded-lg outline-none bg-white" style={{ border: '1px solid #E2E8F0' }} />
                          <div className="flex gap-2">
                            <button onClick={handleEditSave} className="flex-1 py-1.5 text-white text-xs rounded-lg" style={{ background: '#E1007F' }}>저장</button>
                            <button onClick={() => setEditingId(null)} className="flex-1 py-1.5 text-xs rounded-lg" style={{ background: '#F1F5F9', color: '#475569' }}>취소</button>
                          </div>
                        </div>
                      ) : (
                        <div key={ev.id} className="p-4 rounded-2xl group relative" style={{ background: '#F8FAFC', borderLeft: `3px solid ${ev.color}` }}>
                          <p className="font-medium text-sm" style={{ color: '#111547' }}>{ev.title}</p>
                          <p className="text-xs mt-1" style={{ color: '#64748B' }}>{ev.startTime}{ev.endTime ? ` ~ ${ev.endTime}` : ''}</p>
                          {ev.location && <p className="text-xs" style={{ color: '#94A3B8' }}>{ev.location}</p>}
                          <div className="absolute top-2 right-2 hidden group-hover:flex gap-1">
                            <button onClick={() => startEdit(ev)} className="text-xs text-blue-400 hover:text-blue-600">수정</button>
                            <button onClick={() => handleDeleteEvent(ev.id)} className="text-xs text-red-400 hover:text-red-600">삭제</button>
                          </div>
                        </div>
                      )
                    ))}
                  </div>
                )}

                {/* 일정 추가 폼 */}
                {showAdd && (
                  <div className="space-y-3 p-4 rounded-2xl" style={{ background: '#F8FAFC' }}>
                    <input placeholder="일정 제목" value={newEvent.title} onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-xl outline-none bg-white" style={{ border: '1px solid #F1F5F9' }} />
                    <div className="flex gap-2">
                      <input type="time" value={newEvent.startTime} onChange={(e) => setNewEvent({ ...newEvent, startTime: e.target.value })}
                        className="flex-1 px-3 py-2 text-sm rounded-xl outline-none bg-white" style={{ border: '1px solid #F1F5F9' }} />
                      <input type="time" value={newEvent.endTime} onChange={(e) => setNewEvent({ ...newEvent, endTime: e.target.value })}
                        className="flex-1 px-3 py-2 text-sm rounded-xl outline-none bg-white" style={{ border: '1px solid #F1F5F9' }} />
                    </div>
                    <input placeholder="장소" value={newEvent.location} onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-xl outline-none bg-white" style={{ border: '1px solid #F1F5F9' }} />
                    <div className="flex gap-2">
                      <button onClick={handleAddEvent} className="flex-1 py-2 text-white text-sm font-medium rounded-xl" style={{ background: '#E1007F' }}>추가</button>
                      <button onClick={() => setShowAdd(false)} className="flex-1 py-2 text-sm font-medium rounded-xl" style={{ background: '#F1F5F9', color: '#475569' }}>취소</button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center flex-1" style={{ color: '#94A3B8' }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-3"><path d="M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z"/></svg>
                <p className="text-sm">날짜를 선택하면</p>
                <p className="text-sm">일정을 확인할 수 있어요</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
