'use client'

import { useEffect, useState, useRef } from 'react'
import IntranetSidebar from '@/components/IntranetSidebar'
import { useUser } from '@/hooks/useUser'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

interface IndexedDoc {
  doc_id: string
  source: string
}

export default function KnowledgePage() {
  const { userName, userDept, userRole } = useUser()
  const [docs, setDocs] = useState<IndexedDoc[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchDocs()
  }, [])

  // 멘토가 아니면 접근 차단
  if (userRole && userRole !== 'mentor') {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold mb-2" style={{ color: '#111547' }}>접근 권한이 없습니다</p>
          <p className="text-sm" style={{ color: '#94A3B8' }}>지식관리는 멘토 계정만 이용할 수 있습니다.</p>
        </div>
      </div>
    )
  }

  async function fetchDocs() {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_URL}/api/rag/documents`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setDocs(data.documents || [])
    } catch {}
  }

  async function handleUpload(file: File) {
    setUploading(true)
    setUploadResult(null)
    try {
      const token = localStorage.getItem('token')
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`${API_URL}/api/rag/documents`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      if (res.ok) {
        const data = await res.json()
        setUploadResult(`"${file.name}" 등록 완료 (${data.chunks || 0}개 청크로 분할)`)
        fetchDocs()
      } else {
        const err = await res.text()
        setUploadResult(`업로드 실패: ${err}`)
      }
    } catch (e: any) {
      setUploadResult(`오류: ${e.message}`)
    } finally {
      setUploading(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleUpload(file)
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleUpload(file)
    e.target.value = ''
  }

  // 카테고리별 분류
  const categories = {
    '사내 규정/가이드': docs.filter(d => !d.source.startsWith('dept_') && !d.source.startsWith('맛집_') && !d.source.includes('금융용어')),
    '부서 소개': docs.filter(d => d.source.startsWith('dept_')),
    '맛집 정보': docs.filter(d => d.source.startsWith('맛집_')),
  }

  return (
    <div className="flex flex-1 min-h-0">
      <IntranetSidebar userName={userName} userDept={userDept} userRole={userRole} />

      <main className="flex-1 overflow-y-auto p-8 flex flex-col gap-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#111547" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <h1 className="text-2xl font-semibold" style={{ color: '#111547' }}>지식 관리</h1>
          </div>
          <p style={{ color: '#94A3B8', fontSize: 14 }}>사내 문서를 등록하면 챗봇 키링이 자동으로 학습하여 답변에 활용합니다.</p>
        </div>

        {/* 업로드 영역 */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="cursor-pointer transition-all"
          style={{
            border: dragOver ? '2px dashed #E1007F' : '2px dashed #E2E8F0',
            borderRadius: 24,
            padding: 40,
            textAlign: 'center',
            background: dragOver ? '#FDF2F8' : '#FAFBFC',
          }}
        >
          <input ref={fileInputRef} type="file" accept=".md,.txt,.docx,.pdf" onChange={handleFileSelect} className="hidden" />
          <svg className="mx-auto mb-3" width="40" height="40" viewBox="0 0 40 40" fill="none">
            <path d="M20 5v22M11 14l9-9 9 9" stroke={dragOver ? '#E1007F' : '#94A3B8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M5 28v5a2 2 0 002 2h26a2 2 0 002-2v-5" stroke={dragOver ? '#E1007F' : '#94A3B8'} strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <p className="text-sm font-medium mb-1" style={{ color: dragOver ? '#E1007F' : '#111547' }}>
            {uploading ? '업로드 중...' : '파일을 드래그하거나 클릭하여 업로드'}
          </p>
          <p style={{ fontSize: 12, color: '#94A3B8' }}>지원 형식: .md, .txt, .docx, .pdf</p>
        </div>

        {/* 업로드 결과 */}
        {uploadResult && (
          <div className="px-4 py-3 rounded-xl text-sm" style={{
            background: uploadResult.includes('완료') ? '#ECFDF5' : '#FEF2F2',
            color: uploadResult.includes('완료') ? '#047857' : '#DC2626',
          }}>
            {uploadResult}
          </div>
        )}

        {/* 등록된 문서 목록 */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-medium" style={{ fontSize: 16, color: '#111547' }}>등록된 문서 ({docs.length}건)</h2>
          </div>

          {Object.entries(categories).map(([catName, catDocs]) => (
            catDocs.length > 0 && (
              <div key={catName} className="mb-6">
                <h3 className="text-sm font-medium mb-2 px-1" style={{ color: '#64748B' }}>{catName} ({catDocs.length})</h3>
                <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid #F1F5F9' }}>
                  {catDocs.map((doc, i) => (
                    <div key={doc.doc_id} className="flex items-center gap-3 px-5 py-3" style={{ borderBottom: i < catDocs.length - 1 ? '1px solid #F8FAFC' : 'none' }}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#DBEAFE' }}>
                        <svg width="14" height="14" viewBox="0 0 16 20" fill="none"><path d="M10 0H2C.9 0 0 .9 0 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V6l-6-6zM2 18V2h7v5h5v11H2z" fill="#2563EB"/></svg>
                      </div>
                      <span className="text-sm truncate" style={{ color: '#334155' }}>{doc.source}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          ))}
        </div>
      </main>
    </div>
  )
}
