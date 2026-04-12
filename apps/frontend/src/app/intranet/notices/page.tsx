'use client'

import { useEffect, useState } from 'react'
import { getNotices, createNotice } from '@/lib/api'
import type { Notice } from '@/lib/api'
import IntranetSidebar from '@/components/IntranetSidebar'
import SpeedActions from '@/components/SpeedActions'
import { useUser } from '@/hooks/useUser'
import { usePageContext } from '@/contexts/PageContext'

const SIDE_TABS = [
  { key: 'notices', label: '공지사항' },
  { key: 'board', label: '전사 게시판' },
  { key: 'org', label: '조직도' },
  { key: 'press', label: '보도자료' },
  { key: 'event', label: '사내 이벤트' },
]

const POPULAR_FALLBACK = [
  '구내식당 신메뉴 제안 건',
  '이번 주말 사내 동호회 등산...',
  '연말 정산 관련 Q&A 모음',
  'Chat-Ki-S 챗봇 사용법',
  '사내 휴게공간 이용 후기...',
]

export default function NoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([])
  const [selected, setSelected] = useState<Notice | null>(null)
  const { userName, userDept, userRole } = useUser()
  const [activeTab, setActiveTab] = useState('board')
  const [filterCategory, setFilterCategory] = useState<string | null>(null)
  const [filterOpen, setFilterOpen] = useState(false)
  const [composing, setComposing] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [newCategory, setNewCategory] = useState('일반')
  const { setPageContext, clearPageContext } = usePageContext()

  useEffect(() => {
    getNotices().then(setNotices).catch(() => {})
  }, [])

  useEffect(() => {
    if (selected) {
      setPageContext({ type: 'notice', title: selected.title, content: selected.content, metadata: `카테고리: ${selected.category}` })
    } else {
      clearPageContext()
    }
  }, [selected])

  if (selected) {
    return (
      <div className="flex flex-1 min-h-0">
        <IntranetSidebar userName={userName} userDept={userDept} userRole={userRole}>
          <nav className="py-4 px-4 space-y-1">
            {SIDE_TABS.map((tab) => (
              <button key={tab.key} onClick={() => { setSelected(null); setActiveTab(tab.key) }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium" style={{ color: '#46464F' }}>
                {tab.label}
              </button>
            ))}
          </nav>
        </IntranetSidebar>
        <main className="flex-1 overflow-y-auto p-8">
          <div className="w-full">
            <button onClick={() => setSelected(null)} className="flex items-center gap-1 text-sm mb-6 hover:underline" style={{ color: '#E1007F' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              목록으로
            </button>
            <div className="bg-white p-8" style={{ borderRadius: 24, border: '1px solid #F1F5F9', boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)' }}>
              <div className="flex items-center gap-2 mb-3">
                {selected.pinned && (
                  <span className="text-[9px] font-black px-2.5 py-1 rounded-full" style={{ background: '#FFE8F3', color: '#E1007F', fontFamily: 'Manrope' }}>필독</span>
                )}
                <span className="text-[9px] font-black px-2.5 py-1 rounded-full" style={{ background: '#F1F5F9', color: '#46464F', fontFamily: 'Manrope' }}>{selected.category}</span>
              </div>
              <h1 className="text-xl font-medium mb-2" style={{ color: '#111547' }}>{selected.title}</h1>
              <p className="text-xs mb-8" style={{ color: '#94A3B8', fontFamily: 'Manrope' }}>
                {new Date(selected.createdAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
              <div className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: '#46464F' }}>{selected.content}</div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex flex-1 min-h-0">
    <IntranetSidebar userName={userName} userDept={userDept} userRole={userRole}>
      {/* 게시판 탭 네비 */}
      <nav className="py-4 px-4 space-y-1">
        {SIDE_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="w-full flex items-center gap-3 px-4 py-3 transition-colors"
            style={{
              borderRadius: 16,
              color: activeTab === tab.key ? '#E1017F' : '#475569',
              fontSize: 14,
              fontFamily: 'Pretendard',
              fontWeight: 500,
              lineHeight: '20px',
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      {/* Speed 메뉴 (탭 아래) */}
      <SpeedActions actions={[
        { label: '메일쓰기', href: '/intranet/mails', iconSvg: <svg width="16" height="13" viewBox="0 0 20 16" fill="none"><path d="M18 0H2C.9 0 .01.9.01 2L0 14c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V2c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V2l8 5 8-5v2z" fill="#E1007F"/></svg> },
        { label: '품의/결재', href: '/intranet/expenses', iconSvg: <svg width="14" height="16" viewBox="0 0 16 20" fill="none"><path d="M10 0H2C.9 0 .01.9.01 2L0 18c0 1.1.89 2 1.99 2H14c1.1 0 2-.9 2-2V6l-6-6zM2 18V2h7v5h5v11H2zm2-4h8v2H4v-2zm0-4h8v2H4v-2z" fill="#6366F1"/></svg> },
        { label: '시설예약', href: '/intranet/rooms', iconSvg: <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M7 0h6v2H7V0zM9 12h2V7H9v5zm1-12C4.48 0 0 4.48 0 10s4.48 10 10 10 10-4.48 10-10S15.52 0 10 0zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z" fill="#10B981"/></svg> },
        { label: '주소록', href: '/intranet/addressbook', iconSvg: <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M15 8a3 3 0 100-6 3 3 0 000 6zm-8 0a3 3 0 100-6 3 3 0 000 6zm0 2c-2.33 0-7 1.17-7 3.5V16h14v-2.5C14 11.17 9.33 10 7 10zm8 0c-.29 0-.62.02-.97.05A4.22 4.22 0 0118 13.5V16h2v-2.5C20 11.17 17.33 10 15 10z" fill="#F97316"/></svg> },
        { label: '일정관리', href: '/intranet/calendar', iconSvg: <svg width="16" height="16" viewBox="0 0 18 20" fill="none"><path d="M14 2h3c.55 0 1 .45 1 1v16c0 .55-.45 1-1 1H1c-.55 0-1-.45-1-1V3c0-.55.45-1 1-1h3V0h2v2h6V0h2v2zM2 8v10h14V8H2zm2 2h4v4H4v-4z" fill="#3B82F6"/></svg> },
        { label: '더보기', href: '/intranet', iconSvg: <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><circle cx="4" cy="4" r="2" fill="#94A3B8"/><circle cx="10" cy="4" r="2" fill="#94A3B8"/><circle cx="16" cy="4" r="2" fill="#94A3B8"/><circle cx="4" cy="10" r="2" fill="#94A3B8"/><circle cx="10" cy="10" r="2" fill="#94A3B8"/><circle cx="16" cy="10" r="2" fill="#94A3B8"/></svg> },
      ]} />
    </IntranetSidebar>

    {/* 메인 콘텐츠 */}
    <main className="flex-1 overflow-y-auto p-8 flex flex-col gap-8">
        {/* 헤더 */}
        <div className="flex items-start justify-between">
          <div>
            <h1 style={{ color: '#111547', fontSize: 30, fontFamily: 'Pretendard', fontWeight: 500, lineHeight: '36px' }}>전사 게시판</h1>
            <p style={{ color: 'rgba(17,21,71,0.50)', fontSize: 14, fontFamily: 'Pretendard', fontWeight: 500, lineHeight: '20px' }}>키움증권 임직원들의 소통과 정보 공유를 위한 공간입니다.</p>
          </div>
          <div className="flex items-center gap-2 relative">
            <button onClick={() => setFilterOpen(!filterOpen)} className="flex items-center gap-2 px-6 py-2.5 rounded-full" style={{ background: filterCategory ? '#E1007F' : '#E1E3E4', color: filterCategory ? '#FFF' : '#111547', fontSize: 14, fontWeight: 500 }}>
              <svg width="14" height="9" viewBox="0 0 14 9" fill="none"><path d="M5.25 9V7.5H8.25V9H5.25ZM2.25 5.25V3.75H11.25V5.25H2.25ZM0 1.5V0H13.5V1.5H0Z" fill={filterCategory ? '#FFF' : '#111547'}/></svg>
              {filterCategory || '필터'}
            </button>
            {filterOpen && (
              <div className="absolute right-0 top-12 bg-white rounded-2xl shadow-lg py-2 z-10" style={{ border: '1px solid #F1F5F9', minWidth: 140 }}>
                {['전체', '인사', '보안', '경영지원', '총무', '일반'].map((cat) => (
                  <button key={cat} onClick={() => { setFilterCategory(cat === '전체' ? null : cat); setFilterOpen(false) }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50" style={{ color: '#111547' }}>
                    {cat}
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => setComposing(true)} className="flex items-center gap-2 px-8 py-2.5 rounded-full text-white" style={{ background: '#E1007F', fontSize: 14, fontWeight: 500, boxShadow: '0px 4px 6px -4px rgba(225,0,127,0.20), 0px 10px 15px -3px rgba(225,0,127,0.20)' }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1.5 12H2.56875L9.9 4.66875L8.83125 3.6L1.5 10.9313V12ZM12.05 3.55L9.95 1.45L11.05 0.35C11.2333 0.166667 11.4625 0.075 11.7375 0.075C12.0125 0.075 12.2417 0.166667 12.425 0.35L13.15 1.075C13.3333 1.25833 13.425 1.4875 13.425 1.7625C13.425 2.0375 13.3333 2.26667 13.15 2.45L12.05 3.55ZM0 13.5V10.5L9.1 1.4L12.1 4.4L3 13.5H0Z" fill="white"/></svg>
              글쓰기
            </button>
          </div>
        </div>

        {/* 피처드 카드 + 인기글 */}
        <div className="flex gap-6">
          {/* 피처드 카드 (좌측, 네이비) */}
          <div className="flex-1 p-6 flex flex-col justify-between relative overflow-hidden" style={{ borderRadius: 32, background: 'linear-gradient(169deg, #111547 0%, #1A237E 100%)', minHeight: 160 }}>
            <div>
              <span className="inline-block text-[10px] font-medium px-3 py-1 rounded-full mb-4" style={{ background: '#E1007F', color: '#FFF' }}>게시판 안내</span>
              <h2 className="text-xl font-medium text-white mb-2 leading-snug" style={{ maxWidth: '60%' }}>궁금한 점이 있다면? AI 챗봇 키링에게 물어보세요</h2>
              <p className="text-xs text-white/60 mb-6">게시판 공지사항을 보면서 키링에게 내용을 요약하거나 관련 규정을 물어볼 수 있어요.</p>
            </div>
            <a href="/chat" className="inline-flex items-center px-6 py-2 rounded-full" style={{ background: '#FFF', color: '#111547', fontSize: 12, fontWeight: 500, width: 'fit-content' }}>
              키링에게 물어보기
            </a>
            {/* 챗봇 로고 (오른쪽) */}
            <img src="/images/image 4.png" alt="Chat-Ki-S" className="absolute right-16 top-1/2 -translate-y-1/2" style={{ width: 160 }} />
            {/* 확성기 아이콘 (배경) */}
            <img src="/icons/Featured/Icon-5.svg" alt="" className="absolute right-0 bottom-0" style={{ width: 160, opacity: 0.15 }} />
          </div>

          {/* 실시간 인기글 (우측 카드) */}
          <div className="bg-white p-6 flex flex-col justify-between" style={{ borderRadius: 32, border: '1px solid #F1F5F9', boxShadow: '0px 1px 2px rgba(0,0,0,0.05)', width: 300, flexShrink: 0 }}>
            <div>
              <div className="flex items-center gap-2 mb-6">
                <svg width="20" height="12" viewBox="0 0 20 12" fill="none"><path d="M1.4 12L0 10.6L7.4 3.15L11.4 7.15L16.6 2H14V0H20V6H18V3.4L11.4 10L7.4 6L1.4 12Z" fill="#B40064"/></svg>
                <h3 style={{ color: '#B40064', fontSize: 14, fontWeight: 500 }}>실시간 인기글</h3>
              </div>
              <div className="space-y-3">
                {(notices.length > 0 ? [...notices].sort((a, b) => ((b as any).views ?? 0) - ((a as any).views ?? 0)).slice(0, Math.min(notices.length, 5)).map(n => n.title) : POPULAR_FALLBACK).map((title, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="w-4" style={{ color: '#CBD5E1', fontSize: 12, fontFamily: 'Manrope', fontWeight: 700 }}>{i + 1}</span>
                    <span style={{ color: '#111547', fontSize: 12, fontWeight: 500, lineHeight: '16px' }} className="truncate">{title}</span>
                  </div>
                ))}
              </div>
            </div>
            <p style={{ color: '#94A3B8', fontSize: 10, fontWeight: 500, marginTop: 16 }}>전체 인기글 보기 →</p>
          </div>
        </div>

        {/* 게시글 테이블 */}
        <div className="bg-white overflow-hidden" style={{ borderRadius: 32, border: '1px solid #F1F5F9', boxShadow: '0px 1px 2px rgba(0,0,0,0.05)' }}>
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                <th className="px-6 py-4 text-left text-[10px] font-medium" style={{ color: '#94A3B8', width: 96 }}>상태</th>
                <th className="px-6 py-4 text-left text-[10px] font-medium" style={{ color: '#94A3B8' }}>제목</th>
                <th className="px-6 py-4 text-left text-[10px] font-medium" style={{ color: '#94A3B8', width: 110 }}>작성자</th>
                <th className="px-6 py-4 text-left text-[10px] font-medium" style={{ color: '#94A3B8', width: 100, fontFamily: 'Manrope' }}>작성일</th>
                <th className="px-6 py-4 text-right text-[10px] font-medium" style={{ color: '#94A3B8', width: 90, fontFamily: 'Manrope' }}>조회수</th>
              </tr>
            </thead>
            <tbody>
              {notices.filter(n => !filterCategory || n.category === filterCategory).map((n, idx) => (
                <tr
                  key={n.id}
                  onClick={() => setSelected(n)}
                  className="cursor-pointer transition-colors hover:bg-gray-50"
                  style={{ borderBottom: '1px solid #F8FAFC' }}
                >
                  <td className="px-6 py-4">
                    {n.pinned ? (
                      <span className="text-[10px] font-medium px-3 py-1 rounded-full whitespace-nowrap" style={{ background: '#FFE8F3', color: '#E1007F' }}>필독</span>
                    ) : idx === notices.length - 1 ? (
                      <span className="text-[10px] font-medium px-3 py-1 rounded-full whitespace-nowrap" style={{ background: '#E0F7F9', color: '#0891B2' }}>건의</span>
                    ) : (
                      <span className="text-[10px] font-medium px-3 py-1 rounded-full whitespace-nowrap" style={{ background: '#F1F5F9', color: '#64748B' }}>일반</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-medium" style={{ color: '#111547' }}>{n.title}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[10px]" style={{ color: '#6B7280' }}>{n.category}팀</span>
                  </td>
                  <td className="px-6 py-4">
                    <span style={{ fontSize: 10, color: '#94A3B8', fontFamily: 'Manrope' }}>
                      {new Date(n.createdAt).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '.').slice(0, -1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span style={{ fontSize: 10, color: '#E1007F', fontFamily: 'Manrope', fontWeight: 500 }}>
                      {((n as any).views ?? 0).toLocaleString()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* 페이지네이션 */}
          <div className="flex justify-center gap-1 py-4" style={{ borderTop: '1px solid #F1F5F9' }}>
            <button className="w-8 h-8 rounded-full flex items-center justify-center text-xs" style={{ color: '#94A3B8' }}>&lt;</button>
            <button className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: '#111547' }}>1</button>
            {[2, 3, 4, 5].map((p) => (
              <button key={p} className="w-8 h-8 rounded-full flex items-center justify-center text-xs" style={{ color: '#94A3B8' }}>{p}</button>
            ))}
            <button className="w-8 h-8 rounded-full flex items-center justify-center text-xs" style={{ color: '#94A3B8' }}>&gt;</button>
          </div>
        </div>
    {/* 글쓰기 모달 */}
    {composing && (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.3)' }}>
        <div className="bg-white p-6 space-y-4" style={{ borderRadius: 24, width: 480 }}>
          <h3 className="font-medium" style={{ fontSize: 16, color: '#111547' }}>게시글 작성</h3>
          <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-xl outline-none" style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }}>
            {['일반', '인사', '보안', '경영지원', '총무'].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input placeholder="제목" value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-xl outline-none" style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }} />
          <textarea placeholder="내용을 입력하세요" value={newContent} onChange={(e) => setNewContent(e.target.value)} rows={6}
            className="w-full px-3 py-2 text-sm rounded-xl outline-none resize-none" style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }} />
          <div className="flex gap-2">
            <button
              onClick={async () => {
                if (!newTitle.trim() || !newContent.trim()) return
                const created = await createNotice({ title: newTitle, content: newContent, category: newCategory })
                setNotices((prev) => [created, ...prev])
                setNewTitle(''); setNewContent(''); setNewCategory('일반'); setComposing(false)
              }}
              className="flex-1 py-2 text-white text-sm font-medium rounded-xl" style={{ background: '#E1007F' }}>등록</button>
            <button onClick={() => { setComposing(false); setNewTitle(''); setNewContent(''); setNewCategory('일반') }}
              className="flex-1 py-2 text-sm font-medium rounded-xl" style={{ background: '#F1F5F9', color: '#475569' }}>취소</button>
          </div>
        </div>
      </div>
    )}
    </main>
    </div>
  )
}
