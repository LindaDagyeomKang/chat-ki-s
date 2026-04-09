'use client'

import { useEffect, useState, FormEvent } from 'react'
import { getExpenses, createExpense, deleteExpense } from '@/lib/api'
import IntranetSidebar from '@/components/IntranetSidebar'
import { useUser } from '@/hooks/useUser'
import type { Expense } from '@/lib/api'

const EXPENSE_CATEGORIES: Record<string, string> = {
  taxi: '업무 택시',
  meal: '업무 식대',
  supplies: '사무용품',
  travel: '출장 경비',
  etc: '기타',
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

export default function ExpensesPage() {
  const { userName, userDept, userRole } = useUser()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('taxi')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [expenseDate, setExpenseDate] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    getExpenses().then(setExpenses).catch(() => {})
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!title || !amount || !expenseDate) return
    setSubmitting(true)
    try {
      const result = await createExpense({
        title,
        category,
        amount: Number(amount),
        description,
        expenseDate,
      })
      setExpenses((prev) => [result, ...prev])
      setShowForm(false)
      setTitle('')
      setAmount('')
      setDescription('')
      setExpenseDate('')
    } catch {
    } finally {
      setSubmitting(false)
    }
  }

  const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0)
  const pendingAmount = expenses.filter((e) => e.status === 'pending').reduce((sum, e) => sum + e.amount, 0)

  return (
    <div className="flex flex-1 min-h-0">
    <IntranetSidebar userName={userName} userDept={userDept} userRole={userRole} />
    <main className="flex-1 overflow-y-auto">
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">경비 정산</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {showForm ? '취소' : '+ 경비 신청'}
        </button>
      </div>

      {/* 요약 */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">총 신청 금액</p>
          <p className="text-xl font-bold text-gray-900">{totalAmount.toLocaleString()}원</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">승인 대기 금액</p>
          <p className="text-xl font-bold text-yellow-600">{pendingAmount.toLocaleString()}원</p>
        </div>
      </div>

      {/* 신청 폼 */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-5 mb-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">항목명</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: 야근 택시비"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">카테고리</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Object.entries(EXPENSE_CATEGORIES).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">금액 (원)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="32000"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">사용일</label>
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">상세 내용</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="사용 목적을 입력하세요 (선택)"
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

      {/* 정산 내역 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">항목</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">카테고리</th>
              <th className="px-5 py-3 text-right text-xs font-medium text-gray-500">금액</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">사용일</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">상태</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500"></th>
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-gray-400">경비 정산 내역이 없습니다</td></tr>
            ) : (
              expenses.map((e) => (
                <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-5 py-3 text-sm text-gray-800">{e.title}</td>
                  <td className="px-5 py-3 text-sm text-gray-600">{EXPENSE_CATEGORIES[e.category] ?? e.category}</td>
                  <td className="px-5 py-3 text-sm text-gray-800 text-right font-medium">{e.amount.toLocaleString()}원</td>
                  <td className="px-5 py-3 text-sm text-gray-600">{e.expenseDate}</td>
                  <td className="px-5 py-3"><StatusBadge status={e.status} /></td>
                  <td className="px-5 py-3">
                    {e.status === 'pending' && (
                      <button
                        onClick={async () => {
                          try { await deleteExpense(e.id); setExpenses((prev) => prev.filter((x) => x.id !== e.id)) } catch (err) { console.error('삭제 실패', err) }
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
