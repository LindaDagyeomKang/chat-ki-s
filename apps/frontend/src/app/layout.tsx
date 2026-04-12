import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Chat-Ki-S | 키움증권 온보딩 챗봇',
  description: '신입사원을 위한 24/7 온보딩 지원 챗봇',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body style={{ fontFamily: "'Pretendard', -apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', sans-serif" }}>{children}</body>
    </html>
  )
}
