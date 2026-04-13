/**
 * Function Calling 도구 실행기
 * LLM이 요청한 함수를 실행하고 결과를 반환합니다.
 */
import { db } from '../db'
import { employees, users, mails, notices, leaveRequests, expenses, assignments, calendarEvents, surveyQuestions, surveyResponses, meetingRooms, roomReservations, documents } from '../db/schema'
import { eq, desc, asc, and, gte, lte, or, ilike, sql } from 'drizzle-orm'

const EXEC_RANKS = ['사장', '부사장', '전무', '상무', '이사']

interface ToolContext {
  userId: string
  userName: string | null
  userDivision: string | null
  userRank: string | null
  userTeam: string | null
  userEmail: string | null
  userPhone: string | null
}

async function getUserContext(userId: string): Promise<ToolContext> {
  const user = (await db.select().from(users).where(eq(users.id, userId)))[0]
  let division: string | null = null
  let rank: string | null = null
  let team: string | null = null
  let userEmail: string | null = null
  let userPhone: string | null = null
  if (user) {
    const emp = (await db.select().from(employees).where(eq(employees.name, user.name)).limit(1))[0]
    if (emp) {
      division = emp.division
      rank = emp.rank
      team = emp.team
      userEmail = emp.email
      userPhone = emp.phone
    }
  }
  return { userId, userName: user?.name || null, userDivision: division, userRank: rank, userTeam: team, userEmail, userPhone }
}

