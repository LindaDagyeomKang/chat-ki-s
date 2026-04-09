'use client'

import { createContext, useContext, useState, useCallback } from 'react'

export interface PageContextData {
  type: string       // 'mail' | 'notice' | 'employee' | 'leave' | 'expense' | 'assignment' | ''
  title: string      // 현재 보고 있는 항목의 제목
  content: string    // 본문 또는 요약
  metadata?: string  // 추가 정보 (발신자, 날짜 등)
}

interface PageContextValue {
  pageContext: PageContextData
  setPageContext: (ctx: PageContextData) => void
  clearPageContext: () => void
}

const EMPTY: PageContextData = { type: '', title: '', content: '' }

const PageContext = createContext<PageContextValue>({
  pageContext: EMPTY,
  setPageContext: () => {},
  clearPageContext: () => {},
})

export function PageContextProvider({ children }: { children: React.ReactNode }) {
  const [pageContext, setPageContextState] = useState<PageContextData>(EMPTY)

  const setPageContext = useCallback((ctx: PageContextData) => {
    setPageContextState(ctx)
  }, [])

  const clearPageContext = useCallback(() => {
    setPageContextState(EMPTY)
  }, [])

  return (
    <PageContext.Provider value={{ pageContext, setPageContext, clearPageContext }}>
      {children}
    </PageContext.Provider>
  )
}

export function usePageContext() {
  return useContext(PageContext)
}
