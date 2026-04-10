import { FastifyInstance } from 'fastify'
import { db } from '../db'
import { leaveRequests, expenses, assignments, users, mails } from '../db/schema'
import { eq } from 'drizzle-orm'

const LEAVE_LABELS: Record<string, string> = {
  annual: '연차',
  half_am: '오전 반차',
  half_pm: '오후 반차',
  sick: '병가',
  special: '특별휴가',
}

const EXPENSE_LABELS: Record<string, string> = {
  taxi: '업무 택시',
  meal: '업무 식대',
  supplies: '사무용품',
  travel: '출장 경비',
  etc: '기타',
}

export async function agentExecuteRoutes(app: FastifyInstance) {
  // POST /api/agent/execute — 확인 버튼 클릭 시 Agent 액션 실행
  app.post<{
    Body: { action: string; params: Record<string, unknown> }
  }>('/api/agent/execute', {
    onRequest: [app.authenticate],
  }, async (request, reply) => {
    const { sub } = request.user as { sub: string }
    const { action, params } = request.body
    async function logExecution(_result: string) {}

    if (action === 'leave') {
      await db.insert(leaveRequests).values({
        userId: sub,
        leaveType: params.leaveType as string,
        startDate: params.startDate as string,
        endDate: params.endDate as string,
        reason: (params.reason as string) || '',
        status: 'pending',
      })
      const label = LEAVE_LABELS[params.leaveType as string] ?? params.leaveType
      await logExecution('success')
      return {
        success: true,
        message: `${label} 신청을 완료했어요! ✅\n\n- 유형: ${label}\n- 날짜: ${params.startDate}\n- 상태: 승인 대기중\n\n팀장님 승인 후 확정됩니다.`,
      }
    }

    if (action === 'expense') {
      await db.insert(expenses).values({
        userId: sub,
        title: params.title as string,
        category: params.category as string,
        amount: params.amount as number,
        description: (params.description as string) || '',
        expenseDate: params.expenseDate as string,
        status: 'pending',
      })
      const label = EXPENSE_LABELS[params.category as string] ?? params.category
      const amt = (params.amount as number).toLocaleString()
      await logExecution('success')
      return {
        success: true,
        message: `경비 정산을 신청했어요! ✅\n\n- 항목: ${label}\n- 금액: ${amt}원\n- 사용일: ${params.expenseDate}\n- 상태: 승인 대기중\n\n팀장님 승인 후 처리됩니다.`,
      }
    }

    if (action === 'assignment') {
      // role 확인
      const mentor = await db.select().from(users).where(eq(users.id, sub))
      if (!mentor.length || mentor[0].role !== 'mentor') {
        return { success: false, message: '과제 등록은 팀장/사수만 가능합니다.' }
      }

      // 대상자 조회 (사번 또는 이름)
      const targetId = params.assignedToEmployeeId as string
      const targetName = params.assignedToName as string
      let target: any[] = []

      if (targetId) {
        target = await db.select().from(users).where(eq(users.employeeId, targetId))
      }
      if (!target.length && targetName) {
        target = await db.select().from(users).where(eq(users.name, targetName))
      }

      if (!target.length) {
        return { success: false, message: `대상자(${targetId || targetName})를 찾을 수 없습니다.` }
      }

      const title = params.title as string
      const dueDate = (params.dueDate as string) || null

      await db.insert(assignments).values({
        title,
        description: (params.description as string) || '',
        createdBy: sub,
        assignedTo: target[0].id,
        dueDate,
        status: 'pending',
      })

      // 대상자에게 메일 알림
      await db.insert(mails).values({
        fromId: sub,
        toId: target[0].id,
        subject: `새 과제가 도착했어요: ${title}`,
        body: `${target[0].name}님, 새로운 온보딩 과제가 등록되었습니다.\n\n📋 과제: ${title}${dueDate ? `\n📅 마감: ${dueDate}` : ''}\n\n챗봇에게 과제에 대해 물어볼 수 있어요!\n\n${mentor[0].name} 드림`,
      })

      await logExecution('success')
      return {
        success: true,
        message: `과제를 등록했어요! ✅\n\n- 과제: ${title}\n- 대상: ${target[0].name} (${target[0].employeeId})\n${dueDate ? `- 마감: ${dueDate}\n` : ''}\n${target[0].name}님에게 메일로 알림을 보냈습니다.`,
      }
    }

    if (action === 'assignment_submit') {
      const assignmentId = params.assignmentId as string
      const submission = params.submission as string

      if (!assignmentId || !submission) {
        return { success: false, message: '제출 정보가 부족합니다.' }
      }

      const rows = await db.select().from(assignments).where(eq(assignments.id, assignmentId))
      if (!rows.length) return { success: false, message: '과제를 찾을 수 없습니다.' }

      await db.update(assignments)
        .set({ submission, status: 'submitted', updatedAt: new Date() })
        .where(eq(assignments.id, assignmentId))

      // 사수에게 메일 알림
      const mentee = await db.select().from(users).where(eq(users.id, sub))
      if (mentee.length) {
        await db.insert(mails).values({
          fromId: sub,
          toId: rows[0].createdBy,
          subject: `과제 제출: ${rows[0].title}`,
          body: `${mentee[0].name}님이 과제를 제출했습니다.\n\n📋 과제: ${rows[0].title}\n📝 제출 내용: ${submission}\n\n확인 후 피드백을 보내주세요.`,
        })
      }

      await logExecution('success')
      return {
        success: true,
        message: `과제를 제출했어요! ✅\n\n- 과제: ${rows[0].title}\n- 제출 내용: ${submission}\n\n사수님이 확인 후 피드백을 보내드릴 거예요.`,
      }
    }

    if (action === 'start_survey') {
      const quarter = (params.quarter as number) ?? 0
      // 설문 시작을 챗봇 메시지로 트리거
      await logExecution('success')
      return {
        success: true,
        message: `설문을 시작합니다! 첫 번째 질문부터 답변해 주세요.\n\n챗봇에게 "설문 시작"이라고 말해주세요.`,
      }
    }

    await logExecution('failed')
    return reply.status(400).send({ error: '지원하지 않는 액션입니다' })
  })
}
