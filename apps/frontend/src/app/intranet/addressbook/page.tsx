'use client'

import { useEffect, useState } from 'react'
import { searchEmployees, getEmployeeList, getEmployeeDivisions, getEmployeeTeams } from '@/lib/api'
import IntranetSidebar from '@/components/IntranetSidebar'
import ProfileModal from '@/components/ProfileModal'
import { useUser } from '@/hooks/useUser'
import type { Employee } from '@/lib/api'
import { usePageContext } from '@/contexts/PageContext'

const BADGE_COLORS = [
  { text: '온라인', color: 'bg-green-100 text-green-700' },
  { text: '자리비움', color: 'bg-orange-100 text-orange-700' },
  { text: '회의 중', color: 'bg-pink-100 text-pink-700' },
]

function getRandomBadge(name: string) {
  const idx = name.charCodeAt(0) % BADGE_COLORS.length
  return BADGE_COLORS[idx]
}

function getInitialColor(name: string) {
  const colors = [
    'from-blue-400 to-purple-500',
    'from-pink-400 to-red-400',
    'from-green-400 to-teal-500',
    'from-orange-400 to-yellow-500',
    'from-indigo-400 to-blue-500',
    'from-purple-400 to-pink-500',
  ]
  return colors[name.charCodeAt(0) % colors.length]
}

