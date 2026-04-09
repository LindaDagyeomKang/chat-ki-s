/**
 * Function Calling 도구 실행기
 * LLM이 요청한 함수를 실행하고 결과를 반환합니다.
 */
import { db } from '../db'
import { employees, users, mails, notices, leaveRequests, expenses, assignments, calendarEvents, surveyQuestions, surveyResponses } from '../db/schema'
import { eq, desc, asc, and, gte, lte, or, ilike, sql } from 'drizzle-orm'

const EXEC_RANKS = ['사장', '부사장', '전무', '상무', '이사']

interface ToolContext {
  userId: string
  userName: string | null
  userDivision: string | null
  userRank: string | null
  userTeam: string | null
}

async function getUserContext(userId: string): Promise<ToolContext> {
  const user = (await db.select().from(users).where(eq(users.id, userId)))[0]
  let division: string | null = null
  let rank: string | null = null
  let team: string | null = null
  if (user) {
    const emp = (await db.select().from(employees).where(eq(employees.name, user.name)).limit(1))[0]
    if (emp) {
      division = emp.division
      rank = emp.rank
      team = emp.team
    }
  }
  return { userId, userName: user?.name || null, userDivision: division, userRank: rank, userTeam: team }
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

      let query = db.select().from(mails).where(eq(mails.toId, userId))

      const conditions: any[] = [eq(mails.toId, userId)]

      if (filter === 'today') {
        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)
        conditions.push(gte(mails.createdAt, todayStart))
      } else if (filter === 'unread') {
        conditions.push(eq(mails.isRead, false))
      }

      const rows = await db.select().from(mails)
        .where(and(...conditions))
        .orderBy(desc(mails.createdAt))
        .limit(10)

      // 발신자/키워드 필터 (from_text에서)
      let filtered = rows
      if (sender) {
        filtered = filtered.filter((m: any) => m.fromText?.includes(sender))
      }
      if (keyword) {
        filtered = filtered.filter((m: any) => m.subject?.includes(keyword) || m.body?.includes(keyword))
      }

      if (filtered.length === 0) {
        // 오늘 메일 없으면 최근 메일로 fallback
        if (filter === 'today') {
          const recent = await db.select().from(mails)
            .where(eq(mails.toId, userId))
            .orderBy(desc(mails.createdAt))
            .limit(5)
          if (recent.length > 0) {
            const list = recent.map((m: any, i: number) => {
              const date = new Date(m.createdAt)
              const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`
              const senderName = m.fromText?.match(/^([가-힣]+)/)?.[1] || '알 수 없음'
              return `${i + 1}. [${senderName}] ${m.subject} (${dateStr})`
            }).join('\n')
            return { result: `오늘 새로 받은 메일은 없습니다. 최근 메일 ${recent.length}건:\n${list}` }
          }
        }
        const label = filter === 'today' ? '오늘 받은' : filter === 'unread' ? '읽지 않은' : ''
        return { result: `${label} 메일이 없습니다.` }
      }

      const list = filtered.map((m: any, i: number) => {
        const date = new Date(m.createdAt)
        const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`
        const senderName = m.fromText?.match(/^([가-힣]+)/)?.[1] || '알 수 없음'
        return `${i + 1}. [${senderName}] ${m.subject} (${dateStr})`
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
      const targetDate = args.date || new Date().toISOString().split('T')[0]
      const targetDay = new Date(targetDate)
      const dayNames = ['일', '월', '화', '수', '목', '금', '토']
      const dayName = dayNames[targetDay.getDay()]
      const isToday = targetDate === new Date().toISOString().split('T')[0]
      const dateLabel = isToday ? `오늘(${dayName}요일)` : `${targetDate}(${dayName}요일)`

      const events = await db.select().from(calendarEvents)
        .where(and(eq(calendarEvents.userId, userId), eq(calendarEvents.eventDate, targetDate)))
        .orderBy(asc(calendarEvents.startTime))
      if (events.length === 0) return { result: `${dateLabel}에 등록된 일정이 없습니다.` }
      const list = events.map((e, i) => `${i + 1}. ${e.startTime}${e.endTime ? `~${e.endTime}` : ''} ${e.title} (${e.location || '장소 미정'})`).join('\n')
      return { result: `${dateLabel} 일정 ${events.length}건:\n${list}` }
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
      const { name, department, topic, phone } = args

      if (phone) {
        const rows = await db.select().from(employees).where(ilike(employees.phone, `%${phone}%`)).limit(5)
        if (rows.length === 0) return { result: `"${phone}" 번호를 가진 직원을 찾지 못했습니다.` }
        return { result: formatEmployeeResults(rows, ctx) }
      }

      const conditions: any[] = []
      if (name) conditions.push(ilike(employees.name, `%${name}%`))
      if (department) conditions.push(or(ilike(employees.team, `%${department}%`), ilike(employees.division, `%${department}%`)))
      if (topic) conditions.push(or(ilike(employees.duty, `%${topic}%`), ilike(employees.team, `%${topic}%`)))

      if (conditions.length === 0) return { result: '검색할 이름, 부서, 또는 업무 키워드를 알려주세요.' }

      const whereClause = name && conditions.length > 1 ? and(...conditions) : conditions.length > 1 ? or(...conditions) : conditions[0]
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

    case 'search_glossary': {
      const searchTerm = (args.term || '').trim()
      if (!searchTerm) return { result: '검색할 용어를 입력해 주세요.' }
      const glossaryResults = await db.execute(sql`SELECT term, description FROM glossary WHERE term ILIKE ${'%' + searchTerm + '%'} LIMIT 3`)
      const glossaryRows = (glossaryResults as any).rows || glossaryResults
      if (glossaryRows.length > 0) {
        const glossaryList = glossaryRows.map((r: any, i: number) => `${i + 1}. **${r.term}**\n${r.description.slice(0, 400)}`).join('\n\n')
        return { result: `금융 용어 검색 결과:\n\n${glossaryList}` }
      }
      return { result: `__GLOSSARY_SEARCH__:${searchTerm}` }
    }

    case 'search_documents': {
      return { result: `__SEARCH_DOCS__:${args.query}` }
    }

    default:
      return { result: `알 수 없는 도구: ${toolName}` }
  }
}

function formatEmployeeResults(rows: any[], ctx: ToolContext): string {
  return rows.slice(0, 5).map((e, i) => {
    if (EXEC_RANKS.includes(e.rank)) {
      return `${i + 1}. ${e.name} ${e.rank}${e.position && e.position !== '-' ? ` (${e.position})` : ''}\n   ※ 임원 연락은 비서실(내선 1000)을 통해 문의해 주세요.`
    }
    const isSame = ctx.userDivision && e.division === ctx.userDivision
    const base = `${i + 1}. ${e.name} ${e.rank ?? ''}${e.position && e.position !== '-' ? ` (${e.position})` : ''}\n   ${e.division ?? ''}${e.team ? ` > ${e.team}` : ''}\n   이메일: ${e.email ?? '-'}`
    if (isSame) {
      return `${base}\n   내선: ${e.phone ?? '-'}\n   담당: ${e.duty ?? '-'}`
    }
    return base
  }).join('\n\n')
}
