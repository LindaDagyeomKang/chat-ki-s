'use client'

import { useEffect, useState } from 'react'
import { getAssignments, submitAssignment } from '@/lib/api'
import IntranetSidebar from '@/components/IntranetSidebar'
import SpeedActions from '@/components/SpeedActions'
import { useUser } from '@/hooks/useUser'
import type { Assignment } from '@/lib/api'
import { usePageContext } from '@/contexts/PageContext'

interface Mission {
  id: string
  title: string
  description: string
  status: 'todo' | 'in_progress' | 'done'
  fromAssignment?: boolean
}

// 기본 온보딩 미션 (사수가 설정하는 구조)
const DEFAULT_MISSIONS: Omit<Mission, 'id'>[] = [
  { title: '연차 신청 해보기', description: '"직접 연차 신청을 한번 해보세요. 시스템을 직접 써보는 것이 자율성을 향한 첫 번째 단계입니다!"', status: 'todo' },
  { title: '사내 메신저 설치 및 인사', description: '"동료들과 소통하는 가장 빠른 방법입니다. 가벼운 인사와 함께 팀 채널에 합류해 보세요."', status: 'todo' },
  { title: '팀원들과 점심 식사', description: '"업무 외적인 대화를 통해 서로를 더 잘 알아가는 시간을 가져보시길 권장합니다."', status: 'todo' },
  { title: '비즈니스 이메일 서명 설정', description: '"우리 기업의 아이덴티티를 나타내는 표준 서명을 설정하여 전문성을 갖춰 보세요."', status: 'todo' },
  { title: '보안 서약서 작성', description: '"중요한 정보 자산을 보호하는 것은 금융인의 기본입니다. 내용을 꼼꼼히 확인하고 서명해 주세요."', status: 'in_progress' },
  { title: '사원증 등록', description: '"사원증은 Kiwoom 가족의 증표입니다. 분실하지 않도록 유의해주세요!"', status: 'done' },
]

const COLUMNS = [
  { key: 'todo', label: 'To Do', color: '#B40064', dot: '#B40064' },
  { key: 'in_progress', label: 'In Progress', color: '#FBBF24', dot: '#FBBF24' },
  { key: 'done', label: 'Done', color: '#10B981', dot: '#10B981' },
]