export default function AddressBookPage() {
  const { userName, userDept, userRole } = useUser()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [search, setSearch] = useState('')
  const [selectedDept, setSelectedDept] = useState('전체')
  const [selectedTeam, setSelectedTeam] = useState('전체')
  const [divisions, setDivisions] = useState<string[]>([])
  const [teams, setTeams] = useState<string[]>([])
  const [teamDropdownOpen, setTeamDropdownOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [selectedProfile, setSelectedProfile] = useState<Employee | null>(null)
  const { setPageContext, clearPageContext } = usePageContext()

  useEffect(() => {
    if (selectedProfile) {
      setPageContext({
        type: 'employee',
        title: selectedProfile.name,
        content: `${selectedProfile.division || ''} > ${selectedProfile.team || ''}\n직급: ${selectedProfile.rank || ''}\n담당: ${selectedProfile.duty || ''}`,
        metadata: `이메일: ${selectedProfile.email || ''}\n내선: ${selectedProfile.phone || ''}`,
      })
    } else {
      clearPageContext()
    }
  }, [selectedProfile])

  // 부문 목록 로드
  useEffect(() => {
    getEmployeeDivisions().then(setDivisions).catch(() => {})
  }, [])

  // 부문 변경 시 팀 목록 로드
  useEffect(() => {
    setSelectedTeam('전체')
    if (selectedDept !== '전체') {
      getEmployeeTeams(selectedDept).then(setTeams).catch(() => {})
    } else {
      getEmployeeTeams().then(setTeams).catch(() => {})
    }
  }, [selectedDept])

  useEffect(() => {
    loadData()
  }, [page, selectedDept, selectedTeam])

  async function loadData() {
    setLoading(true)
    try {
      if (selectedTeam !== '전체') {
        const results = await searchEmployees(selectedTeam)
        setEmployees(results)
        setTotal(results.length)
      } else if (selectedDept !== '전체') {
        const results = await searchEmployees('', selectedDept)
        setEmployees(results)
        setTotal(results.length)
      } else {
        const result = await getEmployeeList(page)
        setEmployees(result.data)
        setTotal(result.total)
      }
    } catch {} finally {
      setLoading(false)
    }
  }

  async function handleSearch() {
    if (!search.trim()) { loadData(); return }
    setLoading(true)
    try {
      const results = await searchEmployees(search.trim())
      setEmployees(results)
      setTotal(results.length)
    } catch {} finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSearch()
  }

  const filtered = employees

  return (
    <div className="flex flex-1 min-h-0">
    <IntranetSidebar userName={userName} userDept={userDept} userRole={userRole} />
    <main className="flex-1 overflow-y-auto">
    <div className="min-h-full bg-gray-50">
      {/* 상단 */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold text-gray-900">임직원 주소록</h1>
          </div>
          <p className="text-sm text-gray-500 mb-5">키움증권의 동료를 찾아보세요.</p>

          {/* 검색바 */}
          <div className="relative mb-5">
            <svg className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="이름, 부서 또는 담당업무 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-full bg-gray-50 focus:outline-none focus:border-pink-600 focus:bg-white transition-colors"
            />
          </div>

          {/* 부서 필터 */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => { setSelectedDept('전체'); setPage(1) }}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                selectedDept === '전체' ? 'bg-pink-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >전체</button>
            {divisions.map((dept) => (
              <button
                key={dept}
                onClick={() => { setSelectedDept(dept); setPage(1) }}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  selectedDept === dept ? 'bg-pink-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {dept}
              </button>
            ))}

            {/* 팀별 필터 드롭다운 */}
            <div className="relative ml-auto">
              <button
                onClick={() => setTeamDropdownOpen(!teamDropdownOpen)}
                className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors"
                style={{
                  background: selectedTeam !== '전체' ? '#E1007F' : '#FFF',
                  color: selectedTeam !== '전체' ? '#FFF' : '#111547',
                  border: '1px solid #E2E8F0',
                }}
              >
                <svg width="12" height="8" viewBox="0 0 14 9" fill="none"><path d="M5.25 9V7.5H8.25V9H5.25ZM2.25 5.25V3.75H11.25V5.25H2.25ZM0 1.5V0H13.5V1.5H0Z" fill="currentColor"/></svg>
                {selectedTeam !== '전체' ? selectedTeam : '팀 선택'}
                <svg width="8" height="5" viewBox="0 0 8 5" fill="currentColor"><path d="M4 5L0 0h8L4 5z"/></svg>
              </button>
              {teamDropdownOpen && (
                <div className="absolute right-0 top-full mt-1 w-56 max-h-64 overflow-y-auto bg-white rounded-xl shadow-lg border border-gray-200 z-50 py-1">
                  <button
                    onClick={() => { setSelectedTeam('전체'); setTeamDropdownOpen(false); setPage(1) }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
                    style={{ color: selectedTeam === '전체' ? '#E1007F' : '#111547', fontWeight: selectedTeam === '전체' ? 600 : 400 }}
                  >전체 팀</button>
                  {teams.map((team) => (
                    <button
                      key={team}
                      onClick={() => { setSelectedTeam(team); setTeamDropdownOpen(false); setPage(1) }}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
                      style={{ color: selectedTeam === team ? '#E1007F' : '#111547', fontWeight: selectedTeam === team ? 600 : 400 }}
                    >{team}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 카드 그리드 */}
      <div className="max-w-7xl mx-auto px-8 py-8">
        {loading ? (
          <div className="text-center py-12 text-gray-400">로딩 중...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500">검색 결과가 없습니다.</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {filtered.map((emp) => {
                const badge = getRandomBadge(emp.name)
                const gradColor = getInitialColor(emp.name)
                return (
                  <div key={emp.id} onClick={() => setSelectedProfile(emp)} className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                    <div className="flex flex-col items-center mb-4">
                      <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${gradColor} mb-3 flex items-center justify-center text-white text-2xl font-bold shadow-md`}>
                        {emp.name.slice(0, 1)}
                      </div>
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${badge.color}`}>
                        {badge.text}
                      </span>
                    </div>

                    <div className="text-center mb-4">
                      <h3 className="font-bold text-gray-900 text-lg">{emp.name}</h3>
                      <p className="text-pink-600 font-medium text-sm">{emp.rank ?? ''}{emp.position && emp.position !== '-' ? ` (${emp.position})` : ''}</p>
                      <div className="flex items-center justify-center gap-1.5 mt-1">
                        <span className="w-2 h-2 rounded-full" style={{ background: emp.status === '온라인' ? '#34D399' : emp.status === '자리비움' ? '#FBBF24' : emp.status === '회의중' ? '#F87171' : '#94A3B8' }} />
                        <span className="text-xs" style={{ color: '#94A3B8' }}>{emp.status || '오프라인'}</span>
                      </div>
                    </div>

                    <div className="space-y-2 mb-5 text-sm">
                      {emp.notice ? (
                        <p className="text-xs text-orange-600 bg-orange-50 rounded-lg p-2 text-center">{emp.notice}</p>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 text-gray-600">
                            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                            <span className="truncate">{emp.division ?? ''}{emp.team ? ` > ${emp.team}` : ''}</span>
                          </div>
                          {emp.email && (
                            <div className="flex items-center gap-2 text-gray-600">
                              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                              <span className="truncate">{emp.email}</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <a href="/intranet/mails" onClick={(e) => e.stopPropagation()} className="flex-1 bg-pink-600 text-white py-2 rounded-full font-medium hover:bg-pink-700 transition-colors text-sm text-center">
                        메일 보내기
                      </a>
                      <button onClick={(e) => e.stopPropagation()} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* 페이징 */}
            {!search && (
              <div className="flex justify-center gap-2 mt-8">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-4 py-2 rounded-lg bg-white border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                >
                  이전
                </button>
                <span className="px-4 py-2 text-sm text-gray-500">
                  {page} / {Math.ceil(Number(total) / 20)} 페이지
                </span>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page * 20 >= Number(total)}
                  className="px-4 py-2 rounded-lg bg-white border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                >
                  다음
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
    {/* 프로필 상세 모달 */}
    {selectedProfile && (
      <ProfileModal employee={selectedProfile} onClose={() => setSelectedProfile(null)} />
    )}
    </main>
    </div>
  )
}
