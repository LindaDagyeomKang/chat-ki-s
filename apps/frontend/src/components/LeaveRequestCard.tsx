'use client'

import type { LeaveRequest } from '@/lib/api'
import StatusBadge from './StatusBadge'

const LEAVE_LABELS: Record<string, string> = {
  annual: '정기 연차',
  half_am: '반차 (오전)',
  half_pm: '반차 (오후)',
  sick: '병가',
  special: '특별휴가',
}

interface LeaveRequestCardProps {
  leave: LeaveRequest
}

export default function LeaveRequestCard({ leave }: LeaveRequestCardProps) {
  const isApproved = leave.status === 'approved'

  return (
    <div className="flex items-center justify-between p-4 bg-white" style={{ borderRadius: 48 }}>
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: isApproved ? '#FFD9E3' : '#F1F5F9' }}>
          <img src={isApproved ? '/icons2/Icon-33.svg' : '/icons2/Icon-27.svg'} alt="" width={18} height={20} />
        </div>
        <div>
          <p style={{ color: '#111547', fontSize: 14, fontWeight: 500 }}>{LEAVE_LABELS[leave.leaveType] ?? leave.leaveType}</p>
          <p style={{ color: '#94A3B8', fontSize: 12, fontWeight: 500 }}>
            {leave.startDate === leave.endDate ? leave.startDate : `${leave.startDate} - ${leave.endDate}`}
          </p>
        </div>
      </div>
      <StatusBadge status={leave.status} size="md" />
    </div>
  )
}