export default function OnboardingPage() {
  const { userName, userDept, userRole } = useUser()
  const [missions, setMissions] = useState<Mission[]>([])
  const { setPageContext, clearPageContext } = usePageContext()

  useEffect(() => {
    // 기본 미션 + DB 과제 병합
    const base = DEFAULT_MISSIONS.map((m, i) => ({ ...m, id: `default-${i}` }))
    getAssignments().then((assignments) => {
      const fromDb = assignments.map((a) => ({
        id: a.id,
        title: a.title,
        description: a.description || a.title,
        status: (a.status === 'completed' ? 'done' : a.status === 'submitted' ? 'in_progress' : 'todo') as Mission['status'],
        fromAssignment: true,
      }))
      setMissions([...base, ...fromDb])
    }).catch(() => setMissions(base))
  }, [])

  function toggleStatus(id: string) {
    setMissions((prev) => prev.map((m) => {
      if (m.id !== id) return m
      const next = m.status === 'todo' ? 'in_progress' : m.status === 'in_progress' ? 'done' : 'todo'
      return { ...m, status: next }
    }))
  }

  const totalMissions = missions.length
  const doneMissions = missions.filter((m) => m.status === 'done').length
  const progressPercent = totalMissions > 0 ? Math.round((doneMissions / totalMissions) * 100) : 0
  const circumference = 2 * Math.PI * 48

  return (
    <div className="flex flex-1 min-h-0">
      <IntranetSidebar userName={userName} userDept={userDept} userRole={userRole}>
        {/* 미션 진행도 */}
        <div className="px-6 py-8" style={{ borderBottom: '1px solid #F8FAFC' }}>
          <p style={{ color: '#111547', fontSize: 14, fontWeight: 700, marginBottom: 16 }}>미션 진행도</p>
          <div className="bg-white p-4 flex flex-col items-center" style={{ borderRadius: 32, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <div className="relative" style={{ width: 128, height: 128 }}>
              <svg width="128" height="128" viewBox="0 0 128 128" className="-rotate-90">
                <circle cx="64" cy="64" r="48" stroke="#E1E3E4" strokeWidth="8" fill="none" />
                <circle cx="64" cy="64" r="48" stroke="#E1007F" strokeWidth="8" fill="none"
                  strokeDasharray={`${circumference}`}
                  strokeDashoffset={`${circumference * (1 - progressPercent / 100)}`}
                  strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span style={{ color: '#111547', fontSize: 24, fontWeight: 800 }}>{progressPercent}%</span>
              </div>
            </div>
            <div className="mt-3 text-center">
              <p style={{ color: 'rgba(71,85,105,0.70)', fontSize: 14 }}>{totalMissions}개 중</p>
              <p style={{ color: '#475569', fontSize: 20, fontWeight: 500 }}>{doneMissions}개 완료</p>
            </div>
          </div>
        </div>

        <SpeedActions actions={[
          { label: '메일쓰기', href: '/intranet/mails', iconSvg: <svg width="16" height="13" viewBox="0 0 20 16" fill="none"><path d="M18 0H2C.9 0 .01.9.01 2L0 14c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V2c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V2l8 5 8-5v2z" fill="#E1007F"/></svg> },
          { label: '품의/결재', href: '/intranet/expenses', iconSvg: <svg width="14" height="16" viewBox="0 0 16 20" fill="none"><path d="M10 0H2C.9 0 .01.9.01 2L0 18c0 1.1.89 2 1.99 2H14c1.1 0 2-.9 2-2V6l-6-6zM2 18V2h7v5h5v11H2zm2-4h8v2H4v-2zm0-4h8v2H4v-2z" fill="#6366F1"/></svg> },
          { label: '시설예약', href: '/intranet/rooms', iconSvg: <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M7 0h6v2H7V0zM9 12h2V7H9v5zm1-12C4.48 0 0 4.48 0 10s4.48 10 10 10 10-4.48 10-10S15.52 0 10 0zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z" fill="#10B981"/></svg> },
          { label: '주소록', href: '/intranet/addressbook', iconSvg: <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M15 8a3 3 0 100-6 3 3 0 000 6zm-8 0a3 3 0 100-6 3 3 0 000 6zm0 2c-2.33 0-7 1.17-7 3.5V16h14v-2.5C14 11.17 9.33 10 7 10zm8 0c-.29 0-.62.02-.97.05A4.22 4.22 0 0118 13.5V16h2v-2.5C20 11.17 17.33 10 15 10z" fill="#F97316"/></svg> },
          { label: '일정관리', href: '/intranet/calendar', iconSvg: <svg width="16" height="16" viewBox="0 0 18 20" fill="none"><path d="M14 2h3c.55 0 1 .45 1 1v16c0 .55-.45 1-1 1H1c-.55 0-1-.45-1-1V3c0-.55.45-1 1-1h3V0h2v2h6V0h2v2zM2 8v10h14V8H2zm2 2h4v4H4v-4z" fill="#3B82F6"/></svg> },
          { label: '더보기', href: '/intranet', iconSvg: <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><circle cx="4" cy="4" r="2" fill="#94A3B8"/><circle cx="10" cy="4" r="2" fill="#94A3B8"/><circle cx="16" cy="4" r="2" fill="#94A3B8"/><circle cx="4" cy="10" r="2" fill="#94A3B8"/><circle cx="10" cy="10" r="2" fill="#94A3B8"/><circle cx="16" cy="10" r="2" fill="#94A3B8"/></svg> },
        ]} />
      </IntranetSidebar>

      <main className="flex-1 overflow-y-auto p-8 flex flex-col gap-6">
        {/* 헤더 */}
        <div>
          <h1 style={{ color: '#111547', fontSize: 30, fontWeight: 500 }}>챗키스: 챗봇과 함께하는 키움라이프 스터디</h1>
          <p style={{ color: 'rgba(17,21,71,0.50)', fontSize: 14, fontWeight: 500 }}>키움증권의 새로운 가족이 되신 것을 환영합니다. 멘토들의 조언을 수행해나가면서 함께 성장해나가요!</p>
        </div>

        {/* Tip 카드 */}
        <div className="flex items-center gap-4 px-6 py-4" style={{ background: 'rgba(255,217,227,0.30)', borderRadius: 32, outline: '1px solid rgba(180,0,100,0.10)' }}>
          <img src="/images/image 4.png" alt="" className="w-12 h-12 flex-shrink-0" />
          <div className="flex-1">
            <span style={{ color: '#B40064', fontSize: 12, fontFamily: 'Manrope', fontWeight: 700 }}>Tip!</span>
            <span style={{ color: '#475569', fontSize: 12 }}>
              멘토의 한마디는 신규 입사자분들의 빠른 적응을 위해 멘토들이 직접 남긴 코멘트로 설계되었습니다. 궁금한 점은 언제든 멘토나 AI 챗봇 키링에게 물어보세요!
            </span>
          </div>
        </div>

        {/* 칸반 보드 */}
        <div className="flex gap-6 flex-1 min-h-0">
          {COLUMNS.map((col) => {
            const colMissions = missions.filter((m) => m.status === col.key)
            return (
              <div key={col.key} className="flex-1 flex flex-col gap-4">
                {/* 컬럼 헤더 */}
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: col.dot }} />
                    <span style={{ color: '#111547', fontSize: 16, fontFamily: 'Manrope', fontWeight: 700 }}>{col.label}</span>
                    <span style={{ color: '#46464F', fontSize: 16, fontFamily: 'Manrope', fontWeight: 400, paddingLeft: 4 }}>{colMissions.length}</span>
                  </div>
                </div>

                {/* 카드들 */}
                <div className="flex flex-col gap-3">
                  {colMissions.map((mission) => (
                    <div
                      key={mission.id}
                      className="p-5 bg-white flex flex-col gap-2 cursor-pointer hover:shadow-md transition-shadow"
                      style={{
                        borderRadius: 32,
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                        outline: col.key === 'in_progress' ? '2px solid rgba(180,0,100,0.20)' : '1px solid rgba(0,0,0,0.03)',
                        outlineOffset: col.key === 'in_progress' ? -2 : -1,
                      }}
                      onClick={() => toggleStatus(mission.id)}
                    >
                      <div className="flex items-start gap-3">
                        {/* 체크박스 */}
                        <div className="pt-1">
                          <div
                            className="w-5 h-5 rounded-md flex items-center justify-center"
                            style={{
                              border: col.key === 'done' ? 'none' : col.key === 'in_progress' ? '1px solid #B40064' : '1px solid #E7E8E9',
                              background: col.key === 'done' ? '#10B981' : 'white',
                            }}
                          >
                            {col.key === 'done' && (
                              <svg width="12" height="10" viewBox="0 0 12 10" fill="none"><path d="M1 5l3 3 7-7" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
                            )}
                          </div>
                        </div>
                        <div className="flex-1">
                          <p style={{
                            color: '#111547',
                            fontSize: 16,
                            fontWeight: 500,
                            textDecoration: col.key === 'done' ? 'line-through' : 'none',
                          }}>{mission.title}</p>
                          <p style={{
                            color: col.key === 'done' ? 'rgba(70,70,79,0.60)' : '#46464F',
                            fontSize: 12,
                            fontWeight: col.key === 'done' ? 100 : 500,
                            lineHeight: '19.5px',
                            marginTop: 8,
                          }}>{mission.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

      </main>
    </div>
  )
}
