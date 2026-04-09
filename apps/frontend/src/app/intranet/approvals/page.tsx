'use client'

import { useEffect, useState } from 'react'
import { getApprovals, approveLeave, approveExpense } from '@/lib/api'
import IntranetSidebar from '@/components/IntranetSidebar'
import { useUser } from '@/hooks/useUser'
import type { PendingLeave, PendingExpense } from '@/lib/api'

const LEAVE_LABELS: Record<string, string> = {
  annual: '연차', half_am: '오전 반차', half_pm: '오후 반차', sick: '병가', special: '특별휴가',
}

const EXPENSE_LABELS: Record<string, string> = {
  taxi: '업무 택시', meal: '업무 식대', supplies: '사무용품', travel: '출장 경비', etc: '기타',
}

export default function ApprovalsPage() {
  const { userName, userDept, userRole } = useUser()
  const [leaves, setLeaves] = useState<PendingLeave[]>([])
  const [expenses, setExpenses] = useState<PendingExpense[]>([])
  const [processing, setProcessing] = useState<Set<string>>(new Set())

  useEffect(() => {
    getApprovals()
      .then((d) => { setLeaves(d.leaves); setExpenses(d.expenses) })
      .catch(() => {})
  }, [])

  async function handleLeave(id: string, status: 'approved' | 'rejected') {
    setProcessing((prev) => new Set([...prev, id]))
    try {
      await approveLeave(id, status)
      setLeaves((prev) => prev.filter((l) => l.id !== id))
    } catch {} finally {
      setProcessing((prev) => { const next = new Set(prev); next.delete(id); return next })
    }
  }

  async function handleExpense(id: string, status: 'approved' | 'rejected') {
    setProcessing((prev) => new Set([...prev, id]))
    try {
      await approveExpense(id, status)
      setExpenses((prev) => prev.filter((e) => e.id !== id))
    } catch {} finally {
      setProcessing((prev) => { const next = new Set(prev); next.delete(id); return next })
    }
  }

  const total = leaves.length + expenses.length

  return (
    <div className="flex flex-1 min-h-0">
    <IntranetSidebar userName={userName} userDept={userDept} userRole={userRole} />
    <main className="flex-1 overflow-y-auto">
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">승인 대기</h1>
        <p className="text-sm text-gray-500 mt-1">총 {total}건의 승인 요청이 있습니다</p>
      </div>

      {total === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <span className="text-4xl mb-3 block">✅</span>
          <p className="text-gray-500">승인 대기 중인 요청이 없습니다</p>
        </div>
      )}

      {/* 연차 승인 */}
      {leaves.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">연차/휴가 신청 ({leaves.length}건)</h2>
          <div className="space-y-3">
            {leaves.map((l) => (
              <div key={l.id} className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-sm font-bold text-blue-700 flex-shrink-0">
                  {l.userName.slice(0, 1)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-900">{l.userName}</span>
                    <span className="text-xs text-gray-400">{l.employeeId} / {l.department}</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">{LEAVE_LABELS[l.leaveType] ?? l.leaveType}</span>
                    <span className="mx-2 text-gray-300">|</span>
                    <span>{l.startDate === l.endDate ? l.startDate : `${l.startDate} ~ ${l.endDate}`}</span>
                    {l.reason && <span className="mx-2 text-gray-300">|</span>}
                    {l.reason && <span className="text-gray-400">{l.reason}</span>}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(l.createdAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 신청
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleLeave(l.id, 'approved')}
                    disabled={processing.has(l.id)}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    승인
                  </button>
                  <button
                    onClick={() => handleLeave(l.id, 'rejected')}
                    disabled={processing.has(l.id)}
                    className="px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    반려
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 경비 승인 */}
      {expenses.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">경비 정산 ({expenses.length}건)</h2>
          <div className="space-y-3">
            {expenses.map((e) => (
              <div key={e.id} className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-sm font-bold text-green-700 flex-shrink-0">
                  {e.userName.slice(0, 1)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-900">{e.userName}</span>
                    <span className="text-xs text-gray-400">{e.employeeId} / {e.department}</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">{e.title}</span>
                    <span className="mx-2 text-gray-300">|</span>
                    <span className="font-semibold text-gray-900">{e.amount.toLocaleString()}원</span>
                    <span className="mx-2 text-gray-300">|</span>
                    <span>{EXPENSE_LABELS[e.category] ?? e.category}</span>
                    <span className="mx-2 text-gray-300">|</span>
                    <span>{e.expenseDate}</span>
                  </div>
                  {e.description && <p className="text-xs text-gray-400 mt-1">{e.description}</p>}
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(e.createdAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 신청
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleExpense(e.id, 'approved')}
                    disabled={processing.has(e.id)}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    승인
                  </button>
                  <button
                    onClick={() => handleExpense(e.id, 'rejected')}
                    disabled={processing.has(e.id)}
                    className="px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    반려
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
    </main>
    </div>
  )
}
