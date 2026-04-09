import { FastifyInstance } from 'fastify'
import { db } from '../db'
import { expenses } from '../db/schema'
import { desc, eq } from 'drizzle-orm'

export async function expenseRoutes(app: FastifyInstance) {
  // 내 품의/경비 목록 조회
  app.get('/api/expenses', { preHandler: [app.authenticate] }, async (request) => {
    const { sub } = request.user as { sub: string }
    const result = await db
      .select()
      .from(expenses)
      .where(eq(expenses.userId, sub))
      .orderBy(desc(expenses.createdAt))
    return result
  })

  // 품의/경비 정산 신청
  app.post<{
    Body: { title: string; category: string; amount: number; description?: string; expenseDate: string }
  }>('/api/expenses', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { sub } = request.user as { sub: string }
    const { title, category, amount, description, expenseDate } = request.body

    if (!title || !category || !amount || !expenseDate) {
      return reply.status(400).send({ error: 'title, category, amount, expenseDate 필수' })
    }

    const result = await db.insert(expenses).values({
      userId: sub,
      title,
      category,
      amount,
      description: description ?? '',
      expenseDate,
      status: 'pending',
    }).returning()

    return reply.status(201).send(result[0])
  })

  // 품의 승인/반려 (mentor만)
  app.patch<{
    Params: { id: string }
    Body: { status: 'approved' | 'rejected' }
  }>('/api/expenses/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { sub } = request.user as { sub: string }
    const { id } = request.params
    const { status } = request.body

    if (!status || !['approved', 'rejected'].includes(status)) {
      return reply.status(400).send({ error: 'status는 approved 또는 rejected' })
    }

    const result = await db
      .update(expenses)
      .set({ status, approverId: sub, updatedAt: new Date() })
      .where(eq(expenses.id, id))
      .returning()

    if (result.length === 0) return reply.status(404).send({ error: '품의를 찾을 수 없습니다' })
    return result[0]
  })

  // 경비 삭제 (본인 + pending만)
  app.delete<{ Params: { id: string } }>('/api/expenses/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { sub } = request.user as { sub: string }
    const { id } = request.params

    const rows = await db.select().from(expenses).where(eq(expenses.id, id))
    if (!rows.length) return reply.status(404).send({ error: '품의를 찾을 수 없습니다' })
    if (rows[0].userId !== sub) return reply.status(403).send({ error: '본인 신청만 삭제 가능합니다' })
    if (rows[0].status !== 'pending') return reply.status(400).send({ error: '승인/반려된 신청은 삭제할 수 없습니다' })

    await db.delete(expenses).where(eq(expenses.id, id))
    return { success: true }
  })
}
