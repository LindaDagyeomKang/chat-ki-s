'use client'

import { useEffect, useState, FormEvent } from 'react'
import { getLeaves, createLeave, deleteLeave } from '@/lib/api'
import IntranetSidebar from '@/components/IntranetSidebar'
import { useUser } from '@/hooks/useUser'
import type { LeaveRequest } from '@/lib/api'

const LEAVE_TYPES: Record<string, string> = {
  annual: '연차',
  half_am: '오전 반차',
  half_pm: '오후 반차',
  sick: '병가',
  special: '특별휴가',
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  }
  const labels: Record<string, string> = { pending: '대기중', approved: '승인', rejected: '반려' }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${styles[status] ?? 'bg-gray-100'}`}>
      {labels[status] ?? status}
    </span>
  )
}

export default function LeavesPage() {
  const { userName, userDept, userRole } = useUser()
  const [leaves, setLeaves] = useState<LeaveRequest[]>([])
  const [showForm, setShowForm] = useState(false)
  const [leaveType, setLeaveType] = useState('annual')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    getLeaves().then(setLeaves).catch(() => {})
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!startDate || !endDate) return
    setSubmitting(true)
    try {
      const result = await createLeave({ leaveType, startDate, endDate, reason })
      setLeaves((prev) => [result, ...prev])
      setShowForm(false)
      setStartDate('')
      setEndDate('')
      setReason('')
    } catch {
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-1 min-h-0">
    <IntranetSidebar userName={userName} userDept={userDept} userRole={userRole} />
    <main className="flex-1 overflow-y-auto">
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">연차 관리</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {showForm ? '취소' : '+ 연차 신청'}
        </button>
      </div>

      {/* 신청 폼 */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-5 mb-6 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">휴가 유형</label>
              <select
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Object.entries(LEAVE_TYPES).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">시작일</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); if (!endDate) setEndDate(e.target.value) }}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">종료일</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">사유</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="사유를 입력하세요 (선택)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {submitting ? '신청 중...' : '신청하기'}
          </button>
        </form>
      )}

      {/* 신청 내역 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">유형</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">기간</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">사유</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">상태</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">신청일</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500"></th>
            </tr>
          </thead>
          <tbody>
            {leaves.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-gray-400">연차 신청 내역이 없습니다</td></tr>
            ) : (
              leaves.map((l) => (
                <tr key={l.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-5 py-3 text-sm text-gray-800">{LEAVE_TYPES[l.leaveType] ?? l.leaveType}</td>
                  <td className="px-5 py-3 text-sm text-gray-600">
                    {l.startDate === l.endDate ? l.startDate : `${l.startDate} ~ ${l.endDate}`}
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-600 truncate max-w-[150px]">{l.reason || '-'}</td>
                  <td className="px-5 py-3"><StatusBadge status={l.status} /></td>
                  <td className="px-5 py-3 text-xs text-gray-400">{new Date(l.createdAt).toLocaleDateString('ko-KR')}</td>
                  <td className="px-5 py-3">
                    {l.status === 'pending' && (
                      <button
                        onClick={async () => {
                          try { await deleteLeave(l.id); setLeaves((prev) => prev.filter((x) => x.id !== l.id)) } catch (err) { console.error('삭제 실패', err) }
                        }}
                        className="text-xs text-red-400 hover:text-red-600 transition-colors"
                      >
                        삭제
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
    </main>
    </div>
  )
}