export async function executeTool(
  toolName: string,
  args: Record<string, any>,
  userId: string,
): Promise<{ result: string; agentAction?: { action: string; params: Record<string, any>; confirmationMessage: string } }> {
  const ctx = await getUserContext(userId)

  switch (toolName) {
    case 'get_mails': {
      const filter = args.filter || 'all'
      const sender = args.sender || ''
      const keyword = args.keyword || ''

      const _query = db.select().from(mails).where(eq(mails.toId, userId))

      const conditions: any[] = [eq(mails.toId, userId)]

      if (filter === 'today') {
        // KST 기준 오늘 시작~끝
        const todayStart = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
        todayStart.setHours(0, 0, 0, 0)
        const todayEnd = new Date(todayStart)
        todayEnd.setHours(23, 59, 59, 999)
        conditions.push(gte(mails.receivedAt, todayStart))
        conditions.push(lte(mails.receivedAt, todayEnd))
      } else if (filter === 'unread') {
        conditions.push(eq(mails.isRead, false))
      }

      const rows = await db.select().from(mails)
        .where(and(...conditions))
        .orderBy(desc(mails.receivedAt))
        .limit(50)

      // 발신자/키워드 필터 (from_text에서)
      let filtered = rows
      if (sender) {
        // 직급 제거하고 이름만 추출 (예: "제민재 과장" → "제민재")
        const senderName = sender.replace(/\s*(사장|부사장|전무|상무|이사|부장|차장|과장|대리|주임|사원|팀장|본부장)\s*/g, '').trim()
        filtered = filtered.filter((m: any) => m.fromText?.includes(senderName))
      }
      if (keyword) {
        filtered = filtered.filter((m: any) => m.subject?.includes(keyword) || m.body?.includes(keyword))
      }

      if (filtered.length === 0) {
        // 오늘 메일 없으면 최근 메일로 fallback
        if (filter === 'today') {
          const recent = await db.select().from(mails)
            .where(eq(mails.toId, userId))
            .orderBy(desc(mails.receivedAt))
            .limit(10)
          if (recent.length > 0) {
            const list = recent.map((m: any, i: number) => {
              const date = new Date(m.receivedAt)
              const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`
              const senderName = m.fromText?.match(/^([가-힣]+)/)?.[1] || '알 수 없음'
              return `${i + 1}. [${senderName}] ${m.subject} (${dateStr})`
            }).join('\n')
            return { result: `오늘 새로 받은 메일은 없습니다.\n\n[참고] 최근 받은 메일 ${recent.length}건 (오늘 메일이 아닌 이전 메일입니다):\n${list}` }
          }
        }
        const label = filter === 'today' ? '오늘 받은' : filter === 'unread' ? '읽지 않은' : ''
        return { result: `${label} 메일이 없습니다.` }
      }

      const list = filtered.map((m: any, i: number) => {
        const date = new Date(m.receivedAt)
        const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`
        const senderName = m.fromText?.match(/^([가-힣]+)/)?.[1] || '알 수 없음'
        // 본문 앞부분을 요약으로 포함 (AI가 내용 파악 가능하도록)
        const bodyPreview = m.body ? m.body.replace(/\n+/g, ' ').slice(0, 120).trim() + (m.body.length > 120 ? '…' : '') : ''
        return `${i + 1}. [${senderName}] ${m.subject} (${dateStr})${bodyPreview ? `\n   내용: ${bodyPreview}` : ''}`
      }).join('\n')

      const label = filter === 'today' ? '오늘 받은' : filter === 'unread' ? '읽지 않은' : '받은'
      return { result: `${label} 메일 ${filtered.length}건:\n${list}` }
    }

    case 'get_leave_balance': {
      const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]
      const usedLeaves = await db.select().from(leaveRequests)
        .where(and(eq(leaveRequests.userId, userId), gte(leaveRequests.startDate, yearStart)))
        .orderBy(desc(leaveRequests.startDate))

      const usedDays = usedLeaves.reduce((sum, l) => {
        if (l.leaveType === 'half_am' || l.leaveType === 'half_pm') return sum + 0.5
        return sum + 1
      }, 0)

      const emp = ctx.userName ? (await db.select().from(employees).where(eq(employees.name, ctx.userName)).limit(1))[0] : null
      let totalDays = 11
      if (emp?.joinDate) {
        const years = (Date.now() - new Date(emp.joinDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
        if (years >= 1) totalDays = Math.min(15 + Math.floor(years / 2), 25)
      }

      const typeLabels: Record<string, string> = { annual: '연차', half_am: '오전반차', half_pm: '오후반차', sick: '병가', special: '특별휴가' }
      const history = usedLeaves.length > 0
        ? '\n\n사용 내역:\n' + usedLeaves.map((l, i) => `${i + 1}. ${l.startDate} ${typeLabels[l.leaveType] ?? l.leaveType} (${l.status === 'approved' ? '승인' : l.status === 'pending' ? '대기중' : l.status})`).join('\n')
        : ''

      return { result: `${ctx.userName}님 연차 현황:\n• 총 연차: ${totalDays}일\n• 사용: ${usedDays}일\n• 잔여: ${totalDays - usedDays}일${history}` }
    }

    case 'get_expense_history': {
      const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]
      const rows = await db.select().from(expenses)
        .where(and(eq(expenses.userId, userId), gte(expenses.expenseDate, yearStart)))
        .orderBy(desc(expenses.expenseDate))
        .limit(10)

      if (rows.length === 0) return { result: '올해 경비 정산 내역이 없습니다.' }

      const total = rows.reduce((s, e) => s + (e.amount || 0), 0)
      const list = rows.map((e, i) =>
        `${i + 1}. ${e.expenseDate} ${e.title} ${(e.amount || 0).toLocaleString()}원 (${e.status === 'approved' ? '승인' : e.status === 'pending' ? '대기중' : e.status})`
      ).join('\n')
      return { result: `경비 정산 내역:\n${list}\n\n올해 총 ${total.toLocaleString()}원` }
    }

    case 'get_profile': {
      const emp = ctx.userName ? (await db.select().from(employees).where(eq(employees.name, ctx.userName)).limit(1))[0] : null
      if (!emp) return { result: '프로필 정보를 찾을 수 없습니다.' }
      return {
        result: `${ctx.userName}님 프로필:\n• 소속: ${emp.division ?? '-'}${emp.team ? ` > ${emp.team}` : ''}\n• 직급: ${emp.rank ?? '-'}${emp.position && emp.position !== '-' ? ` (${emp.position})` : ''}\n• 이메일: ${emp.email ?? '-'}\n• 내선번호: ${emp.phone ?? '-'}\n• 입사일: ${emp.joinDate ?? '-'}\n• 사번: ${emp.employeeId}`,
      }
    }

    case 'get_schedule': {
      const { date, month, companyOnly } = args
      const dayNames = ['일', '월', '화', '수', '목', '금', '토']

      // 월간 조회
      if (month) {
        const [y, m] = month.split('-').map(Number)
        const startDate = `${month}-01`
        const endDate = `${month}-${new Date(y, m, 0).getDate()}`
        const conditions = [eq(calendarEvents.userId, userId), gte(calendarEvents.eventDate, startDate), lte(calendarEvents.eventDate, endDate)]
        if (companyOnly) conditions.push(eq(calendarEvents.isCompany, true))
        const events = await db.select().from(calendarEvents)
          .where(and(...conditions))
          .orderBy(asc(calendarEvents.eventDate), asc(calendarEvents.startTime))
        if (events.length === 0) return { result: `${y}년 ${m}월${companyOnly ? ' 전사' : ''} 일정이 없습니다.` }
        const list = events.map((e: any, i: number) => `${i + 1}. ${e.eventDate} ${e.startTime}${e.endTime ? `~${e.endTime}` : ''} ${e.title}${e.location ? ` (${e.location})` : ''}`).join('\n')
        return { result: `${y}년 ${m}월${companyOnly ? ' 전사' : ''} 일정 ${events.length}건:\n${list}` }
      }

      // 특정 날짜 조회
      const targetDate = date || new Date().toISOString().split('T')[0]
      const targetDay = new Date(targetDate)
      const dayName = dayNames[targetDay.getDay()]
      const isToday = targetDate === new Date().toISOString().split('T')[0]
      const dateLabel = isToday ? `오늘(${dayName}요일)` : `${targetDate}(${dayName}요일)`

      const conditions = [eq(calendarEvents.userId, userId), eq(calendarEvents.eventDate, targetDate)]
      if (companyOnly) conditions.push(eq(calendarEvents.isCompany, true))
      const events = await db.select().from(calendarEvents)
        .where(and(...conditions))
        .orderBy(asc(calendarEvents.startTime))
      if (events.length === 0) return { result: `${dateLabel}에${companyOnly ? ' 전사' : ''} 등록된 일정이 없습니다.` }
      const list = events.map((e: any, i: number) => `${i + 1}. ${e.startTime}${e.endTime ? `~${e.endTime}` : ''} ${e.title} (${e.location || '장소 미정'})`).join('\n')
      return { result: `${dateLabel}${companyOnly ? ' 전사' : ''} 일정 ${events.length}건:\n${list}` }
    }

    case 'get_documents': {
      const cat = (args.category || '').trim()
      const kw = (args.keyword || '').trim()
      const statusFilter = (args.status || '').trim()
      let q = db.select().from(documents).orderBy(desc(documents.submittedAt)).limit(10)
      if (cat) q = q.where(eq(documents.category, cat)) as typeof q
      if (statusFilter) q = q.where(eq(documents.status, statusFilter)) as typeof q
      if (kw) q = q.where(or(ilike(documents.title, `%${kw}%`), ilike(documents.content, `%${kw}%`), ilike(documents.author, `%${kw}%`))) as typeof q
      const rows = await q
      if (rows.length === 0) return { result: '해당하는 보고서/기안 문서가 없습니다.' }
      const statusLabels: Record<string, string> = { draft: '임시저장', submitted: '제출됨', approved: '승인', rejected: '반려' }
      const list = rows.map((d, i) => `${i + 1}. [${d.category}] ${d.title} — ${d.author} (${statusLabels[d.status] ?? d.status}, ${d.submittedAt ? new Date(d.submittedAt).toLocaleDateString('ko-KR') : ''})`).join('\n')
      // 보고서 내용도 포함 (양식 참고용)
      const details = rows.map(d => `### ${d.title} (${d.author})\n${d.content.substring(0, 500)}...`).join('\n\n')
      return { result: `결재함 보고서 ${rows.length}건:\n${list}\n\n--- 상세 내용 ---\n${details}` }
    }

    case 'get_notices': {
      const rows = await db.select().from(notices).orderBy(desc(notices.createdAt)).limit(5)
      if (rows.length === 0) return { result: '공지사항이 없습니다.' }
      const list = rows.map((n, i) => `${i + 1}. [${n.category}] ${n.title} (${new Date(n.createdAt).toLocaleDateString('ko-KR')})`).join('\n')
      return { result: `최근 공지사항:\n${list}` }
    }

    case 'get_assignments': {
      const rows = await db.select().from(assignments)
        .where(or(eq(assignments.assignedTo, userId), eq(assignments.createdBy, userId)))
        .orderBy(desc(assignments.createdAt))
        .limit(5)
      if (rows.length === 0) return { result: '등록된 과제가 없습니다.' }
      const statusLabels: Record<string, string> = { pending: '시작 전', submitted: '제출됨', completed: '완료' }
      const list = rows.map((a, i) => `${i + 1}. ${a.title} (${statusLabels[a.status] ?? a.status})${a.dueDate ? ` — 마감: ${a.dueDate}` : ''}`).join('\n')
      return { result: `과제 목록:\n${list}` }
    }

    case 'check_leave_status': {
      const checkName = (args.name || '').trim()
      if (!checkName) return { result: '직원 이름을 입력해 주세요.' }

      const todayStr = new Date().toISOString().split('T')[0]
      const typeLabels: Record<string, string> = { annual: '연차', half_am: '오전반차', half_pm: '오후반차', sick: '병가', special: '특별휴가' }

      // "우리팀", "우리 팀", "팀원" 등 팀 전체 조회
      const teamKeywords = ['우리팀', '우리 팀', '저희팀', '저희 팀', '내 팀', '내팀', '소속팀', '소속 팀', '팀원', '우리부서', '우리 부서', '저희부서', '저희 부서', '같은팀', '같은 팀', 'my team', '우리']
      if (teamKeywords.some(kw => checkName.includes(kw))) {
        const myTeam = ctx.userTeam
        if (!myTeam) return { result: '소속 팀 정보를 확인할 수 없습니다.' }

        // 같은 팀 직원 목록
        const teamMembers = await db.select().from(employees).where(eq(employees.team, myTeam))
        const onLeave: string[] = []

        for (const member of teamMembers) {
          const memberUser = (await db.select().from(users).where(eq(users.name, member.name)).limit(1))[0]
          if (!memberUser) continue
          const leave = await db.select().from(leaveRequests)
            .where(and(
              eq(leaveRequests.userId, memberUser.id),
              lte(leaveRequests.startDate, todayStr),
              gte(leaveRequests.endDate, todayStr),
            ))
            .limit(1)
          if (leave.length > 0) {
            const l = leave[0] as any
            const leaveLabel = typeLabels[l.leaveType] || l.leaveType
            onLeave.push(`${member.name} ${member.rank || ''} — ${leaveLabel} (${l.startDate}~${l.endDate})`)
          }
        }

        if (onLeave.length === 0) return { result: `${myTeam} 팀원 중 오늘 휴가인 사람은 없습니다.` }
        return { result: `${myTeam} 오늘 휴가 현황 (${onLeave.length}명):\n${onLeave.map((s, i) => `${i + 1}. ${s}`).join('\n')}` }
      }

      // 개인 검색 (기존 로직)
      let target = (await db.select().from(employees).where(eq(employees.name, checkName)).limit(1))[0]
      if (!target) {
        target = (await db.select().from(employees).where(ilike(employees.name, `%${checkName}%`)).orderBy(sql`LENGTH(name)`).limit(1))[0]
      }
      if (!target) return { result: `"${checkName}" 직원을 찾을 수 없습니다.` }

      const targetUser = (await db.select().from(users).where(eq(users.name, target.name)).limit(1))[0]

      if (targetUser) {
        const todayLeave = await db.select().from(leaveRequests)
          .where(and(
            eq(leaveRequests.userId, targetUser.id),
            lte(leaveRequests.startDate, todayStr),
            gte(leaveRequests.endDate, todayStr),
          ))
          .limit(1)

        if (todayLeave.length > 0) {
          const l = todayLeave[0] as any
          const leaveLabel = typeLabels[l.leaveType] || l.leaveType
          const statusLabel = l.status === 'approved' ? '승인' : l.status === 'pending' ? '승인 대기중' : l.status
          return { result: `${target.name} ${target.rank || ''}님은 오늘 ${leaveLabel} 중입니다. (${statusLabel}, ${l.startDate}~${l.endDate})` }
        }
      }

      return { result: `${target.name} ${target.rank || ''}님은 오늘 휴가가 아닙니다. (${target.team || ''} 소속)` }
    }

    case 'find_substitute': {
      const targetName = (args.name || '').trim()
      if (!targetName) return { result: '직원 이름을 입력해 주세요.' }

      // 정확 매칭 우선, 없으면 ILIKE (이름 짧은 것 우선 = 더 정확)
      let target = (await db.select().from(employees).where(eq(employees.name, targetName)).limit(1))[0]
      if (!target) {
        target = (await db.select().from(employees).where(ilike(employees.name, `%${targetName}%`))
          .orderBy(sql`LENGTH(name)`)
          .limit(1))[0]
      }
      if (!target) return { result: `"${targetName}" 직원을 찾을 수 없습니다.` }

      const targetTeam = target.team
      if (!targetTeam) return { result: `${target.name}님의 팀 정보가 없어 대리인을 찾을 수 없습니다.` }

      // 같은 팀에서 본인 제외, rank_levels JOIN으로 정렬
      const teammates = await db.execute(
        sql`SELECT e.* FROM employees e
            LEFT JOIN rank_levels r ON e.rank = r.rank
            WHERE e.team = ${targetTeam} AND e.name != ${target.name}
            ORDER BY COALESCE(r.level, 99)
            LIMIT 5`
      )
      const teammateRows = (teammates as any).rows || teammates

      if (teammateRows.length === 0) return { result: `${target.name}님과 같은 팀(${targetTeam})에 다른 팀원이 없습니다.` }

      const sub = teammateRows[0] as any
      const otherMembers = teammateRows.slice(1, 3).map((t: any) => `${t.name} ${t.rank || ''}`).join(', ')

      return {
        result: `${target.name} ${target.rank || ''}님(${targetTeam}) 부재 시 대리인:\n\n• **${sub.name}** ${sub.rank || ''}${sub.position && sub.position !== '-' ? ` (${sub.position})` : ''}\n  이메일: ${sub.email || '-'}\n  내선: ${sub.phone || '-'}\n  담당: ${sub.duty || '-'}${otherMembers ? `\n\n같은 팀 기타 팀원: ${otherMembers}` : ''}`,
      }
    }

    case 'search_employees': {
      const { name, department, topic, phone, rank: searchRank, count: countOnly } = args

      // 전체 직원 수 조회
      if (countOnly) {
        const countResult = await db.execute(sql`SELECT count(*) as cnt FROM employees`)
        const cnt = (countResult as any).rows?.[0]?.cnt || (countResult as any)[0]?.cnt || 0
        return { result: `키움증권 전체 임직원 수: ${cnt}명` }
      }

      if (phone) {
        const rows = await db.select().from(employees).where(ilike(employees.phone, `%${phone}%`)).limit(5)
        if (rows.length === 0) return { result: `"${phone}" 번호를 가진 직원을 찾지 못했습니다.` }
        return { result: formatEmployeeResults(rows, ctx) }
      }

      // 직급 검색 (팀장/본부장은 position 필드에서 검색)
      // department와 함께 있으면 아래 조건 조합으로 처리
      if (searchRank && !department) {
        let rows
        if (searchRank === '팀장' || searchRank === '본부장') {
          rows = await db.select().from(employees).where(eq(employees.position, searchRank)).limit(10)
        } else {
          rows = await db.select().from(employees).where(eq(employees.rank, searchRank)).limit(10)
        }
        if (rows.length === 0) return { result: `"${searchRank}" 직급의 직원을 찾지 못했습니다.` }
        return { result: `${searchRank} 직급 직원 ${rows.length}명:\n\n${formatEmployeeResults(rows, ctx)}` }
      }

      const conditions: any[] = []
      if (name) conditions.push(ilike(employees.name, `%${name}%`))
      if (department) {
        // department에서 직급/직책 키워드 제거하고 순수 부서명만 추출
        const deptClean = department.replace(/\s*(팀장|본부장|사장|부사장|전무|상무|이사|부장|차장|과장|대리|주임|사원)\s*/g, '').trim()
        if (deptClean) {
          conditions.push(or(ilike(employees.team, `%${deptClean}%`), ilike(employees.division, `%${deptClean}%`)))
        }
      }
      if (topic) conditions.push(or(ilike(employees.duty, `%${topic}%`), ilike(employees.team, `%${topic}%`)))
      if (searchRank && department) {
        if (searchRank === '팀장' || searchRank === '본부장') {
          conditions.push(eq(employees.position, searchRank))
        } else {
          conditions.push(eq(employees.rank, searchRank))
        }
      }

      if (conditions.length === 0) return { result: '검색할 이름, 부서, 또는 업무 키워드를 알려주세요.' }

      // department+rank 조합이면 AND, 이름 포함 다중 조건도 AND, 나머지(topic 등 단독 OR)는 OR
      const useAnd = (name && conditions.length > 1) || (department && searchRank)
      const whereClause = useAnd ? and(...conditions) : conditions.length > 1 ? or(...conditions) : conditions[0]
      let rows = await db.select().from(employees).where(whereClause)
        .orderBy(sql`CASE WHEN position IS NOT NULL AND position != '-' THEN 0 ELSE 1 END`)
        .limit(10)

      // AND 실패 시 이름만으로 재시도
      if (rows.length === 0 && name && conditions.length > 1) {
        rows = await db.select().from(employees).where(ilike(employees.name, `%${name}%`)).limit(5)
      }

      if (rows.length === 0) return { result: `관련 직원을 찾지 못했습니다.` }
      return { result: formatEmployeeResults(rows, ctx) }
    }

    case 'list_departments': {
      const division = args.division || ''
      if (division) {
        const teams = await db.selectDistinct({ team: employees.team })
          .from(employees)
          .where(ilike(employees.division, `%${division}%`))
          .orderBy(employees.team)
        const teamList = teams.map((t: any) => t.team).filter((t: string) => t && t !== '-')
        if (teamList.length === 0) return { result: `"${division}" 관련 부서를 찾지 못했습니다.` }
        const divRow = await db.selectDistinct({ division: employees.division }).from(employees).where(ilike(employees.division, `%${division}%`)).limit(1)
        const divName = (divRow[0] as any)?.division || division
        return { result: `${divName} 팀 목록:\n${teamList.map(t => `• ${t}`).join('\n')}` }
      }
      const divisions = await db.selectDistinct({ division: employees.division })
        .from(employees)
        .where(sql`division IS NOT NULL AND division != '' AND division != '-'`)
        .orderBy(employees.division)
      const divList = divisions.map((d: any) => d.division).filter(Boolean)
      return { result: `키움증권 부문 목록:\n${divList.map(d => `• ${d}`).join('\n')}` }
    }

    case 'start_survey': {
      const quarter = args.quarter ?? 0
      const questions = (await db.select().from(surveyQuestions).where(eq(surveyQuestions.quarter, quarter)))[0]
      if (!questions) return { result: `${quarter}분기 설문을 찾을 수 없습니다.` }

      // 이미 진행 중이거나 완료된 설문 확인
      const existing = await db.select().from(surveyResponses)
        .where(and(eq(surveyResponses.userId, userId), eq(surveyResponses.quarter, quarter)))
        .limit(1)

      let responseId: string
      if (existing.length && existing[0].status === 'completed') {
        return { result: `이미 ${questions.quarterLabel} 설문을 완료하셨어요!` }
      } else if (existing.length) {
        responseId = existing[0].id
        // 진행 중인 설문 이어서
      } else {
        const inserted = await db.insert(surveyResponses).values({
          userId,
          quarter,
          status: 'in_progress',
          currentStep: 1,
          startedAt: new Date(),
        }).returning()
        responseId = inserted[0].id
      }

      return {
        result: `설문이 시작되었습니다.\n\n설문 ID: ${responseId}\n분기: ${questions.quarterLabel}\n단계: ${questions.stageName}\n목표: ${questions.goal}\n\n첫 번째 질문:\nQ1. ${questions.q1}\n(1: 전혀 아니다 ~ 5: 매우 그렇다)`,
      }
    }

    case 'submit_survey_answer': {
      const { surveyId, step, answer } = args
      if (!surveyId) return { result: '설문 ID가 필요합니다.' }

      const response = (await db.select().from(surveyResponses).where(eq(surveyResponses.id, surveyId)))[0]
      if (!response) return { result: '설문을 찾을 수 없습니다.' }

      const questions = (await db.select().from(surveyQuestions).where(eq(surveyQuestions.quarter, response.quarter)))[0]
      if (!questions) return { result: '설문 질문을 찾을 수 없습니다.' }

      const score = parseInt(answer)

      if (step === 1) {
        await db.update(surveyResponses).set({ q1Score: isNaN(score) ? null : score, currentStep: 2 }).where(eq(surveyResponses.id, surveyId))
        return { result: `Q1 답변 저장 완료 (${answer})\n\n다음 질문:\nQ2. ${questions.q2}\n(1: 전혀 아니다 ~ 5: 매우 그렇다)` }
      } else if (step === 2) {
        await db.update(surveyResponses).set({ q2Score: isNaN(score) ? null : score, currentStep: 3 }).where(eq(surveyResponses.id, surveyId))
        return { result: `Q2 답변 저장 완료 (${answer})\n\n다음 질문:\nQ3. ${questions.q3}\n(1: 전혀 아니다 ~ 5: 매우 그렇다)` }
      } else if (step === 3) {
        await db.update(surveyResponses).set({ q3Score: isNaN(score) ? null : score, currentStep: 4 }).where(eq(surveyResponses.id, surveyId))
        return { result: `Q3 답변 저장 완료 (${answer})\n\n마지막 질문이에요!\n${questions.freeQuestion}` }
      } else if (step === 4) {
        // 주관식 저장 + 완료 처리
        await db.update(surveyResponses).set({
          freeAnswer: answer,
          currentStep: 5,
          status: 'completed',
          completedAt: new Date(),
        }).where(eq(surveyResponses.id, surveyId))

        // LLM 분석 + HR 메일은 __SURVEY_COMPLETE__ 시그널로 백엔드에서 후처리
        return { result: `__SURVEY_COMPLETE__:${surveyId}` }
      }

      return { result: '잘못된 질문 번호입니다.' }
    }

    case 'add_calendar_event': {
      let { title, eventDate, startTime, endTime, location } = args
      if (!title || !eventDate || !startTime) {
        return { result: '일정 제목, 날짜, 시작 시간이 필요합니다.' }
      }
      // 연도 보정: 과거 연도면 올해로 수정
      const currentYear = new Date().getFullYear()
      if (eventDate && parseInt(eventDate.split('-')[0]) < currentYear) {
        eventDate = `${currentYear}-${eventDate.split('-').slice(1).join('-')}`
      }
      await db.insert(calendarEvents).values({
        userId,
        title,
        eventDate,
        startTime,
        endTime: endTime || '',
        location: location || '',
        color: '#3B82F6',
      })
      const dateStr = `${eventDate} ${startTime}${endTime ? `~${endTime}` : ''}`
      return { result: `"${title}" 일정이 ${dateStr}에 캘린더에 추가되었습니다.${location ? ` (장소: ${location})` : ''}` }
    }

    case 'delete_calendar_event': {
      const { eventDate, title: eventTitle, index } = args
      if (!eventDate) return { result: '삭제할 일정의 날짜를 알려주세요.' }

      // 해당 날짜의 내 일정 조회
      const events = await db.select().from(calendarEvents)
        .where(and(eq(calendarEvents.userId, userId), eq(calendarEvents.eventDate, eventDate)))
        .orderBy(asc(calendarEvents.startTime))

      if (events.length === 0) return { result: `${eventDate}에 등록된 일정이 없습니다.` }

      // 삭제 대상 결정
      let target: any = null
      if (eventTitle) {
        target = events.find((e: any) => e.title === eventTitle || e.title.includes(eventTitle))
      }
      if (!target && index && index >= 1 && index <= events.length) {
        target = events[index - 1]
      }
      if (!target && events.length === 1) {
        target = events[0]
      }

      if (!target) {
        const list = events.map((e: any, i: number) => `${i + 1}. ${e.startTime}${e.endTime ? `~${e.endTime}` : ''} ${e.title}`).join('\n')
        return { result: `${eventDate}에 일정이 ${events.length}건 있습니다. 어떤 일정을 삭제할까요?\n${list}` }
      }

      await db.delete(calendarEvents).where(eq(calendarEvents.id, target.id))
      return { result: `"${target.title}" (${eventDate} ${target.startTime}) 일정이 삭제되었습니다.` }
    }

    case 'submit_leave': {
      const { leaveType, startDate, endDate, reason } = args
      const typeLabels: Record<string, string> = { annual: '연차', half_am: '오전반차', half_pm: '오후반차', sick: '병가', special: '특별휴가' }
      const label = typeLabels[leaveType] || '연차'
      const dateStr = endDate && endDate !== startDate ? `${startDate} ~ ${endDate}` : startDate
      return {
        result: `${dateStr} ${label} 신청을 준비했습니다. 확인 버튼을 눌러주세요.`,
        agentAction: {
          action: 'leave',
          params: { leaveType, startDate, endDate: endDate || startDate, reason: reason || '' },
          confirmationMessage: `${dateStr} ${label}를 신청할까요?`,
        },
      }
    }

    case 'submit_expense': {
      const { title, category, amount, expenseDate, description } = args
      const catLabels: Record<string, string> = { taxi: '업무 택시', meal: '업무 식대', supplies: '사무용품', travel: '출장 경비', etc: '기타' }
      return {
        result: `${catLabels[category] || title} ${amount?.toLocaleString()}원 정산 신청을 준비했습니다.`,
        agentAction: {
          action: 'expense',
          params: { title, category, amount, expenseDate: expenseDate || new Date().toISOString().split('T')[0], description: description || '' },
          confirmationMessage: `${catLabels[category] || title} ${amount?.toLocaleString()}원을 정산 신청할까요?`,
        },
      }
    }

    case 'check_room_availability': {
      const checkDate = args.date || new Date().toISOString().split('T')[0]
      const roomName = (args.roomName || '').trim()

      // 전체 회의실 목록
      const allRooms = await db.select().from(meetingRooms).orderBy(asc(meetingRooms.name))

      // 해당 날짜 예약 현황
      const reservations = await db.select({
        roomId: roomReservations.roomId,
        roomName: meetingRooms.name,
        startTime: roomReservations.startTime,
        endTime: roomReservations.endTime,
        title: roomReservations.title,
        userName: users.name,
      })
        .from(roomReservations)
        .innerJoin(meetingRooms, eq(roomReservations.roomId, meetingRooms.id))
        .innerJoin(users, eq(roomReservations.userId, users.id))
        .where(eq(roomReservations.reserveDate, checkDate))
        .orderBy(asc(meetingRooms.name), asc(roomReservations.startTime))

      if (roomName) {
        // 특정 회의실
        const room = allRooms.find((r: any) => r.name.includes(roomName))
        if (!room) return { result: `"${roomName}" 회의실을 찾을 수 없습니다. 등록된 회의실: ${allRooms.map((r: any) => r.name).join(', ')}` }
        const roomRes = reservations.filter((r: any) => r.roomName === room.name)
        if (roomRes.length === 0) return { result: `${checkDate} ${room.name} (${room.floor}, ${room.capacity}명)은 종일 비어있습니다.` }
        const list = roomRes.map((r: any) => `• ${r.startTime}~${r.endTime} ${r.title} (${r.userName})`).join('\n')
        return { result: `${checkDate} ${room.name} 예약 현황:\n${list}` }
      }

      // 전체 회의실
      const lines = allRooms.map((room: any) => {
        const roomRes = reservations.filter((r: any) => r.roomName === room.name)
        if (roomRes.length === 0) return `• ${room.name} (${room.floor}, ${room.capacity}명) — 비어있음`
        const slots = roomRes.map((r: any) => `${r.startTime}~${r.endTime}`).join(', ')
        return `• ${room.name} (${room.floor}, ${room.capacity}명) — 예약: ${slots}`
      }).join('\n')
      return { result: `${checkDate} 회의실 현황:\n${lines}` }
    }

    case 'book_room': {
      const { roomName: bookRoomName, date: bookDate, startTime: bookStart, endTime: bookEnd, title: bookTitle, attendees: bookAttendees } = args
      if (!bookRoomName || !bookDate || !bookStart || !bookEnd || !bookTitle) {
        return { result: '회의실 이름, 날짜, 시작/종료 시간, 회의 제목이 필요합니다.' }
      }

      // 연도 보정
      let fixedDate = bookDate
      const currentYear = new Date().getFullYear()
      if (parseInt(fixedDate.split('-')[0]) < currentYear) {
        fixedDate = `${currentYear}-${fixedDate.split('-').slice(1).join('-')}`
      }

      // 회의실 찾기 (공백 무시 매칭)
      const allRooms = await db.select().from(meetingRooms)
      const normalizedInput = bookRoomName.replace(/\s/g, '')
      const room = allRooms.find((r: any) => r.name.replace(/\s/g, '').includes(normalizedInput) || normalizedInput.includes(r.name.replace(/\s/g, '')))
      if (!room) return { result: `"${bookRoomName}" 회의실을 찾을 수 없습니다. 등록된 회의실: ${allRooms.map((r: any) => r.name).join(', ')}` }

      // 충돌 검사
      const existing = await db.select().from(roomReservations)
        .where(and(eq(roomReservations.roomId, room.id), eq(roomReservations.reserveDate, fixedDate)))
      const conflict = existing.some((r: any) => bookStart < r.endTime && bookEnd > r.startTime)
      if (conflict) {
        const slots = existing.map((r: any) => `${r.startTime}~${r.endTime}`).join(', ')
        return { result: `${room.name}은 ${fixedDate} ${bookStart}~${bookEnd}에 이미 예약이 있습니다. 기존 예약: ${slots}` }
      }

      // 예약 생성
      await db.insert(roomReservations).values({
        roomId: room.id, userId, title: bookTitle,
        reserveDate: fixedDate, startTime: bookStart, endTime: bookEnd,
        attendees: bookAttendees || '',
      })
      return { result: `회의실 예약이 완료되었습니다.\n• 회의실: ${room.name} (${room.floor}, ${room.capacity}명)\n• 날짜: ${fixedDate}\n• 시간: ${bookStart}~${bookEnd}\n• 회의: ${bookTitle}` }
    }

    case 'draft_email': {
      const { recipient, cc, subject, details, senderDept } = args
      if (!subject || !details) return { result: '메일 용건과 포함할 내용을 알려주세요.' }

      const EMAIL_GUIDE = `[메일 작성 가이드라인]
당신은 키움증권의 커뮤니케이션 지원 AI입니다. 아래 규칙에 따라 격식 있는 비즈니스 이메일을 작성하세요.

[기본 원칙]
- 극도로 정중한 경어체 사용
- 구조: 제목 → 수신/참조 → 인사말 → 핵심 내용(불렛) → 요청/맺음말 → 서명
- 금기: 농담, 구어체, 이모지 금지

[부서별 특화]
- IB/기업금융: "본 메일은 대외비(Confidential) 자료를 포함합니다." 필수
- 리서치/운용: 수치 강조 + 표준 Disclaimer 삽입
- 리스크/컴플라이언스: 관련 법령 언급, 지시형 정중체

[데이터 검증]
- 일정: 날짜, 시간, 장소 필수
- 금융: 금액, 비율, 수량 필수
- 누락 시 메일 작성하지 말고 필요 항목만 리스트로 질의

[메일 구조]
- 제목: [키움증권] [부서명] 용건 핵심 요약
- 수신/참조: [수신: ○○ 귀하 / 참조: △△ 귀하]
- 서명: 키움증권 [부서명] [이름] [직함] / T. 내선번호 | E. 이메일`

      // 유저 프로필 정보 (이메일/내선번호 포함)
      const dept = senderDept || ctx.userTeam || ctx.userDivision || ''
      const senderInfo = `발신자: ${ctx.userName || ''} (${dept})\n이메일: ${ctx.userEmail || ''}\n내선번호: ${ctx.userPhone || ''}`

      const prompt = `${EMAIL_GUIDE}\n\n${senderInfo}\n수신자: ${recipient || '(미지정)'}\n${cc ? `참조: ${cc}\n` : ''}용건: ${subject}\n상세 내용: ${details}`

      // AI에 메일 초안 요청
      const AI_URL = process.env.AI_SERVICE_URL ?? 'http://localhost:8001'
      try {
        const res = await fetch(`${AI_URL}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: prompt, mode: 'rag' }),
        })
        if (res.ok) {
          const body = await res.json() as any
          return { result: body.answer || '메일 초안 생성에 실패했습니다.' }
        }
      } catch {}
      return { result: '메일 작성 중 오류가 발생했습니다.' }
    }

    case 'search_glossary': {
      const searchTerm = (args.term || '').trim()
      if (!searchTerm) return { result: '검색할 용어를 입력해 주세요.' }
      // 정확한 매칭 우선, 부분 매칭 fallback
      let glossaryResults = await db.execute(sql`SELECT term, description FROM glossary WHERE term ILIKE ${searchTerm} LIMIT 3`)
      let glossaryRows = (glossaryResults as any).rows || glossaryResults
      if (glossaryRows.length === 0) {
        // 부분 매칭 (약어 포함 검색)
        glossaryResults = await db.execute(sql`SELECT term, description FROM glossary WHERE term ILIKE ${'%' + searchTerm + '%'} OR description ILIKE ${'%' + searchTerm + '%'} LIMIT 3`)
        glossaryRows = (glossaryResults as any).rows || glossaryResults
      }
      if (glossaryRows.length > 0) {
        const glossaryList = glossaryRows.map((r: any, i: number) => `${i + 1}. **${r.term}**\n${r.description.slice(0, 400)}`).join('\n\n')
        return { result: `금융 용어 검색 결과:\n\n${glossaryList}` }
      }
      return { result: `__GLOSSARY_SEARCH__:${searchTerm}` }
    }

    case 'search_documents': {
      return { result: `__SEARCH_DOCS__:${args.query}` }
    }

    case 'query_db': {
      const question = (args.question || '').trim()
      if (!question) return { result: '질문을 입력해 주세요.' }

      try {
        const aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:8001'
        // 1. AI 서비스에서 SQL 생성
        const genRes = await fetch(`${aiUrl}/datahub/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question, user_id: userId }),
        })
        const genBody = await genRes.json() as { sql: string; explanation: string; safe: boolean; error?: string }

        if (!genBody.safe || !genBody.sql) {
          return { result: genBody.error || '이 질문에 대한 SQL을 생성할 수 없습니다.' }
        }

        // 2. 백엔드에서 SQL 실행
        const { pool } = await import('../db')
        const result = await pool.query(genBody.sql)
        const rows = result.rows.slice(0, 20)

        if (rows.length === 0) {
          return { result: `${genBody.explanation}\n\n조회 결과가 없습니다.` }
        }

        // 결과 포맷팅
        const fields = result.fields.map(f => f.name)
        const formatted = rows.map((row, i) => {
          const vals = fields.map(f => `${f}: ${row[f] ?? '-'}`).join(', ')
          return `${i + 1}. ${vals}`
        }).join('\n')

        return { result: `${genBody.explanation}\n\n${formatted}` }
      } catch (err: any) {
        return { result: `DB 조회 중 오류가 발생했습니다: ${err.message}` }
      }
    }

    default:
      return { result: `알 수 없는 도구: ${toolName}` }
  }
}

function formatEmployeeResults(rows: any[], _ctx: ToolContext): string {
  const total = rows.length
  const display = rows.slice(0, 10)
  const result = display.map((e, i) => {
    if (EXEC_RANKS.includes(e.rank)) {
      return `${i + 1}. ${e.name} ${e.rank}${e.position && e.position !== '-' ? ` (${e.position})` : ''}\n   ※ 임원 연락은 비서실(내선 1000)을 통해 문의해 주세요.`
    }
    const base = `${i + 1}. ${e.name} ${e.rank ?? ''}${e.position && e.position !== '-' ? ` (${e.position})` : ''}\n   ${e.division ?? ''}${e.team ? ` > ${e.team}` : ''}\n   이메일: ${e.email ?? '-'}\n   내선: ${e.phone ?? '-'}\n   담당: ${e.duty ?? '-'}`
    return base
  }).join('\n\n')
  if (total > 10) {
    return `총 ${total}명 중 10명 표시:\n\n${result}\n\n... 외 ${total - 10}명`
  }
  return total > 1 ? `총 ${total}명:\n\n${result}` : result
}
