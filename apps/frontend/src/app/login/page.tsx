'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { login } from '@/lib/api'

export default function LoginPage() {
  const router = useRouter()
  const [employeeId, setEmployeeId] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login({ employeeId, password })
      router.push('/intranet')
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4" style={{ background: '#F1F3F6' }}>
      <div className="w-full max-w-sm">
        {/* 로고 + 타이틀 */}
        <div className="text-center mb-8">
          <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: '#111547', boxShadow: '0 8px 24px rgba(17,21,71,0.25)' }}>
            <img src="/images/image 4.png" alt="Chat-Ki-S" className="w-14 h-14" />
          </div>
          <img src="/kiwoom-logo.png" alt="키움증권" style={{ height: 28 }} className="mx-auto mb-2" />
          <p className="text-sm" style={{ color: '#94A3B8' }}>사내 인트라넷</p>
        </div>

        {/* 로그인 카드 */}
        <div className="p-8" style={{ background: '#FFF', borderRadius: 32, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="employeeId" className="block text-xs font-medium mb-1.5" style={{ color: '#64748B' }}>사번 또는 이메일</label>
              <input
                id="employeeId"
                type="text"
                required
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                placeholder="20260001 또는 name@kiwoom.com"
                className="w-full px-4 py-3 text-sm outline-none"
                style={{ background: '#F8FAFC', borderRadius: 16, border: '1px solid #F1F5F9', color: '#111547' }}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-medium mb-1.5" style={{ color: '#64748B' }}>비밀번호</label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호를 입력하세요"
                className="w-full px-4 py-3 text-sm outline-none"
                style={{ background: '#F8FAFC', borderRadius: 16, border: '1px solid #F1F5F9', color: '#111547' }}
              />
            </div>

            {error && (
              <p className="text-xs px-4 py-2.5" style={{ color: '#E1007F', background: 'rgba(225,0,127,0.05)', borderRadius: 12 }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 text-white font-medium text-sm transition-all"
              style={{
                background: loading ? '#94A3B8' : '#E1007F',
                borderRadius: 16,
                boxShadow: loading ? 'none' : '0px 4px 6px -4px rgba(225,0,127,0.20), 0px 10px 15px -3px rgba(225,0,127,0.20)',
              }}
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>
        </div>

        <p className="text-[11px] text-center mt-6" style={{ color: '#94A3B8' }}>
          계정 문의: IT헬프데스크 (내선 5555)
        </p>
      </div>
    </main>
  )
}
