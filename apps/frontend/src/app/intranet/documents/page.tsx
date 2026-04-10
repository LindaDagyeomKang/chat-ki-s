'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { getDocuments } from '@/lib/api'
import type { Document } from '@/lib/api'

const CATEGORIES = ['전체', 'AB테스트', 'KPI', '알고리즘', '고객분석', '콘텐츠', '주간동향']

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: '임시저장', color: '#EA580C', bg: '#FFEDD5' },
  submitted: { label: '제출됨', color: '#2563EB', bg: '#DBEAFE' },
  approved: { label: '승인', color: '#047857', bg: '#ECFDF5' },
  rejected: { label: '반려', color: '#DC2626', bg: '#FEF2F2' },
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
      <div className={`${selectedDoc ? 'w-[420px]' : 'flex-1 max-w-3xl mx-auto'} flex flex-col border-r border-gray-100 bg-white`}>
        <div className="p-6 border-b border-gray-100">
          <h1 className="text-lg font-semibold mb-4" style={{ color: '#111547' }}>결재함</h1>
          <input
            type="text"
            placeholder="보고서 검색"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            className="w-full px-4 py-2.5 text-sm rounded-xl outline-none mb-4"
            style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }}
          />
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

        <div className="flex-1 overflow-y-auto">
          {docs.length === 0 ? (
            <p className="text-center py-12 text-sm" style={{ color: '#94A3B8' }}>문서가 없습니다</p>
          ) : (
            docs.map((d) => {
              const st = STATUS_LABELS[d.status] || STATUS_LABELS.submitted
              return (
                <div
                  key={d.id}
                  onClick={() => setSelectedDoc(d)}
                  className="px-6 py-5 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors"
                  style={{ background: selectedDoc?.id === d.id ? '#FDF2F8' : undefined }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: '#111547' }}>{d.title}</p>
                      <p className="text-xs mt-1.5" style={{ color: '#94A3B8' }}>
                        {d.author} · {new Date(d.submittedAt).toLocaleDateString('ko-KR')}
                      </p>
                    </div>
                    <span className="flex-shrink-0 ml-3 px-2.5 py-1 rounded-full text-[10px] font-semibold" style={{ background: st.bg, color: st.color }}>
                      {st.label}
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* 상세 보기 */}
      {selectedDoc && (
        <div className="flex-1 overflow-y-auto bg-white p-8">
          <div className="max-w-2xl mx-auto">
            <button onClick={() => setSelectedDoc(null)} className="text-sm mb-6" style={{ color: '#94A3B8' }}>← 목록으로</button>

            <div className="mb-8">
              <h1 className="text-xl font-semibold" style={{ color: '#111547' }}>{selectedDoc.title}</h1>
              <div className="flex items-center gap-4 mt-3">
                <p className="text-sm" style={{ color: '#64748B' }}>{selectedDoc.author}</p>
                <span style={{ color: '#E2E8F0' }}>|</span>
                <p className="text-sm" style={{ color: '#64748B' }}>
                  {new Date(selectedDoc.submittedAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
                <span style={{ color: '#E2E8F0' }}>|</span>
                {(() => {
                  const st = STATUS_LABELS[selectedDoc.status] || STATUS_LABELS.submitted
                  return <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                })()}
              </div>
            </div>

            {/* 첨부파일 */}
            {(selectedDoc as any).fileName && (
              <div className="mb-8 p-4 rounded-xl flex items-center justify-between" style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }}>
                <div className="flex items-center gap-3">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 0C4.48 0 0 4.48 0 10s4.48 10 10 10 10-4.48 10-10S15.52 0 10 0zm-1 14.5v-9l6 4.5-6 4.5z" fill="#94A3B8"/></svg>
                  <div>
                    <p className="text-sm font-medium" style={{ color: '#334155' }}>{(selectedDoc as any).fileName}</p>
                    <p className="text-xs" style={{ color: '#94A3B8' }}>첨부파일</p>
                  </div>
                </div>
                <a
                  href={`/documents/${encodeURIComponent((selectedDoc as any).fileName)}`}
                  download
                  className="text-xs font-medium px-4 py-2 rounded-lg"
                  style={{ background: '#E1007F', color: '#FFF' }}
                >
                  다운로드
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
