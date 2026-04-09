import { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { db } from '../db'
import { users } from '../db/schema'
import type { User } from '@chat-ki-s/shared'

export async function userRoutes(app: FastifyInstance) {
  app.get('/api/users/me', {
    onRequest: [app.authenticate],
  }, async (request, reply) => {
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

    const response: User = {
      id: user.id,
      employeeId: user.employeeId,
      name: user.name,
      email: user.email,
      department: user.department,
      createdAt: user.createdAt,
    }

    return reply.send(response)
  })
}
