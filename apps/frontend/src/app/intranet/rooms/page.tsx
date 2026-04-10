'use client'

import { useEffect, useState } from 'react'
import { getMeetingRooms, getRoomReservations, bookRoom, cancelRoomReservation } from '@/lib/api'
import type { MeetingRoom, RoomReservation } from '@/lib/api'
import IntranetSidebar from '@/components/IntranetSidebar'
import { useUser } from '@/hooks/useUser'

const HOURS = Array.from({ length: 11 }, (_, i) => `${String(i + 8).padStart(2, '0')}:00`)

export default function RoomsPage() {
  const { userName, userDept, userRole } = useUser()
  const [rooms, setRooms] = useState<MeetingRoom[]>([])
  const [reservations, setReservations] = useState<RoomReservation[]>([])
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0])
  const [showBook, setShowBook] = useState(false)
  const [bookForm, setBookForm] = useState({ roomId: '', title: '', startTime: '', endTime: '', attendees: '' })
  const [error, setError] = useState('')

  useEffect(() => { getMeetingRooms().then(setRooms).catch(() => {}) }, [])
  useEffect(() => { getRoomReservations(selectedDate).then(setReservations).catch(() => {}) }, [selectedDate])

  async function handleBook() {
    if (!bookForm.roomId || !bookForm.title || !bookForm.startTime || !bookForm.endTime) { setError('모든 항목을 입력해 주세요'); return }
    try {
      await bookRoom({ ...bookForm, reserveDate: selectedDate })
      setShowBook(false); setBookForm({ roomId: '', title: '', startTime: '', endTime: '', attendees: '' }); setError('')
      getRoomReservations(selectedDate).then(setReservations)
    } catch (e: any) {
      setError(e.message || '예약에 실패했습니다')
    }
  }

  async function handleCancel(id: string) {
    await cancelRoomReservation(id)
    getRoomReservations(selectedDate).then(setReservations)
  }

  // 날짜 이동
  function moveDate(days: number) {
    const d = new Date(selectedDate); d.setDate(d.getDate() + days)
    setSelectedDate(d.toISOString().split('T')[0])
  }

  const dayNames = ['일', '월', '화', '수', '목', '금', '토']
  const dateObj = new Date(selectedDate)
  const isToday = selectedDate === new Date().toISOString().split('T')[0]

  return (
    <div className="flex flex-1 min-h-0">
      <IntranetSidebar userName={userName} userDept={userDept} userRole={userRole} />
      <main className="flex-1 overflow-y-auto p-8 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 style={{ color: '#111547', fontSize: 30, fontWeight: 500 }}>회의실 예약</h1>
            <p style={{ color: 'rgba(17,21,71,0.50)', fontSize: 14 }}>회의실 현황을 확인하고 예약하세요</p>
          </div>
          <button onClick={() => setShowBook(true)} className="px-5 py-2.5 text-white text-sm font-medium rounded-full" style={{ background: '#E1007F' }}>
            + 회의실 예약
          </button>
        </div>

        {/* 날짜 선택 */}
        <div className="flex items-center gap-4">
          <button onClick={() => moveDate(-1)} className="p-2 rounded-full hover:bg-gray-100">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#111547" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <div className="text-center">
            <p style={{ color: '#111547', fontSize: 18, fontWeight: 700, fontFamily: 'Manrope' }}>
              {dateObj.getMonth() + 1}월 {dateObj.getDate()}일 ({dayNames[dateObj.getDay()]}요일)
            </p>
            {isToday && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#E1007F', color: '#FFF' }}>오늘</span>}
          </div>
          <button onClick={() => moveDate(1)} className="p-2 rounded-full hover:bg-gray-100">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#111547" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
          </button>
          {!isToday && (
            <button onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])} className="text-xs px-3 py-1 rounded-full" style={{ border: '1px solid #E2E8F0', color: '#475569' }}>오늘</button>
          )}
        </div>

        {/* 타임라인 */}
        <div className="bg-white p-6 overflow-x-auto" style={{ borderRadius: 32, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
          <div className="min-w-[800px]">
            {/* 헤더: 시간대 */}
            <div className="flex border-b" style={{ borderColor: '#F1F5F9' }}>
              <div className="w-32 flex-shrink-0 py-2 px-3 text-xs font-bold" style={{ color: '#94A3B8' }}>회의실</div>
              {HOURS.map((h) => (
                <div key={h} className="flex-1 py-2 text-center text-[10px] font-bold" style={{ color: '#94A3B8', borderLeft: '1px solid #F8FAFC', fontFamily: 'Manrope' }}>{h}</div>
              ))}
            </div>

            {/* 각 회의실 행 */}
            {rooms.map((room) => {
              const roomRes = reservations.filter((r) => r.roomId === room.id)
              return (
                <div key={room.id} className="flex border-b" style={{ borderColor: '#F8FAFC', minHeight: 50 }}>
                  <div className="w-32 flex-shrink-0 py-3 px-3 flex flex-col justify-center">
                    <span className="text-xs font-bold" style={{ color: '#111547' }}>{room.name}</span>
                    <span className="text-[9px]" style={{ color: '#94A3B8' }}>{room.floor} / {room.capacity}명</span>
                  </div>
                  <div className="flex-1 relative" style={{ minHeight: 44 }}>
                    {roomRes.map((res) => {
                      const startHour = parseInt(res.startTime.split(':')[0]) - 8
                      const startMin = parseInt(res.startTime.split(':')[1] || '0')
                      const endHour = parseInt(res.endTime.split(':')[0]) - 8
                      const endMin = parseInt(res.endTime.split(':')[1] || '0')
                      const left = ((startHour * 60 + startMin) / (11 * 60)) * 100
                      const width = (((endHour - startHour) * 60 + (endMin - startMin)) / (11 * 60)) * 100
                      return (
                        <div
                          key={res.id}
                          className="absolute top-1 bottom-1 rounded-lg px-2 py-1 text-[9px] font-medium text-white truncate group cursor-pointer"
                          style={{ left: `${left}%`, width: `${width}%`, background: room.color, minWidth: 40 }}
                          title={`${res.startTime}~${res.endTime} ${res.title} (${res.userName})`}
                        >
                          {res.title}
                          <button onClick={() => handleCancel(res.id)} className="absolute top-0 right-1 hidden group-hover:block text-[8px] text-white/70 hover:text-white">✕</button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 예약 모달 */}
        {showBook && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.3)' }}>
            <div className="bg-white p-6 space-y-4" style={{ borderRadius: 24, width: 380 }}>
              <h3 className="font-medium" style={{ fontSize: 18, color: '#111547' }}>회의실 예약</h3>
              <p className="text-xs" style={{ color: '#94A3B8' }}>{dateObj.getMonth() + 1}월 {dateObj.getDate()}일 ({dayNames[dateObj.getDay()]})</p>
              <select value={bookForm.roomId} onChange={(e) => setBookForm({ ...bookForm, roomId: e.target.value })}
                className="w-full px-3 py-2.5 text-sm rounded-xl outline-none" style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }}>
                <option value="">회의실 선택</option>
                {rooms.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.floor}, {r.capacity}명)</option>)}
              </select>
              <input placeholder="회의 제목" value={bookForm.title} onChange={(e) => setBookForm({ ...bookForm, title: e.target.value })}
                className="w-full px-3 py-2.5 text-sm rounded-xl outline-none" style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }} />
              <div className="flex gap-2">
                <input type="time" value={bookForm.startTime} onChange={(e) => setBookForm({ ...bookForm, startTime: e.target.value })}
                  className="flex-1 px-3 py-2.5 text-sm rounded-xl outline-none" style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }} />
                <input type="time" value={bookForm.endTime} onChange={(e) => setBookForm({ ...bookForm, endTime: e.target.value })}
                  className="flex-1 px-3 py-2.5 text-sm rounded-xl outline-none" style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }} />
              </div>
              <input placeholder="참석자 (선택)" value={bookForm.attendees} onChange={(e) => setBookForm({ ...bookForm, attendees: e.target.value })}
                className="w-full px-3 py-2.5 text-sm rounded-xl outline-none" style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }} />
              {error && <p className="text-xs px-3 py-2 rounded-xl" style={{ color: '#E1007F', background: 'rgba(225,0,127,0.05)' }}>{error}</p>}
              <div className="flex gap-2">
                <button onClick={handleBook} className="flex-1 py-2.5 text-white text-sm font-medium rounded-xl" style={{ background: '#E1007F' }}>예약</button>
                <button onClick={() => { setShowBook(false); setError('') }} className="flex-1 py-2.5 text-sm font-medium rounded-xl" style={{ background: '#F1F5F9', color: '#475569' }}>취소</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
