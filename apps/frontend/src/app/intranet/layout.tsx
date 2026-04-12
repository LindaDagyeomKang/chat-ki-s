'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { getToken, ensureAuth, getBotNickname, getMe } from '@/lib/api'
import { useChat } from '@/hooks/useChat'
import FloatingChat from '@/components/FloatingChat'
import { PageContextProvider, usePageContext } from '@/contexts/PageContext'

const TOP_NAV = [
  { href: '/intranet', label: '홈' },
  { href: '/intranet/mails', label: '전자우편' },
  { href: '/intranet/notices', label: '게시판' },
  { href: '/intranet/hr', label: '인사시스템' },
]

const TOP_NAV_MENTEE = [
  { href: '/intranet/onboarding', label: '챗키스' },
]

const TOP_NAV_MENTOR = [
  { href: '/intranet/approvals', label: '승인대기' },
  { href: '/intranet/knowledge', label: '지식관리' },
]

function IntranetLayoutInner({ children }: { children: React.ReactNode }) {
  const { pageContext } = usePageContext()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [ready, setReady] = useState(false)
  const [botName, setBotName] = useState('키링')
  const [userRole, setUserRole] = useState('mentee')
  const chat = useChat()

  // 전체화면 채팅에서 최소화로 넘어온 경우 대화 복원
  const chatOpenParam = searchParams.get('chatOpen')
  const convIdParam = searchParams.get('convId')
  const [floatingOpen, setFloatingOpen] = useState(false)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (initialized) return
    if (chatOpenParam === '1') {
      if (convIdParam) {
        chat.loadConversation(convIdParam)
      }
      setFloatingOpen(true)
      setInitialized(true)
    }
  }, [chatOpenParam, convIdParam, initialized])

  // 전체화면으로 확장 시 현재 대화 유지
  const handleExpand = useCallback(() => {
    const returnPath = encodeURIComponent(pathname)
    if (chat.conversationId) {
      router.push(`/chat?convId=${chat.conversationId}&returnPath=${returnPath}`)
    } else {
      router.push(`/chat?returnPath=${returnPath}`)
    }
  }, [chat.conversationId, router, pathname])

  useEffect(() => {
    setBotName(getBotNickname())
    async function init() {
      if (!getToken()) {
        try { await ensureAuth() } catch { router.replace('/login'); return }
      }
      try { const me = await getMe(); setUserRole(me.role) } catch {}
      setReady(true)
    }
    init()
  }, [router])

  if (!ready) return null

  const allNav = [...TOP_NAV, ...(userRole === 'mentor' ? TOP_NAV_MENTOR : TOP_NAV_MENTEE)]

  return (
    <div className="flex flex-col h-screen" style={{ background: '#F1F3F6', fontFamily: 'Pretendard, -apple-system, Roboto, Helvetica, sans-serif' }}>
      {/* 상단 네비 */}
      <header className="flex-shrink-0 z-10" style={{ background: 'rgba(255,255,255,0.90)', backdropFilter: 'blur(6px)', borderBottom: '1px solid #F1F5F9' }}>
        <div className="flex items-center justify-between px-6 h-16">
          <div className="flex items-center gap-16">
            <Link href="/intranet"><img src="/kiwoom-logo.png" alt="키움증권" style={{ height: 30 }} /></Link>
            <nav className="flex items-center gap-6">
              {allNav.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/intranet' && pathname.startsWith(item.href))
                return (
                  <Link key={item.href} href={item.href} className="text-sm" style={{ color: isActive ? '#E1007F' : '#6B7280', fontWeight: isActive ? 500 : 400 }}>
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <input type="text" placeholder="Search..." className="w-48 pl-4 pr-10 py-2 text-sm rounded-lg" style={{ background: '#F1F5F9' }} />
              <svg className="absolute right-3 top-2.5 w-4 h-4" style={{ color: '#46464F' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            <button className="p-2" style={{ color: '#46464F' }}><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg></button>
            <button className="p-2" style={{ color: '#46464F' }}><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg></button>
            <button className="p-2" style={{ color: '#46464F' }}><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        {children}
      </div>

      <FloatingChat
        chat={chat}
        botName={botName}
        defaultOpen={floatingOpen}
        onOpenChange={setFloatingOpen}
        onExpand={handleExpand}
        pageContext={pageContext}
      />
    </div>
  )
}

export default function IntranetLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageContextProvider>
      <IntranetLayoutInner>{children}</IntranetLayoutInner>
    </PageContextProvider>
  )
}
