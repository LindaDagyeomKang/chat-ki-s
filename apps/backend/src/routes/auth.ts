import { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { createHash } from 'crypto'
import { db } from '../db'
import { users } from '../db/schema'
import type { LoginRequest, LoginResponse } from '@chat-ki-s/shared'

function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex')
}

export async function authRoutes(app: FastifyInstance) {
  app.post<{ Body: LoginRequest }>('/api/auth/login', {
    schema: {
      body: {
        type: 'object',
        required: ['employeeId', 'password'],
        properties: {
          employeeId: { type: 'string' },
          password: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { employeeId, password } = request.body

    // 이메일 또는 사번으로 로그인 가능
    const isEmail = employeeId.includes('@')
    const result = await db
      .select()
      .from(users)
      .where(isEmail ? eq(users.email, employeeId) : eq(users.employeeId, employeeId))
      .limit(1)

    const user = result[0]
    if (!user || user.passwordHash !== hashPassword(password)) {
      return reply.status(401).send({ error: 'Invalid credentials' })
    }

    const accessToken = app.jwt.sign(
      { sub: user.id, employeeId: user.employeeId },
      { expiresIn: process.env.JWT_EXPIRES_IN ?? '7d' }
    )

    const response: LoginResponse = {
      accessToken,
      user: {
        id: user.id,
        employeeId: user.employeeId,
        name: user.name,
        email: user.email,
        department: user.department,
        createdAt: user.createdAt,
      },
    }

    return reply.send(response)
  })

  app.post('/api/auth/refresh', {
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
      return reply.status(401).send({ error: 'User not found' })
    }

    const accessToken = app.jwt.sign(
      { sub: user.id, employeeId: user.employeeId },
      { expiresIn: process.env.JWT_EXPIRES_IN ?? '7d' }
    )

    return reply.send({ accessToken })
  })
}
