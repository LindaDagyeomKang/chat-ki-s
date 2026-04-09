import { FastifyInstance } from 'fastify'
import { db } from '../db'
import { leaveRequests } from '../db/schema'
import { and, desc, eq } from 'drizzle-orm'

export async function leaveRoutes(app: FastifyInstance) {
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
