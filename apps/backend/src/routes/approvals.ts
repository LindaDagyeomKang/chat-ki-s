import { FastifyInstance } from 'fastify'
import { db } from '../db'
import { leaveRequests, expenses, users } from '../db/schema'
import { desc, eq } from 'drizzle-orm'

export async function approvalRoutes(app: FastifyInstance) {
  // 승인 대기 목록 (mentor만)
  app.get('/api/approvals', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { sub } = request.user as { sub: string }

    // role 확인
    const userRows = await db.select().from(users).where(eq(users.id, sub))
    if (!userRows.length || userRows[0].role !== 'mentor') {
      return reply.status(403).send({ error: '권한이 없습니다' })
    }

    // pending 연차
    const pendingLeaves = await db
      .select({
        id: leaveRequests.id,
        userId: leaveRequests.userId,
        leaveType: leaveRequests.leaveType,
        startDate: leaveRequests.startDate,
        endDate: leaveRequests.endDate,
        reason: leaveRequests.reason,
        status: leaveRequests.status,
        createdAt: leaveRequests.createdAt,
        userName: users.name,
        employeeId: users.employeeId,
        department: users.department,
      })
      .from(leaveRequests)
      .innerJoin(users, eq(leaveRequests.userId, users.id))
      .where(eq(leaveRequests.status, 'pending'))
      .orderBy(desc(leaveRequests.createdAt))

    // pending 경비
    const pendingExpenses = await db
      .select({
        id: expenses.id,
        userId: expenses.userId,
        title: expenses.title,
        category: expenses.category,
        amount: expenses.amount,
        description: expenses.description,
        expenseDate: expenses.expenseDate,
        status: expenses.status,
        createdAt: expenses.createdAt,
        userName: users.name,
        employeeId: users.employeeId,
        department: users.department,
      })
      .from(expenses)
      .innerJoin(users, eq(expenses.userId, users.id))
      .where(eq(expenses.status, 'pending'))
      .orderBy(desc(expenses.createdAt))

    return {
      leaves: pendingLeaves,
      expenses: pendingExpenses,
      total: pendingLeaves.length + pendingExpenses.length,
    }
  })
}
