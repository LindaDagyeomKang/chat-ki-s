import { FastifyInstance } from 'fastify'
import { eq, and } from 'drizzle-orm'
import { db } from '../db'
import { users, employees } from '../db/schema'
import { sql } from 'drizzle-orm'

export async function chatRoutes(app: FastifyInstance) {
  // GET /api/users/me — portal session check
  app.get(
    '/api/users/me',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const payload = request.user as { sub: string; employeeId: string }

      const result = await db
        .select()
        .from(users)
        .where(eq(users.id, payload.sub))
        .limit(1)

      const user = result[0]
      if (!user) {
        return reply.status(404).send({ error: 'User not found' })
      }

      return reply.send({
        id: user.id,
        employeeId: user.employeeId,
        name: user.name,
        email: user.email,
        department: user.department,
        role: user.role,
        createdAt: user.createdAt,
      })
    }
  )

  // GET /api/users/me/profile — 프로필 상태/담당업무 조회
  app.get('/api/users/me/profile', { onRequest: [app.authenticate] }, async (request, reply) => {
    const payload = request.user as { sub: string }
    const user = (await db.select().from(users).where(eq(users.id, payload.sub)).limit(1))[0]
    if (!user) return reply.status(404).send({ error: 'User not found' })

    const emp = await db.select().from(employees).where(eq(employees.name, user.name)).limit(1)
    const e = emp[0]
    return reply.send({
      status: e?.status ?? '온라인',
      duty: e?.duty ?? '',
      division: e?.division ?? '',
      team: e?.team ?? '',
      rank: e?.rank ?? '',
    })
  })

  // PATCH /api/users/me/profile — 프로필 상태/담당업무 업데이트
  app.patch<{ Body: { status?: string; duty?: string } }>('/api/users/me/profile', {
    onRequest: [app.authenticate],
    schema: {
      body: {
        type: 'object',
        properties: {
          status: { type: 'string', maxLength: 20 },
          duty: { type: 'string', maxLength: 200 },
        },
      },
    },
  }, async (request, reply) => {
    const payload = request.user as { sub: string }
    const user = (await db.select().from(users).where(eq(users.id, payload.sub)).limit(1))[0]
    if (!user) return reply.status(404).send({ error: 'User not found' })

    const emp = await db.select().from(employees).where(eq(employees.name, user.name)).limit(1)
    if (!emp.length) return reply.status(404).send({ error: 'Employee not found' })

    const updates: Record<string, string> = {}
    if (request.body.status !== undefined) updates.status = request.body.status
    if (request.body.duty !== undefined) updates.duty = request.body.duty

    if (Object.keys(updates).length > 0) {
      await db.update(employees).set(updates).where(eq(employees.id, emp[0].id))
    }
    return reply.send({ success: true })
  })

  // GET /api/notifications — 읽지 않은 알림 (설문 등) 반환 + 입사일 기반 자동 생성
  app.get('/api/notifications', { onRequest: [app.authenticate] }, async (request, reply) => {
    const payload = request.user as { sub: string }
    const user = (await db.select().from(users).where(eq(users.id, payload.sub)).limit(1))[0]
    if (!user) return reply.send({ notifications: [], unreadCount: 0 })

    // 입사일 기반 설문 체크
    const emp = (await db.select().from(employees).where(eq(employees.name, user.name)).limit(1))[0]
    if (emp?.joinDate) {
      const joinDate = new Date(emp.joinDate)
      const now = new Date()
      const daysSinceJoin = Math.floor((now.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24))

      // 분기별 트리거 일수: 30일, 60일, 120일, 180일, 365일
      const quarterTriggers = [
        { days: 30, quarter: 0 },
        { days: 60, quarter: 1 },
        { days: 120, quarter: 2 },
        { days: 180, quarter: 3 },
        { days: 365, quarter: 4 },
      ]

      for (const trigger of quarterTriggers) {
        // 해당 분기에 도달했는지 (±7일 여유)
        if (daysSinceJoin >= trigger.days && daysSinceJoin <= trigger.days + 7) {
          // 이미 알림이 있는지 체크
          const existing = await db.execute(
            sql`SELECT id FROM pending_notifications WHERE user_id = ${payload.sub} AND type = 'survey' AND payload->>'quarter' = ${String(trigger.quarter)}`
          )
          if ((existing as any).rows?.length === 0 || (existing as any).length === 0) {
            // 이미 완료한 설문인지도 체크
            const completed = await db.execute(
              sql`SELECT id FROM survey_responses WHERE user_id = ${payload.sub} AND quarter = ${trigger.quarter} AND status = 'completed'`
            )
            if ((completed as any).rows?.length === 0 || (completed as any).length === 0) {
              await db.execute(
                sql`INSERT INTO pending_notifications (user_id, type, payload) VALUES (${payload.sub}, 'survey', ${JSON.stringify({ quarter: trigger.quarter })}::jsonb)`
              )
            }
          }
        }
      }
    }

    // 미전달 알림 가져오기
    const notifications = await db.execute(
      sql`SELECT id, type, payload, created_at FROM pending_notifications WHERE user_id = ${payload.sub} AND delivered = false ORDER BY created_at DESC`
    )
    const rows = (notifications as any).rows || notifications
    return reply.send({
      notifications: rows,
      unreadCount: rows.length,
    })
  })

  // POST /api/notifications/:id/delivered — 알림 전달 완료 처리
  app.post<{ Params: { id: string } }>('/api/notifications/:id/delivered', { onRequest: [app.authenticate] }, async (request) => {
    const { id } = request.params
    await db.execute(sql`UPDATE pending_notifications SET delivered = true WHERE id = ${id}`)
    return { success: true }
  })

  // GET /api/hr/survey-results — 인사팀 전용: 설문 결과 조회
  app.get('/api/hr/survey-results', { onRequest: [app.authenticate] }, async (request, reply) => {
    const payload = request.user as { sub: string }

    // 인사팀 권한 체크
    const user = (await db.select().from(users).where(eq(users.id, payload.sub)).limit(1))[0]
    if (!user) return reply.status(403).send({ error: '접근 권한이 없습니다' })

    const emp = (await db.select().from(employees).where(eq(employees.name, user.name)).limit(1))[0]
    const isHR = emp?.team?.includes('인사') || emp?.division?.includes('재무지원') || user.role === 'mentor'
    if (!isHR) return reply.status(403).send({ error: '인사팀만 조회 가능합니다' })

    // 설문 결과 조회 — 익명 ID (user_id의 앞 8자리) + 부서만 표시
    const { surveyResponses: srTable, surveyQuestions: sqTable } = require('../db/schema')
    const responses = await db.select().from(srTable).where(eq(srTable.status, 'completed')).orderBy(eq(srTable.completedAt, 'desc'))

    const results = []
    for (const r of responses as any[]) {
      const respUser = (await db.select().from(users).where(eq(users.id, r.userId)).limit(1))[0]
      const respEmp = respUser ? (await db.select().from(employees).where(eq(employees.name, respUser.name)).limit(1))[0] : null
      const q = (await db.select().from(sqTable).where(eq(sqTable.quarter, r.quarter)).limit(1))[0]

      // 익명 ID: user_id 앞 8자리 (동일인 추적 가능하되 이름은 비공개)
      const anonymousId = r.userId.substring(0, 8)

      results.push({
        anonymousId,
        department: respEmp?.division || '미상',
        team: respEmp?.team || '미상',
        quarter: r.quarter,
        quarterLabel: q?.quarterLabel || `${r.quarter}분기`,
        q1Score: r.q1Score,
        q2Score: r.q2Score,
        q3Score: r.q3Score,
        average: ((r.q1Score || 0) + (r.q2Score || 0) + (r.q3Score || 0)) / 3,
        freeAnswer: r.freeAnswer,
        analysis: r.analysis,
        completedAt: r.completedAt,
      })
    }

    return reply.send({ results, total: results.length })
  })

  // GET /api/hr/team-events — 같은 팀 사람들의 생일, 연차, 전사 일정
  app.get('/api/hr/team-events', { onRequest: [app.authenticate] }, async (request, reply) => {
    const payload = request.user as { sub: string }
    const user = (await db.select().from(users).where(eq(users.id, payload.sub)).limit(1))[0]
    if (!user) return reply.send([])

    const emp = await db.select().from(employees).where(eq(employees.name, user.name)).limit(1)
    const myTeam = emp[0]?.team || ''

    const events: { type: string; name: string; date: string; detail: string; color: string }[] = []

    if (myTeam) {
      // 같은 팀 사람들 생일
      const teammates = await db.select().from(employees).where(eq(employees.team, myTeam))
      const now = new Date()
      const thisYear = now.getFullYear()

      for (const t of teammates) {
        if (t.birthDate && t.name !== user.name) {
          const bd = new Date(t.birthDate)
          const bday = `${thisYear}-${String(bd.getMonth() + 1).padStart(2, '0')}-${String(bd.getDate()).padStart(2, '0')}`
          events.push({ type: 'birthday', name: t.name, date: bday, detail: '생일', color: '#E1007F' })
        }
      }

      // 같은 팀 사람들 연차 (승인된 것)
      const { leaveRequests: leaveTable } = require('../db/schema')
      for (const t of teammates) {
        if (t.name === user.name) continue
        const tUser = (await db.select().from(users).where(eq(users.name, t.name)).limit(1))[0]
        if (!tUser) continue
        const tLeaves = await db.select().from(leaveTable)
          .where(eq(leaveTable.userId, tUser.id))
          .orderBy(eq(leaveTable.startDate, 'desc'))
        for (const l of tLeaves as any[]) {
          if (l.status === 'approved' || l.status === 'pending') {
            events.push({ type: 'leave', name: t.name, date: l.startDate, detail: l.leaveType === 'annual' ? '연차' : l.leaveType === 'half_am' ? '오전반차' : l.leaveType === 'half_pm' ? '오후반차' : '휴가', color: '#F59E0B' })
          }
        }
      }
    }

    // 전사 일정만: calendar_events에서 is_company = true인 것만
    const { calendarEvents: calTable } = require('../db/schema')
    const calEvents = await db.select().from(calTable)
      .where(and(eq(calTable.userId, payload.sub), eq(calTable.isCompany, true)))
    for (const ce of calEvents as any[]) {
      events.push({ type: 'company', name: '', date: ce.eventDate, detail: ce.title, color: ce.color || '#6366F1' })
    }

    // 날짜순 정렬
    events.sort((a, b) => a.date.localeCompare(b.date))
    return reply.send(events)
  })

}
