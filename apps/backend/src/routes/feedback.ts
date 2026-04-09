import { FastifyInstance } from 'fastify'
import { db } from '../db'
import { feedback } from '../db/schema'

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

      return reply.status(201).send({ id: saved.id, createdAt: saved.createdAt })
    }
  )
}
