'use client'

import { useEffect, useState } from 'react'
import { getNotices } from '@/lib/api'
import type { Notice } from '@/lib/api'
import IntranetSidebar from '@/components/IntranetSidebar'
import { useUser } from '@/hooks/useUser'
import { usePageContext } from '@/contexts/PageContext'

const SIDE_ICONS = {
  notices: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M10 6V0H18V6H10ZM0 10V0H8V10H0ZM10 18V8H18V18H10ZM0 18V12H8V18H0ZM2 8H6V2H2V8ZM12 16H16V10H12V16ZM12 4H16V2H12V4ZM2 16H6V14H2V16Z" fill="currentColor"/></svg>,
  board: <svg width="18" height="20" viewBox="0 0 18 20" fill="none"><path d="M7.6 15.05L14.65 8L13.25 6.6L7.6 12.25L4.75 9.4L3.35 10.8L7.6 15.05ZM2 20C1.45 20 0.979167 19.8042 0.5875 19.4125C0.195833 19.0208 0 18.55 0 18V4C0 3.45 0.195833 2.97917 0.5875 2.5875C0.979167 2.19583 1.45 2 2 2H6.2C6.41667 1.4 6.77917 0.916667 7.2875 0.55C7.79583 0.183333 8.36667 0 9 0C9.63333 0 10.2042 0.183333 10.7125 0.55C11.2208 0.916667 11.5833 1.4 11.8 2H16C16.55 2 17.0208 2.19583 17.4125 2.5875C17.8042 2.97917 18 3.45 18 4V18C18 18.55 17.8042 19.0208 17.4125 19.4125C17.0208 19.8042 16.55 20 16 20H2ZM9 3.25C9.21667 3.25 9.39583 3.17917 9.5375 3.0375C9.67917 2.89583 9.75 2.71667 9.75 2.5C9.75 2.28333 9.67917 2.10417 9.5375 1.9625C9.39583 1.82083 9.21667 1.75 9 1.75C8.78333 1.75 8.60417 1.82083 8.4625 1.9625C8.32083 2.10417 8.25 2.28333 8.25 2.5C8.25 2.71667 8.32083 2.89583 8.4625 3.0375C8.60417 3.17917 8.78333 3.25 9 3.25Z" fill="currentColor"/></svg>,
  org: <svg width="20" height="18" viewBox="0 0 20 18" fill="none"><path d="M13 18V15H9V5H7V8H0V0H7V3H13V0H20V8H13V5H11V13H13V10H20V18H13ZM15 6H18V2H15V6ZM15 16H18V12H15V16ZM2 6H5V2H2V6Z" fill="currentColor"/></svg>,
  press: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M20 20L16 16H6C5.45 16 4.97917 15.8042 4.5875 15.4125C4.19583 15.0208 4 14.55 4 14V13H15C15.55 13 16.0208 12.8042 16.4125 12.4125C16.8042 12.0208 17 11.55 17 11V4H18C18.55 4 19.0208 4.19583 19.4125 4.5875C19.8042 4.97917 20 5.45 20 6V20ZM2 10.175L3.175 9H13V2H2V10.175ZM0 15V2C0 1.45 0.195833 0.979167 0.5875 0.5875C0.979167 0.195833 1.45 0 2 0H13C13.55 0 14.0208 0.195833 14.4125 0.5875C14.8042 0.979167 15 1.45 15 2V9C15 9.55 14.8042 10.0208 14.4125 10.4125C14.0208 10.8042 13.55 11 13 11H4L0 15Z" fill="currentColor"/></svg>,
  event: <svg width="20" height="19" viewBox="0 0 20 19" fill="none"><path d="M6.85 14.825L10 12.925L13.15 14.85L12.325 11.25L15.1 8.85L11.45 8.525L10 5.125L8.55 8.5L4.9 8.825L7.675 11.25L6.85 14.825ZM3.825 19L5.45 11.975L0 7.25L7.2 6.625L10 0L12.8 6.625L20 7.25L14.55 11.975L16.175 19L10 15.275L3.825 19Z" fill="currentColor"/></svg>,
}

