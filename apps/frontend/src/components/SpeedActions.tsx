'use client'

import Link from 'next/link'

interface SpeedAction {
  label: string
  href: string
  icon?: string
  iconSvg?: React.ReactNode
}

interface SpeedActionsProps {
  title?: string
  actions: SpeedAction[]
}

export default function SpeedActions({ title = 'Speed 작성', actions }: SpeedActionsProps) {
  return (
    <div className="px-6 py-8" style={{ borderBottom: '1px solid #F8FAFC' }}>
      <p style={{ color: '#111547', fontSize: 14, fontFamily: 'Manrope', fontWeight: 700, marginBottom: 16 }}>{title}</p>
      <div className="grid grid-cols-3 gap-2">
        {actions.map((item) => (
          <Link key={item.label} href={item.href} className="flex flex-col items-center gap-1 py-3 rounded-2xl hover:bg-gray-50 transition-colors">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: '#F8FAFC' }}>
              {item.iconSvg ? (
                item.iconSvg
              ) : item.icon ? (
                <img src={item.icon} alt="" width={16} height={16} />
              ) : (
                <div className="w-4 h-4 rounded-sm" style={{ background: '#94A3B8' }} />
              )}
            </div>
            <span style={{ color: '#46464F', fontSize: 10, fontWeight: 500 }}>{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
