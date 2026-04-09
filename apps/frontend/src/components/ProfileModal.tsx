'use client'

import type { Employee } from '@/lib/api'

const GRADIENT_COLORS = [
  ['#6366F1', '#818CF8'],
  ['#EC4899', '#F472B6'],
  ['#10B981', '#34D399'],
  ['#F59E0B', '#FBBF24'],
  ['#8B5CF6', '#C084FC'],
  ['#6366F1', '#A78BFA'],
]

function getGradient(name: string) {
  const c = GRADIENT_COLORS[name.charCodeAt(0) % GRADIENT_COLORS.length]
  return `linear-gradient(135deg, ${c[0]}, ${c[1]})`
}

interface ProfileModalProps {
  employee: Employee
  onClose: () => void
}

export default function ProfileModal({ employee, onClose }: ProfileModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div className="flex flex-col" onClick={(e) => e.stopPropagation()} style={{ width: 400, maxHeight: '90vh', background: '#FFF', borderRadius: 32, boxShadow: '0px 32px 64px rgba(17,21,71,0.12)', border: '1px solid rgba(199,197,208,0.10)', overflow: 'hidden' }}>
        <div className="p-8 flex flex-col gap-6 overflow-y-auto">
          <div className="flex items-center justify-between">
            <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="#191C1D"><path d="M1.4 14L0 12.6 5.6 7 0 1.4 1.4 0 7 5.6 12.6 0 14 1.4 8.4 7 14 12.6 12.6 14 7 8.4 1.4 14z"/></svg>
            </button>
            <button className="p-2 rounded-full hover:bg-gray-100">
              <svg width="4" height="16" viewBox="0 0 4 16" fill="#191C1D"><circle cx="2" cy="2" r="2"/><circle cx="2" cy="8" r="2"/><circle cx="2" cy="14" r="2"/></svg>
            </button>
          </div>

          <div className="flex flex-col items-center">
            <div className="w-32 h-32 rounded-full mb-6 flex items-center justify-center text-white text-4xl font-bold" style={{ background: getGradient(employee.name), boxShadow: '0 0 0 4px rgba(180,0,100,0.05)' }}>
              {employee.name.slice(0, 1)}
            </div>
            <h2 style={{ color: '#111547', fontSize: 24, fontWeight: 500, marginBottom: 4 }}>{employee.name}</h2>
            <p style={{ color: '#B40064', fontSize: 16, fontWeight: 500, marginBottom: 8 }}>
              {employee.rank ?? ''}{employee.position && employee.position !== '-' ? ` (${employee.position})` : ''}
            </p>
            {/* 상태 표시 */}
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: employee.status === '온라인' ? '#34D399' : employee.status === '자리비움' ? '#FBBF24' : employee.status === '회의중' ? '#F87171' : '#94A3B8' }} />
              <span style={{ color: '#64748B', fontSize: 13 }}>{employee.status || '오프라인'}</span>
            </div>
            <div className="flex gap-2">
              <a href="/intranet/mails" className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: '#E1017F' }}>
                <svg width="20" height="16" viewBox="0 0 20 16" fill="white"><path d="M18 0H2C.9 0 0 .9 0 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V2c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V2l8 5 8-5v2z"/></svg>
              </a>
              <button className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: '#111547' }}>
                <svg width="16" height="16" viewBox="0 0 20 16" fill="white"><path d="M15 0H5a2 2 0 00-2 2v12l7-3 7 3V2a2 2 0 00-2-2z"/></svg>
              </button>
              <button className="w-12 h-12 rounded-full flex items-center justify-center bg-white" style={{ border: '1px solid #C7C5D0' }}>
                <svg width="18" height="20" viewBox="0 0 18 20" fill="#111547"><path d="M14 2h3a1 1 0 011 1v16a1 1 0 01-1 1H1a1 1 0 01-1-1V3a1 1 0 011-1h3V0h2v2h6V0h2v2zM2 8v10h14V8H2zm2 2h4v4H4v-4z"/></svg>
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <p style={{ color: '#46464F', fontSize: 12, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '1.2px' }}>소개</p>
            <p style={{ color: '#191C1D', fontSize: 14, fontWeight: 500, lineHeight: '23px' }}>
              안녕하세요. {employee.team ?? employee.division ?? ''} 팀 {employee.name}입니다.
            </p>
          </div>

          {employee.duty && (
            <div className="flex flex-col gap-2">
              <p style={{ color: '#46464F', fontSize: 12, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '1.2px' }}>담당업무</p>
              <p style={{ color: '#191C1D', fontSize: 13, fontWeight: 500, lineHeight: '20px' }}>{employee.duty}</p>
            </div>
          )}

          <div className="flex gap-3">
            {employee.phone && (
              <div className="flex-1 p-4 flex flex-col gap-1" style={{ background: '#F3F4F5', borderRadius: 32 }}>
                <span style={{ color: '#46464F', fontSize: 10, fontWeight: 500, textTransform: 'uppercase' }}>내선번호</span>
                <span style={{ color: '#111547', fontSize: 14, fontWeight: 500 }}>{employee.phone}</span>
              </div>
            )}
            <div className="flex-1 p-4 flex flex-col gap-1" style={{ background: '#F3F4F5', borderRadius: 32 }}>
              <span style={{ color: '#46464F', fontSize: 10, fontWeight: 500, textTransform: 'uppercase' }}>사무실</span>
              <span style={{ color: '#111547', fontSize: 14, fontFamily: 'Manrope', fontWeight: 700 }}>서울, 본사</span>
            </div>
          </div>
        </div>

        <div className="mt-auto p-6 flex items-center gap-4" style={{ background: '#F8FAFC', borderBottomLeftRadius: 32, borderBottomRightRadius: 32 }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="#B40064"><path d="M10 0C4.48 0 0 4.48 0 10s4.48 10 10 10 10-4.48 10-10S15.52 0 10 0zm1 15H9V9h2v6zm0-8H9V5h2v2z"/></svg>
          <span style={{ color: '#191C1D', fontSize: 12, fontWeight: 500 }}>
            {employee.email ?? '연락처 정보가 없습니다'}
          </span>
        </div>
      </div>
    </div>
  )
}
