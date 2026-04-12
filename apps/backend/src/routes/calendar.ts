import { FastifyInstance } from 'fastify'
import { db } from '../db'
import { calendarEvents } from '../db/schema'
import { and, eq, gte, lte, asc } from 'drizzle-orm'

export async function calendarRoutes(app: FastifyInstance) {
  // 주간 일정 조회
  app.get<{ Querystring: { start?: string; end?: string } }>('/api/calendar', {
    preHandler: [app.authenticate],
  }, async (request) => {
    const { sub } = request.user as { sub: string }
    const { start, end } = request.query

    const conditions = [eq(calendarEvents.userId, sub)]
    if (start) conditions.push(gte(calendarEvents.eventDate, start))
    if (end) conditions.push(lte(calendarEvents.eventDate, end))

    return db.select().from(calendarEvents)
      .where(and(...conditions))
      .orderBy(asc(calendarEvents.eventDate), asc(calendarEvents.startTime))
  })

  // 일정 추가
  app.post<{
    Body: { title: string; eventDate: string; startTime: string; endTime?: string; location?: string; description?: string; color?: string }
  }>('/api/calendar', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { sub } = request.user as { sub: string }
    const { title, eventDate, startTime, endTime, location, description, color } = request.body

    if (!title || !eventDate || !startTime) {
      return reply.status(400).send({ error: 'title, eventDate, startTime 필수' })
    }

    const result = await db.insert(calendarEvents).values({
      userId: sub,
      title,
      eventDate,
      startTime,
      endTime: endTime || '',
      location: location || '',
      description: description || '',
      color: color || '#3B82F6',
    }).returning()

    return reply.status(201).send(result[0])
  })

  // 일정 수정
  app.patch<{ Params: { id: string }; Body: Partial<{ title: string; eventDate: string; startTime: string; endTime: string; location: string; description: string; color: string }> }>('/api/calendar/:id', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { sub } = request.user as { sub: string }
    const { id } = request.params

    const existing = (await db.select().from(calendarEvents).where(eq(calendarEvents.id, id)))[0]
    if (!existing || existing.userId !== sub) return reply.status(404).send({ error: '일정을 찾을 수 없습니다' })

    await db.update(calendarEvents).set(request.body).where(eq(calendarEvents.id, id))
    return { success: true }
  })

  // 일정 삭제
  app.delete<{ Params: { id: string } }>('/api/calendar/:id', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { sub } = request.user as { sub: string }
    const { id } = request.params

    const existing = (await db.select().from(calendarEvents).where(eq(calendarEvents.id, id)))[0]
    if (!existing || existing.userId !== sub) return reply.status(404).send({ error: '일정을 찾을 수 없습니다' })

    await db.delete(calendarEvents).where(eq(calendarEvents.id, id))
    return { success: true }
  })
}
