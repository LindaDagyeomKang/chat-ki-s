import { FastifyInstance } from 'fastify'
import { db } from '../db'
import { meetingRooms, roomReservations, users } from '../db/schema'
import { and, eq, asc, desc } from 'drizzle-orm'
import { sql } from 'drizzle-orm'

export async function roomRoutes(app: FastifyInstance) {
  // 회의실 목록
  app.get('/api/rooms', { preHandler: [app.authenticate] }, async () => {
    return db.select().from(meetingRooms).orderBy(asc(meetingRooms.name))
  })

  // 특정 날짜의 예약 현황
  app.get<{ Querystring: { date: string; roomId?: string } }>('/api/rooms/reservations', {
    preHandler: [app.authenticate],
  }, async (request) => {
    const { date, roomId } = request.query
    if (!date) return []

    const conditions = [eq(roomReservations.reserveDate, date)]
    if (roomId) conditions.push(eq(roomReservations.roomId, roomId))

    const rows = await db.select({
      id: roomReservations.id,
      roomId: roomReservations.roomId,
      roomName: meetingRooms.name,
      roomColor: meetingRooms.color,
      userId: roomReservations.userId,
      userName: users.name,
      title: roomReservations.title,
      reserveDate: roomReservations.reserveDate,
      startTime: roomReservations.startTime,
      endTime: roomReservations.endTime,
      attendees: roomReservations.attendees,
    })
      .from(roomReservations)
      .innerJoin(meetingRooms, eq(roomReservations.roomId, meetingRooms.id))
      .innerJoin(users, eq(roomReservations.userId, users.id))
      .where(and(...conditions))
      .orderBy(asc(roomReservations.startTime))

    return rows
  })

  // 예약 생성 (충돌 검사 포함)
  app.post<{
    Body: { roomId: string; title: string; reserveDate: string; startTime: string; endTime: string; attendees?: string }
  }>('/api/rooms/reservations', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { sub } = request.user as { sub: string }
    const { roomId, title, reserveDate, startTime, endTime, attendees } = request.body

    if (!roomId || !title || !reserveDate || !startTime || !endTime) {
      return reply.status(400).send({ error: '필수 항목이 누락되었습니다' })
    }

    // 시간 충돌 검사
    const conflicts = await db.select().from(roomReservations)
      .where(and(
        eq(roomReservations.roomId, roomId),
        eq(roomReservations.reserveDate, reserveDate),
      ))

    const hasConflict = conflicts.some((r: any) => {
      return startTime < r.endTime && endTime > r.startTime
    })

    if (hasConflict) {
      return reply.status(409).send({ error: '해당 시간에 이미 예약이 있습니다' })
    }

    const result = await db.insert(roomReservations).values({
      roomId, userId: sub, title, reserveDate, startTime, endTime, attendees: attendees || '',
    }).returning()

    return reply.status(201).send(result[0])
  })

  // 예약 삭제 (본인만)
  app.delete<{ Params: { id: string } }>('/api/rooms/reservations/:id', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { sub } = request.user as { sub: string }
    const { id } = request.params
    const existing = (await db.select().from(roomReservations).where(eq(roomReservations.id, id)))[0]
    if (!existing || existing.userId !== sub) return reply.status(404).send({ error: '예약을 찾을 수 없습니다' })
    await db.delete(roomReservations).where(eq(roomReservations.id, id))
    return { success: true }
  })
}
