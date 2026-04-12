import { FastifyInstance } from 'fastify'
import { eq, and, desc } from 'drizzle-orm'
import { db } from '../db'
import { feedback, messages, goodAnswers } from '../db/schema'

const AI_SERVICE_URL = process.env.AI_SERVICE_URL ?? 'http://localhost:8001'

export async function feedbackRoutes(app: FastifyInstance) {
  app.post<{
    Body: { messageId?: string; rating?: string; comment?: string }
  }>(
    '/api/feedback',
    {
      onRequest: [app.authenticate],
      schema: {
        body: {
          type: 'object',
          properties: {
            messageId: { type: 'string' },
            rating: { type: 'string', enum: ['helpful', 'unhelpful'] },
            comment: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const payload = request.user as { sub: string }
      const { messageId, rating, comment } = request.body

      const [saved] = await db
        .insert(feedback)
        .values({
          userId: payload.sub,
          messageId: messageId ?? null,
          rating: rating ?? null,
          comment: comment ?? null,
        })
        .returning({ id: feedback.id, createdAt: feedback.createdAt })

      // "도움이 됐어요" → 질문+답변을 good_answers에 저장
      if (rating === 'helpful' && messageId) {
        try {
          // 해당 메시지(assistant 답변) 조회
          const [answerMsg] = await db.select().from(messages).where(eq(messages.id, messageId))
          if (answerMsg) {
            // 바로 이전 user 메시지(질문) 찾기
            const [questionMsg] = await db.select().from(messages)
              .where(and(
                eq(messages.conversationId, answerMsg.conversationId),
                eq(messages.role, 'user')
              ))
              .orderBy(desc(messages.createdAt))
              .limit(1)

            if (questionMsg) {
              await db.insert(goodAnswers).values({
                userId: payload.sub,
                conversationId: answerMsg.conversationId,
                question: questionMsg.content,
                answer: answerMsg.content,
              })

              // ChromaDB에 질문+답변을 벡터화하여 RAG 지식 베이스 보강
              try {
                const goodAnswerDoc = `[좋은 답변 예시]\n질문: ${questionMsg.content}\n답변: ${answerMsg.content}`
                const blob = new Blob([goodAnswerDoc], { type: 'text/plain' })
                const formData = new FormData()
                formData.append('file', blob, `good_answer_${Date.now()}.txt`)
                await fetch(`${AI_SERVICE_URL}/documents/ingest`, {
                  method: 'POST',
                  body: formData,
                })
              } catch {
                // 벡터화 실패해도 피드백 자체는 성공 처리
              }
            }
          }
        } catch (e) {
          // 저장 실패해도 피드백 자체는 성공 처리
          console.error('Failed to save good answer:', e)
        }
      }

      return reply.status(201).send({ id: saved.id, createdAt: saved.createdAt })
    }
  )

  // good_answers 조회 (나중에 학습용)
  app.get('/api/good-answers', {
    onRequest: [app.authenticate],
  }, async () => {
    return db.select().from(goodAnswers).orderBy(desc(goodAnswers.createdAt))
  })
}
