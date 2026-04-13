import { FastifyInstance } from 'fastify'
import { db } from '../db'
import { leaveRequests, users, employees } from '../db/schema'
import { and, desc, eq, gte } from 'drizzle-orm'

export async function leaveRoutes(app: FastifyInstance) {
  // 연차 잔여일 조회
  app.get('/api/leaves/balance', { preHandler: [app.authenticate] }, async (request) => {
    const { sub } = request.user as { sub: string }

    const user = (await db.select().from(users).where(eq(users.id, sub)).limit(1))[0]
    const emp = user ? (await db.select().from(employees).where(eq(employees.name, user.name)).limit(1))[0] : null

    // 총 연차 계산 (입사일 기반)
    let totalDays = 11
    if (emp?.joinDate) {
      const years = (Date.now() - new Date(emp.joinDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
      if (years >= 1) totalDays = Math.min(15 + Math.floor(years / 2), 25)
    }

    // 올해 사용 일수
    const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]
    const usedLeaves = await db.select().from(leaveRequests)
      .where(and(eq(leaveRequests.userId, sub), gte(leaveRequests.startDate, yearStart)))

    const usedDays = usedLeaves.reduce((sum, l) => {
      if (l.leaveType === 'half_am' || l.leaveType === 'half_pm') return sum + 0.5
      return sum + 1
    }, 0)

    const approvedDays = usedLeaves.filter(l => l.status === 'approved').reduce((sum, l) => {
      if (l.leaveType === 'half_am' || l.leaveType === 'half_pm') return sum + 0.5
      return sum + 1
    }, 0)

    return { totalDays, usedDays, approvedDays, remainingDays: totalDays - usedDays }
  })

  // 내 연차 목록 조회
  app.get('/api/leaves', { preHandler: [app.authenticate] }, async (request) => {
    const { sub } = request.user as { sub: string }
    const result = await db
      .select()
      .from(leaveRequests)
      .where(eq(leaveRequests.userId, sub))
      .orderBy(desc(leaveRequests.createdAt))
    return result
  })

  // 연차 신청
  app.post<{
    Body: { leaveType: string; startDate: string; endDate: string; reason?: string }
  }>('/api/leaves', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { sub } = request.user as { sub: string }
    const { leaveType, startDate, endDate, reason } = request.body

    if (!leaveType || !startDate || !endDate) {
      return reply.status(400).send({ error: 'leaveType, startDate, endDate 필수' })
    }

    const result = await db.insert(leaveRequests).values({
      userId: sub,
      leaveType,
      startDate,
      endDate,
      reason: reason ?? '',
      status: 'pending',
    }).returning()

    return reply.status(201).send(result[0])
  })

  // 연차 승인/반려 (mentor만)
  app.patch<{
    Params: { id: string }
    Body: { status: 'approved' | 'rejected' }
  }>('/api/leaves/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { sub } = request.user as { sub: string }
    const { id } = request.params
    const { status } = request.body

    if (!status || !['approved', 'rejected'].includes(status)) {
      return reply.status(400).send({ error: 'status는 approved 또는 rejected' })
    }

    const result = await db
      .update(leaveRequests)
      .set({ status, approverId: sub, updatedAt: new Date() })
      .where(eq(leaveRequests.id, id))
      .returning()

    if (result.length === 0) return reply.status(404).send({ error: '신청을 찾을 수 없습니다' })
    return result[0]
  })

  // 연차 삭제 (본인 + pending만)
  app.delete<{ Params: { id: string } }>('/api/leaves/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { sub } = request.user as { sub: string }
    const { id } = request.params

    const rows = await db.select().from(leaveRequests).where(eq(leaveRequests.id, id))
    if (!rows.length) return reply.status(404).send({ error: '신청을 찾을 수 없습니다' })
    if (rows[0].userId !== sub) return reply.status(403).send({ error: '본인 신청만 삭제 가능합니다' })
    if (rows[0].status !== 'pending') return reply.status(400).send({ error: '승인/반려된 신청은 삭제할 수 없습니다' })

    await db.delete(leaveRequests).where(eq(leaveRequests.id, id))
    return { success: true }
  })
}
