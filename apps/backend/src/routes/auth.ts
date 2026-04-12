import { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { createHash } from 'crypto'
import bcrypt from 'bcrypt'
import { db } from '../db'
import { users } from '../db/schema'
import type { LoginRequest, LoginResponse } from '@chat-ki-s/shared'

const BCRYPT_ROUNDS = 12

// 레거시 SHA-256 해시 (마이그레이션용)
function legacySha256(password: string): string {
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
    if (!user) {
      return reply.status(401).send({ error: 'Invalid credentials' })
    }

    // bcrypt 해시인지 판별 ($2b$ 접두사)
    const isBcrypt = user.passwordHash.startsWith('$2b$') || user.passwordHash.startsWith('$2a$')
    let valid = false

    if (isBcrypt) {
      valid = await bcrypt.compare(password, user.passwordHash)
    } else {
      // 레거시 SHA-256 폴백 → 로그인 성공 시 bcrypt로 자동 마이그레이션
      valid = user.passwordHash === legacySha256(password)
      if (valid) {
        const bcryptHash = await bcrypt.hash(password, BCRYPT_ROUNDS)
        await db.update(users).set({ passwordHash: bcryptHash }).where(eq(users.id, user.id))
      }
    }

    if (!valid) {
      return reply.status(401).send({ error: 'Invalid credentials' })
    }

    const accessToken = app.jwt.sign(
      { sub: user.id, employeeId: user.employeeId },
      { expiresIn: process.env.JWT_EXPIRES_IN ?? '7d' }
    )

    // HttpOnly 쿠키에 토큰 설정
    const isProduction = process.env.NODE_ENV === 'production'
    reply.setCookie('accessToken', accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7일 (초)
    })

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

  // 로그아웃 — 쿠키 삭제
  app.post('/api/auth/logout', async (_request, reply) => {
    reply.clearCookie('accessToken', { path: '/' })
    return reply.send({ success: true })
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
