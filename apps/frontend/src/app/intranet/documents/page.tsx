'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { getDocuments, getDocument } from '@/lib/api'
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

  // URL에 id가 있으면 상세 열기
  useEffect(() => {
    const id = searchParams.get('id')
    if (id) {
      getDocument(id).then(setSelectedDoc).catch(() => {})
    }
  }, [searchParams])

  return (
    <div className="flex flex-1 min-h-0">
      {/* 목록 */}
      <div className={`${selectedDoc ? 'w-[400px]' : 'flex-1'} flex flex-col border-r border-gray-100 bg-white`}>
        <div className="p-6 border-b border-gray-100">
          <h1 className="text-lg font-semibold mb-4" style={{ color: '#111547' }}>결재함</h1>
          {/* 검색 */}
          <input
            type="text"
            placeholder="보고서 검색 (제목, 작성자, 내용)"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            className="w-full px-4 py-2.5 text-sm rounded-xl outline-none mb-4"
            style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }}
          />
          {/* 카테고리 탭 */}
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

        {/* 문서 목록 */}
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
                  className="px-6 py-4 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors"
                  style={{ background: selectedDoc?.id === d.id ? '#FDF2F8' : undefined }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: '#F1F5F9', color: '#64748B' }}>{d.category}</span>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                  </div>
                  <p className="text-sm font-medium truncate mt-1" style={{ color: '#111547' }}>{d.title}</p>
                  <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>{d.author} · {new Date(d.submittedAt).toLocaleDateString('ko-KR')}</p>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* 상세 보기 */}
      {selectedDoc && (
        <div className="flex-1 overflow-y-auto bg-white p-8">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <button onClick={() => setSelectedDoc(null)} className="text-sm" style={{ color: '#64748B' }}>← 목록으로</button>
              <span className="text-xs font-medium px-3 py-1 rounded-full" style={{ ...STATUS_LABELS[selectedDoc.status] || STATUS_LABELS.submitted, background: (STATUS_LABELS[selectedDoc.status] || STATUS_LABELS.submitted).bg, color: (STATUS_LABELS[selectedDoc.status] || STATUS_LABELS.submitted).color }}>
                {(STATUS_LABELS[selectedDoc.status] || STATUS_LABELS.submitted).label}
              </span>
            </div>

            <div className="mb-6">
              <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: '#F1F5F9', color: '#64748B' }}>{selectedDoc.category}</span>
              <h1 className="text-xl font-semibold mt-2" style={{ color: '#111547' }}>{selectedDoc.title}</h1>
              <p className="text-sm mt-2" style={{ color: '#64748B' }}>
                {selectedDoc.author} · {new Date(selectedDoc.submittedAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>

            <div className="p-6 rounded-2xl" style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }}>
              <pre className="whitespace-pre-wrap text-sm leading-relaxed" style={{ color: '#334155', fontFamily: 'inherit' }}>
                {selectedDoc.content}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
