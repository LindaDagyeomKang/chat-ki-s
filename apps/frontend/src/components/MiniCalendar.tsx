'use client'

export default function MiniCalendar() {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const prevDays = new Date(year, month, 0).getDate()

  return (
    <div className="px-6 py-6">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-black" style={{ color: '#111547', fontFamily: 'Manrope' }}>
          {year}.{String(month + 1).padStart(2, '0')}
        </p>
        <div className="flex gap-2">
          <button style={{ color: '#94A3B8' }}>
            <svg width="5" height="7" viewBox="0 0 5 7" fill="currentColor"><path d="M3.5 7L0 3.5L3.5 0L4.317.817L1.633 3.5l2.684 2.683L3.5 7z"/></svg>
          </button>
          <button style={{ color: '#94A3B8' }}>
            <svg width="5" height="7" viewBox="0 0 5 7" fill="currentColor"><path d="M2.683 3.5L0 .817L.817 0 4.317 3.5.817 7 0 6.183 2.683 3.5z"/></svg>
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-0 text-center" style={{ fontFamily: 'Manrope' }}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <span key={`${d}${i}`} className="text-[10px] font-bold py-1" style={{ color: i === 0 || i === 6 ? '#CBD5E1' : '#94A3B8' }}>{d}</span>
        ))}
        {Array.from({ length: firstDay }, (_, i) => (
          <span key={`p${i}`} className="text-[10px] py-1" style={{ color: '#E2E8F0', fontWeight: 400 }}>{prevDays - firstDay + i + 1}</span>
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const d = i + 1
          const isToday = d === today.getDate()
          return (
            <span
              key={d}
              className="text-[10px] font-bold py-1 flex items-center justify-center"
              style={isToday ? { background: '#E1007F', color: '#FFF', borderRadius: 24, fontWeight: 900 } : { color: '#191C1D' }}
            >
              {d}
            </span>
          )
        })}
      </div>
    </div>
  )
}