const SIDE_TABS = [
  { key: 'notices', label: '공지사항' },
  { key: 'board', label: '전사 게시판' },
  { key: 'org', label: '조직도' },
  { key: 'press', label: '보도자료' },
  { key: 'event', label: '사내 이벤트' },
]

const POPULAR = [
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
          <div className="max-w-4xl">
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
            <span className="w-5 h-5 flex items-center justify-center">{SIDE_ICONS[tab.key as keyof typeof SIDE_ICONS]}</span>
            {tab.label}
          </button>
        ))}
      </nav>
    </IntranetSidebar>

    {/* 메인 콘텐츠 */}
    <main className="flex-1 overflow-y-auto p-8 flex flex-col gap-8">
        {/* 헤더 */}
        <div className="flex items-start justify-between">
          <div>
            <h1 style={{ color: '#111547', fontSize: 30, fontFamily: 'Pretendard', fontWeight: 500, lineHeight: '36px' }}>전사 게시판</h1>
            <p style={{ color: 'rgba(17,21,71,0.50)', fontSize: 14, fontFamily: 'Pretendard', fontWeight: 500, lineHeight: '20px' }}>키움증권 임직원들의 소통과 정보 공유를 위한 공간입니다.</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-6 py-2.5 rounded-full" style={{ background: '#E1E3E4', color: '#111547', fontSize: 14, fontWeight: 500 }}>
              <svg width="14" height="9" viewBox="0 0 14 9" fill="none"><path d="M5.25 9V7.5H8.25V9H5.25ZM2.25 5.25V3.75H11.25V5.25H2.25ZM0 1.5V0H13.5V1.5H0Z" fill="#111547"/></svg>
              필터
            </button>
            <button className="flex items-center gap-2 px-8 py-2.5 rounded-full text-white" style={{ background: '#E1007F', fontSize: 14, fontWeight: 500, boxShadow: '0px 4px 6px -4px rgba(225,0,127,0.20), 0px 10px 15px -3px rgba(225,0,127,0.20)' }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1.5 12H2.56875L9.9 4.66875L8.83125 3.6L1.5 10.9313V12ZM12.05 3.55L9.95 1.45L11.05 0.35C11.2333 0.166667 11.4625 0.075 11.7375 0.075C12.0125 0.075 12.2417 0.166667 12.425 0.35L13.15 1.075C13.3333 1.25833 13.425 1.4875 13.425 1.7625C13.425 2.0375 13.3333 2.26667 13.15 2.45L12.05 3.55ZM0 13.5V10.5L9.1 1.4L12.1 4.4L3 13.5H0Z" fill="white"/></svg>
              글쓰기
            </button>
          </div>
        </div>

        {/* 피처드 카드 + 인기글 */}
        <div className="flex gap-6">
          {/* 피처드 카드 (좌측, 네이비) */}
          <div className="flex-1 p-8 flex flex-col justify-between relative overflow-hidden" style={{ borderRadius: 32, background: 'linear-gradient(169deg, #111547 0%, #1A237E 100%)', minHeight: 260 }}>
            <div>
              <span className="inline-block text-[10px] font-medium px-3 py-1 rounded-full mb-4" style={{ background: '#E1007F', color: '#FFF' }}>공지사항</span>
              <h2 className="text-xl font-medium text-white mb-2 leading-snug" style={{ maxWidth: '60%' }}>2026년 신입사원 온보딩 AI 챗봇 Chat-Ki-S</h2>
              <p className="text-xs text-white/60 mb-6">임직원 여러분의 많은 관심과 적극적인 사용 부탁드립니다.</p>
            </div>
            <a href="/chat" className="inline-flex items-center px-6 py-2 rounded-full" style={{ background: '#FFF', color: '#111547', fontSize: 12, fontWeight: 500, width: 'fit-content' }}>
              자세히 보기
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
                {POPULAR.map((title, i) => (
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
                <th className="px-6 py-4 text-right text-[10px] font-medium" style={{ color: '#94A3B8', width: 70, fontFamily: 'Manrope' }}>조회수</th>
              </tr>
            </thead>
            <tbody>
              {notices.map((n, idx) => (
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
                      {[1204, 425, 892, 1056, 312][idx % 5].toLocaleString()}
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
    </main>
    </div>
  )
}
