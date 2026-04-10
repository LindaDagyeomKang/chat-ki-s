import { FastifyInstance } from 'fastify'
import { db } from '../db'
import { documents } from '../db/schema'
import { eq, ilike, or, desc } from 'drizzle-orm'

export async function documentRoutes(app: FastifyInstance) {
  // 결재함 목록 조회
  app.get('/api/documents', async (req, reply) => {
    const { category, q } = req.query as { category?: string; q?: string }
    let query = db.select().from(documents).orderBy(desc(documents.submittedAt))

    if (category) {
      query = query.where(eq(documents.category, category)) as typeof query
    }
    if (q) {
      query = query.where(
        or(
          ilike(documents.title, `%${q}%`),
          ilike(documents.content, `%${q}%`),
          ilike(documents.author, `%${q}%`)
        )
      ) as typeof query
    }

    const rows = await query
    return rows
  })

  // 결재함 상세 조회
  app.get('/api/documents/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const [doc] = await db.select().from(documents).where(eq(documents.id, id))
    if (!doc) return reply.status(404).send({ error: 'Document not found' })
    return doc
  })
}
