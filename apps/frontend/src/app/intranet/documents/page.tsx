'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { getDocuments } from '@/lib/api'
import type { Document } from '@/lib/api'

const CATEGORIES = ['전체', 'AB테스트', 'KPI', '알고리즘', '고객분석', '콘텐츠', '주간동향']

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  draft: { label: '임시저장', color: '#EA580C', bg: '#FFEDD5', icon: '📝' },
  submitted: { label: '제출', color: '#2563EB', bg: '#DBEAFE', icon: '📤' },
  approved: { label: '승인완료', color: '#047857', bg: '#ECFDF5', icon: '✅' },
  rejected: { label: '반려', color: '#DC2626', bg: '#FEF2F2', icon: '❌' },
}

function getDocNumber(doc: Document) {
  const date = new Date(doc.submittedAt)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const seq = String(doc.id.charCodeAt(0) % 90 + 10)
  return `KW-${y}${m}-${seq}`
}

export default function DocumentsPage() {
  const searchParams = useSearchParams()
  const [docs, setDocs] = useState<Document[]>([])
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null)
  const [activeCategory, setActiveCategory] = useState('전체')
  const [searchKeyword, setSearchKeyword] = useState('')

  useEffect(() => {
    const cat = activeCategory === '전체' ? undefined : activeCategory
    const kw = searchKeyword.trim() || undefined
    getDocuments(cat, kw).then(setDocs).catch(() => {})
  }, [activeCategory, searchKeyword])

  useEffect(() => {
    const id = searchParams.get('id')
    if (id && docs.length > 0) {
      const found = docs.find(d => d.id === id)
      if (found) setSelectedDoc(found)
    }
  }, [searchParams, docs])

  return (
    <div className="flex flex-1 min-h-0">
      {/* 목록 */}
      <div className={`${selectedDoc ? 'w-[440px]' : 'flex-1'} flex flex-col border-r border-gray-100 bg-white`}>
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4 1h8l5 5v11a2 2 0 01-2 2H4a2 2 0 01-2-2V3a2 2 0 012-2z" stroke="#111547" strokeWidth="1.5" fill="none"/><path d="M12 1v5h5M7 10h6M7 13h4" stroke="#111547" strokeWidth="1.5" strokeLinecap="round"/></svg>
            <h1 className="text-lg font-semibold" style={{ color: '#111547' }}>결재함</h1>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#F1F5F9', color: '#64748B' }}>{docs.length}건</span>
          </div>
          <div className="relative mb-4">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M9 2a7 7 0 105.16 11.9l4.3 4.3a1 1 0 001.4-1.4l-4.3-4.3A7 7 0 009 2zm0 2a5 5 0 110 10A5 5 0 019 4z" fill="#94A3B8"/></svg>
            <input
              type="text"
              placeholder="문서번호, 제목, 작성자 검색"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl outline-none"
              style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }}
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className="px-3 py-1.5 text-xs font-medium rounded-full transition-colors"
                style={{
                  background: activeCategory === cat ? '#E1007F' : '#F1F5F9',
                  color: activeCategory === cat ? '#FFF' : '#64748B',
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* 목록 테이블 헤더 */}
        <div className="flex items-center px-6 py-2 text-[10px] font-medium border-b" style={{ color: '#94A3B8', borderColor: '#F1F5F9' }}>
          <span style={{ width: 100 }}>문서번호</span>
          <span className="flex-1">제목 / 작성자</span>
          <span style={{ width: 60, textAlign: 'right' }}>상태</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {docs.length === 0 ? (
            <p className="text-center py-12 text-sm" style={{ color: '#94A3B8' }}>문서가 없습니다</p>
          ) : (
            docs.map((d) => {
              const st = STATUS_LABELS[d.status] || STATUS_LABELS.submitted
              const docNum = getDocNumber(d)
              return (
                <div
                  key={d.id}
                  onClick={() => setSelectedDoc(d)}
                  className="flex items-center px-6 py-4 border-b cursor-pointer hover:bg-gray-50 transition-colors"
                  style={{ borderColor: '#F8FAFC', background: selectedDoc?.id === d.id ? '#FDF2F8' : undefined }}
                >
                  <span className="flex-shrink-0" style={{ width: 100, fontSize: 10, color: '#94A3B8', fontFamily: 'Manrope', fontWeight: 500 }}>{docNum}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: '#111547' }}>{d.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
                      {d.author} · {new Date(d.submittedAt).toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                  <span className="flex-shrink-0 ml-3 px-2.5 py-1 rounded-full text-[10px] font-semibold" style={{ background: st.bg, color: st.color }}>
                    {st.label}
                  </span>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* 상세 보기 */}
      {selectedDoc && (() => {
        const st = STATUS_LABELS[selectedDoc.status] || STATUS_LABELS.submitted
        const docNum = getDocNumber(selectedDoc)
        const submitDate = new Date(selectedDoc.submittedAt)
        return (
          <div className="flex-1 overflow-y-auto bg-gray-50 p-8">
            <div className="max-w-2xl mx-auto">
              <button onClick={() => setSelectedDoc(null)} className="text-sm mb-6 flex items-center gap-1 hover:text-gray-700 transition-colors" style={{ color: '#94A3B8' }}>
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M12 4l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                목록으로
              </button>

              {/* 문서 카드 */}
              <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>

                {/* 문서 헤더 */}
                <div className="p-6 pb-4" style={{ borderBottom: '2px solid #111547' }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-mono" style={{ color: '#94A3B8' }}>{docNum}</span>
                    <span className="text-xs font-semibold px-3 py-1 rounded-full" style={{ background: st.bg, color: st.color }}>
                      {st.icon} {st.label}
                    </span>
                  </div>
                  <h1 className="text-xl font-bold" style={{ color: '#111547' }}>{selectedDoc.title}</h1>
                </div>

                {/* 문서 정보 테이블 */}
                <div style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <div className="grid grid-cols-2 text-sm" style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <div className="flex">
                      <span className="px-4 py-3 font-medium flex-shrink-0" style={{ width: 90, background: '#F8FAFC', color: '#64748B', fontSize: 12 }}>기안자</span>
                      <span className="px-4 py-3" style={{ color: '#111547', fontSize: 12 }}>{selectedDoc.author}</span>
                    </div>
                    <div className="flex" style={{ borderLeft: '1px solid #F1F5F9' }}>
                      <span className="px-4 py-3 font-medium flex-shrink-0" style={{ width: 90, background: '#F8FAFC', color: '#64748B', fontSize: 12 }}>기안일</span>
                      <span className="px-4 py-3" style={{ color: '#111547', fontSize: 12 }}>
                        {submitDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 text-sm">
                    <div className="flex">
                      <span className="px-4 py-3 font-medium flex-shrink-0" style={{ width: 90, background: '#F8FAFC', color: '#64748B', fontSize: 12 }}>분류</span>
                      <span className="px-4 py-3" style={{ color: '#111547', fontSize: 12 }}>{selectedDoc.category}</span>
                    </div>
                    <div className="flex" style={{ borderLeft: '1px solid #F1F5F9' }}>
                      <span className="px-4 py-3 font-medium flex-shrink-0" style={{ width: 90, background: '#F8FAFC', color: '#64748B', fontSize: 12 }}>문서번호</span>
                      <span className="px-4 py-3 font-mono" style={{ color: '#111547', fontSize: 12 }}>{docNum}</span>
                    </div>
                  </div>
                </div>

                {/* 결재라인 */}
                <div className="p-6" style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <p className="text-xs font-medium mb-4" style={{ color: '#64748B' }}>결재라인</p>
                  <div className="flex items-center justify-center gap-2">
                    {/* 기안 */}
                    <div className="text-center p-3 rounded-xl flex-1" style={{ border: '1px solid #E2E8F0', maxWidth: 140 }}>
                      <p className="text-[10px] font-medium mb-1" style={{ color: '#94A3B8' }}>기안</p>
                      <p className="text-xs font-semibold" style={{ color: '#111547' }}>{selectedDoc.author.split(' ')[0]}</p>
                      <p className="text-[10px] mt-1" style={{ color: '#94A3B8' }}>{selectedDoc.author.split(' ').slice(1).join(' ')}</p>
                      <div className="mt-2 flex justify-center">
                        <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: '#ECFDF5', color: '#047857' }}>완료</span>
                      </div>
                    </div>

                    <svg width="20" height="12" viewBox="0 0 20 12" fill="none"><path d="M0 6h16M16 6l-4-4M16 6l-4 4" stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round"/></svg>

                    {/* 검토 */}
                    <div className="text-center p-3 rounded-xl flex-1" style={{ border: '1px solid #E2E8F0', maxWidth: 140 }}>
                      <p className="text-[10px] font-medium mb-1" style={{ color: '#94A3B8' }}>검토</p>
                      <p className="text-xs font-semibold" style={{ color: '#111547' }}>안홍철</p>
                      <p className="text-[10px] mt-1" style={{ color: '#94A3B8' }}>부장 (팀장)</p>
                      <div className="mt-2 flex justify-center">
                        <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: '#ECFDF5', color: '#047857' }}>완료</span>
                      </div>
                    </div>

                    <svg width="20" height="12" viewBox="0 0 20 12" fill="none"><path d="M0 6h16M16 6l-4-4M16 6l-4 4" stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round"/></svg>

                    {/* 승인 */}
                    <div className="text-center p-3 rounded-xl flex-1" style={{ border: selectedDoc.status === 'approved' ? '2px solid #047857' : '1px solid #E2E8F0', maxWidth: 140 }}>
                      <p className="text-[10px] font-medium mb-1" style={{ color: '#94A3B8' }}>승인</p>
                      <p className="text-xs font-semibold" style={{ color: '#111547' }}>송태현</p>
                      <p className="text-[10px] mt-1" style={{ color: '#94A3B8' }}>부장 (본부장)</p>
                      <div className="mt-2 flex justify-center">
                        <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 결재 이력 */}
                <div className="p-6" style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <p className="text-xs font-medium mb-3" style={{ color: '#64748B' }}>결재 이력</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 text-xs">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#047857' }} />
                      <span style={{ color: '#64748B', width: 130, fontFamily: 'Manrope' }}>
                        {new Date(submitDate.getTime()).toLocaleDateString('ko-KR')} 09:00
                      </span>
                      <span style={{ color: '#111547' }}>{selectedDoc.author.split(' ')[0]} — 기안 완료</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#047857' }} />
                      <span style={{ color: '#64748B', width: 130, fontFamily: 'Manrope' }}>
                        {new Date(submitDate.getTime() + 86400000).toLocaleDateString('ko-KR')} 14:20
                      </span>
                      <span style={{ color: '#111547' }}>안홍철 부장 — 검토 완료</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.color }} />
                      <span style={{ color: '#64748B', width: 130, fontFamily: 'Manrope' }}>
                        {new Date(submitDate.getTime() + 172800000).toLocaleDateString('ko-KR')} 10:15
                      </span>
                      <span style={{ color: '#111547' }}>송태현 부장 — {st.label}</span>
                    </div>
                  </div>
                </div>

                {/* 첨부파일 */}
                {selectedDoc.fileName && (
                  <div className="p-6">
                    <p className="text-xs font-medium mb-3" style={{ color: '#64748B' }}>첨부파일</p>
                    <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#DBEAFE' }}>
                          <svg width="14" height="16" viewBox="0 0 16 20" fill="none"><path d="M10 0H2C.9 0 0 .9 0 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V6l-6-6zM2 18V2h7v5h5v11H2z" fill="#2563EB"/></svg>
                        </div>
                        <div>
                          <p className="text-xs font-medium" style={{ color: '#334155' }}>{selectedDoc.fileName}</p>
                          <p className="text-[10px]" style={{ color: '#94A3B8' }}>Microsoft Word 문서</p>
                        </div>
                      </div>
                      <a
                        href={`/documents/${encodeURIComponent(selectedDoc.fileName)}`}
                        download
                        className="text-xs font-medium px-4 py-2 rounded-lg transition-colors hover:opacity-90"
                        style={{ background: '#E1007F', color: '#FFF' }}
                      >
                        다운로드
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
