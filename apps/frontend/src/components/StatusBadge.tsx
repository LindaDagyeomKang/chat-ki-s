'use client'

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  pending: { bg: '#FFFBEB', color: '#D97706', label: '승인 대기' },
  approved: { bg: '#F0FDF4', color: '#16A34A', label: '승인 완료' },
  rejected: { bg: '#FEF2F2', color: '#DC2626', label: '반려' },
  REVIEW: { bg: '#FFEDD5', color: '#EA580C', label: 'REVIEW' },
  URGENT: { bg: '#DBEAFE', color: '#2563EB', label: 'URGENT' },
  NORMAL: { bg: '#F1F5F9', color: '#46464F', label: 'NORMAL' },
}

interface StatusBadgeProps {
  status: string
  label?: string
  size?: 'sm' | 'md'
}

export default function StatusBadge({ status, label, size = 'sm' }: StatusBadgeProps) {
  const config = STATUS_STYLES[status] ?? STATUS_STYLES.NORMAL
  const fontSize = size === 'sm' ? 10 : 12
  const px = size === 'sm' ? 8 : 12
  const py = size === 'sm' ? 2 : 4

  return (
    <span
      className="rounded-full font-medium whitespace-nowrap"
      style={{ background: config.bg, color: config.color, fontSize, paddingLeft: px, paddingRight: px, paddingTop: py, paddingBottom: py }}
    >
      {label ?? config.label}
    </span>
  )
}
