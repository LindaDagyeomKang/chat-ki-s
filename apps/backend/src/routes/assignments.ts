import { FastifyInstance } from 'fastify'
import { db } from '../db'
import { assignments, users, mails } from '../db/schema'
import { desc, eq, or } from 'drizzle-orm'

const DEFAULT_MISSIONS = [
  { title: '연차 신청 해보기', description: '직접 연차 신청을 한번 해보세요. 시스템을 직접 써보는 것이 자율성을 향한 첫 번째 단계입니다!' },
  { title: '사내 메신저 설치 및 인사', description: '동료들과 소통하는 가장 빠른 방법입니다. 가벼운 인사와 함께 팀 채널에 합류해 보세요.' },
  { title: '팀원들과 점심 식사', description: '업무 외적인 대화를 통해 서로를 더 잘 알아가는 시간을 가져보시길 권장합니다.' },
  { title: '비즈니스 이메일 서명 설정', description: '우리 기업의 아이덴티티를 나타내는 표준 서명을 설정하여 전문성을 갖춰 보세요.' },
  { title: '보안 서약서 작성', description: '중요한 정보 자산을 보호하는 것은 금융인의 기본입니다. 내용을 꼼꼼히 확인하고 서명해 주세요.' },
  { title: '사원증 등록', description: '사원증은 Kiwoom 가족의 증표입니다. 분실하지 않도록 유의해주세요!' },
]

export async function assignmentRoutes(app: FastifyInstance) {
  // 내 과제 목록 — 없으면 기본 미션 자동 생성
  app.get('/api/assignments', { preHandler: [app.authenticate] }, async (request) => {
    const { sub } = request.user as { sub: string }
    let result = await db
      .select()
      .from(assignments)
      .where(or(eq(assignments.assignedTo, sub), eq(assignments.createdBy, sub)))
      .orderBy(desc(assignments.createdAt))

    // 과제가 하나도 없으면 기본 미션 생성
    if (result.length === 0) {
      for (const m of DEFAULT_MISSIONS) {
        await db.insert(assignments).values({
          title: m.title,
          description: m.description,
          createdBy: sub,
          assignedTo: sub,
          status: 'pending',
        })
      }
      result = await db
        .select()
        .from(assignments)
        .where(eq(assignments.assignedTo, sub))
        .orderBy(desc(assignments.createdAt))
    }

    return result
  })

  // 과제 상태 변경 (칸반 드래그&드롭)
  app.patch<{
    Params: { id: string }
    Body: { status: string }
  }>('/api/assignments/:id/status', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params
    const { status } = request.body
    if (!['pending', 'submitted', 'completed'].includes(status)) {
      return reply.status(400).send({ error: 'status는 pending/submitted/completed만 가능' })
    }
    const result = await db
      .update(assignments)
      .set({ status, updatedAt: new Date() })
      .where(eq(assignments.id, id))
      .returning()
    if (!result.length) return reply.status(404).send({ error: '과제를 찾을 수 없습니다' })
    return result[0]
  })

  // 과제 등록 (mentor만)
  app.post<{
    Body: { title: string; description?: string; assignedToEmployeeId: string; dueDate?: string }
  }>('/api/assignments', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { sub } = request.user as { sub: string }
    const { title, description, assignedToEmployeeId, dueDate } = request.body

    if (!title || !assignedToEmployeeId) {
      return reply.status(400).send({ error: 'title, assignedToEmployeeId 필수' })
    }

    // role 확인
    const mentor = await db.select().from(users).where(eq(users.id, sub))
    if (!mentor.length || mentor[0].role !== 'mentor') {
      return reply.status(403).send({ error: '과제 등록 권한이 없습니다' })
    }

    // 대상자 조회
    const target = await db.select().from(users).where(eq(users.employeeId, assignedToEmployeeId))
    if (!target.length) {
      return reply.status(404).send({ error: '대상자를 찾을 수 없습니다' })
    }

    const result = await db.insert(assignments).values({
      title,
      description: description ?? '',
      createdBy: sub,
      assignedTo: target[0].id,
      dueDate: dueDate ?? null,
      status: 'pending',
    }).returning()

    // 대상자에게 메일 알림
    await db.insert(mails).values({
      fromId: sub,
      toId: target[0].id,
      subject: `새 과제가 도착했어요: ${title}`,
      body: `${target[0].name}님, 새로운 온보딩 과제가 등록되었습니다.\n\n📋 과제: ${title}\n${description ? `📝 설명: ${description}\n` : ''}${dueDate ? `📅 마감: ${dueDate}\n` : ''}\n챗봇에게 과제에 대해 물어볼 수 있어요!\n\n${mentor[0].name} 드림`,
    })

    return reply.status(201).send(result[0])
  })

  // 과제 제출 (mentee)
  app.patch<{
    Params: { id: string }
    Body: { submission: string }
  }>('/api/assignments/:id/submit', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { sub } = request.user as { sub: string }
    const { id } = request.params
    const { submission } = request.body

    if (!submission) return reply.status(400).send({ error: 'submission 필수' })

    const result = await db
      .update(assignments)
      .set({ submission, status: 'submitted', updatedAt: new Date() })
      .where(eq(assignments.id, id))
      .returning()

    if (!result.length) return reply.status(404).send({ error: '과제를 찾을 수 없습니다' })

    // 사수에게 메일 알림
    const assignment = result[0]
    const mentee = await db.select().from(users).where(eq(users.id, sub))
    if (mentee.length) {
      await db.insert(mails).values({
        fromId: sub,
        toId: assignment.createdBy,
        subject: `과제 제출: ${assignment.title}`,
        body: `${mentee[0].name}님이 과제를 제출했습니다.\n\n📋 과제: ${assignment.title}\n📝 제출 내용: ${submission}\n\n확인 후 피드백을 보내주세요.`,
      })
    }

    return result[0]
  })

  // 과제 피드백 (mentor)
  app.patch<{
    Params: { id: string }
    Body: { feedback: string; status: 'completed' | 'pending' }
  }>('/api/assignments/:id/feedback', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { sub } = request.user as { sub: string }
    const { id } = request.params
    const { feedback, status } = request.body

    const result = await db
      .update(assignments)
      .set({ feedback, status: status ?? 'completed', updatedAt: new Date() })
      .where(eq(assignments.id, id))
      .returning()

    if (!result.length) return reply.status(404).send({ error: '과제를 찾을 수 없습니다' })

    // 신입에게 메일 알림
    const assignment = result[0]
    const mentor = await db.select().from(users).where(eq(users.id, sub))
    if (mentor.length) {
      await db.insert(mails).values({
        fromId: sub,
        toId: assignment.assignedTo,
        subject: `과제 피드백: ${assignment.title}`,
        body: `${assignment.title} 과제에 대한 피드백이 도착했습니다.\n\n💬 피드백: ${feedback}\n📌 상태: ${status === 'completed' ? '완료' : '재제출 필요'}\n\n${mentor[0].name} 드림`,
      })
    }

    return result[0]
  })
}
