import { FastifyInstance } from 'fastify'
import { db } from '../db'
import { notices } from '../db/schema'
import { desc, eq, sql } from 'drizzle-orm'

export async function noticeRoutes(app: FastifyInstance) {
  // 공지 목록 조회
  app.get('/api/notices', { preHandler: [app.authenticate] }, async (request, reply) => {
    const result = await db
      .select()
      .from(notices)
      .orderBy(desc(notices.pinned), desc(notices.createdAt))
    return result
  })

  // 공지 상세 조회
  app.get<{ Params: { id: string } }>('/api/notices/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params
    const result = await db.select().from(notices).where(eq(notices.id, id))
    if (result.length === 0) return reply.status(404).send({ error: '공지를 찾을 수 없습니다' })
    // 조회수 증가
    await db.update(notices).set({ views: sql`views + 1` }).where(eq(notices.id, id))
    return { ...result[0], views: (result[0].views ?? 0) + 1 }
  })

  // 공지 작성 (mentor만)
  app.post<{ Body: { title: string; content: string; category?: string; pinned?: boolean } }>(
    '/api/notices',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { sub } = request.user as { sub: string }
      const { title, content, category, pinned } = request.body
      if (!title || !content) return reply.status(400).send({ error: 'title, content 필수' })

      const result = await db.insert(notices).values({
        title,
        content,
        category: category ?? '일반',
        authorId: sub,
        pinned: pinned ?? false,
      }).returning()

      return reply.status(201).send(result[0])
    }
  )
}
