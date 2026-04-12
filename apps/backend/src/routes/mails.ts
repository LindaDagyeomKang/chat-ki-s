import { FastifyInstance } from 'fastify'
import { db } from '../db'
import { mails, users } from '../db/schema'
import { and, desc, eq, or } from 'drizzle-orm'

export async function mailRoutes(app: FastifyInstance) {
  // 받은 편지함 (삭제 안 된 것만)
  app.get('/api/mails/inbox', { preHandler: [app.authenticate] }, async (request) => {
    const { sub } = request.user as { sub: string }
    return db.select().from(mails)
      .where(and(eq(mails.toId, sub), eq(mails.deleted, false), eq(mails.isDraft, false)))
      .orderBy(desc(mails.receivedAt))
  })

  // 보낸 편지함
  app.get('/api/mails/sent', { preHandler: [app.authenticate] }, async (request) => {
    const { sub } = request.user as { sub: string }
    return db.select().from(mails)
      .where(and(eq(mails.fromId, sub), eq(mails.deleted, false), eq(mails.isDraft, false)))
      .orderBy(desc(mails.receivedAt))
  })

  // 별표 편지함
  app.get('/api/mails/starred', { preHandler: [app.authenticate] }, async (request) => {
    const { sub } = request.user as { sub: string }
    return db.select().from(mails)
      .where(and(
        or(eq(mails.toId, sub), eq(mails.fromId, sub)),
        eq(mails.starred, true),
        eq(mails.deleted, false),
      ))
      .orderBy(desc(mails.receivedAt))
  })

  // 임시 보관함
  app.get('/api/mails/drafts', { preHandler: [app.authenticate] }, async (request) => {
    const { sub } = request.user as { sub: string }
    return db.select().from(mails)
      .where(and(eq(mails.fromId, sub), eq(mails.isDraft, true), eq(mails.deleted, false)))
      .orderBy(desc(mails.receivedAt))
  })

  // 휴지통
  app.get('/api/mails/trash', { preHandler: [app.authenticate] }, async (request) => {
    const { sub } = request.user as { sub: string }
    return db.select().from(mails)
      .where(and(
        or(eq(mails.toId, sub), eq(mails.fromId, sub)),
        eq(mails.deleted, true),
      ))
      .orderBy(desc(mails.receivedAt))
  })

  // 전체 메일
  app.get('/api/mails', { preHandler: [app.authenticate] }, async (request) => {
    const { sub } = request.user as { sub: string }
    return db.select().from(mails)
      .where(or(eq(mails.toId, sub), eq(mails.fromId, sub)))
      .orderBy(desc(mails.receivedAt))
  })

  // 메일 상세 + 읽음 처리
  app.get<{ Params: { id: string } }>('/api/mails/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params
    const result = await db.select().from(mails).where(eq(mails.id, id))
    if (result.length === 0) return reply.status(404).send({ error: '메일을 찾을 수 없습니다' })
    if (!result[0].isRead) {
      await db.update(mails).set({ isRead: true }).where(eq(mails.id, id))
    }
    return { ...result[0], isRead: true }
  })

  // 별표 토글
  app.patch<{ Params: { id: string } }>('/api/mails/:id/star', { preHandler: [app.authenticate] }, async (request) => {
    const { id } = request.params
    const mail = (await db.select().from(mails).where(eq(mails.id, id)))[0]
    if (!mail) return { success: false }
    const newVal = !mail.starred
    await db.update(mails).set({ starred: newVal }).where(eq(mails.id, id))
    return { success: true, starred: newVal }
  })

  // 삭제 (휴지통으로)
  app.patch<{ Params: { id: string } }>('/api/mails/:id/delete', { preHandler: [app.authenticate] }, async (request) => {
    const { id } = request.params
    await db.update(mails).set({ deleted: true }).where(eq(mails.id, id))
    return { success: true }
  })

  // 복원 (휴지통에서)
  app.patch<{ Params: { id: string } }>('/api/mails/:id/restore', { preHandler: [app.authenticate] }, async (request) => {
    const { id } = request.params
    await db.update(mails).set({ deleted: false }).where(eq(mails.id, id))
    return { success: true }
  })

  // 완전 삭제 (DB에서 제거)
  app.delete<{ Params: { id: string } }>('/api/mails/:id', { preHandler: [app.authenticate] }, async (request) => {
    const { id } = request.params
    await db.delete(mails).where(and(eq(mails.id, id), eq(mails.deleted, true)))
    return { success: true }
  })

  // 메일 보내기
  app.post<{
    Body: { toEmployeeId: string; subject: string; body: string }
  }>('/api/mails', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { sub } = request.user as { sub: string }
    const { toEmployeeId, subject, body } = request.body

    if (!toEmployeeId || !subject || !body) {
      return reply.status(400).send({ error: 'toEmployeeId, subject, body 필수' })
    }

    const isEmail = toEmployeeId.includes('@')
    const toUser = isEmail
      ? await db.select().from(users).where(eq(users.email, toEmployeeId))
      : await db.select().from(users).where(eq(users.employeeId, toEmployeeId))
    if (toUser.length === 0) return reply.status(404).send({ error: '수신자를 찾을 수 없습니다' })

    const result = await db.insert(mails).values({
      fromId: sub,
      toId: toUser[0].id,
      subject,
      body,
    }).returning()

    return reply.status(201).send(result[0])
  })
}
