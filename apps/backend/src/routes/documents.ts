import { FastifyInstance } from 'fastify'
import { db } from '../db'
import { documents, users } from '../db/schema'
import { eq, ilike, or, and, desc } from 'drizzle-orm'

export async function documentRoutes(app: FastifyInstance) {
  // 결재함 목록 조회 (본인 팀 문서만)
  app.get('/api/documents', { preHandler: [app.authenticate] }, async (req, _reply) => {
    const payload = req.user as { sub: string }
    const userRow = await db.select().from(users).where(eq(users.id, payload.sub)).limit(1)
    const userDept = userRow[0]?.department || ''

    const conditions: any[] = []
    if (userDept) {
      conditions.push(ilike(documents.author, `%${userDept}%`))
    }

    const { category, q } = req.query as { category?: string; q?: string }
    if (category) conditions.push(eq(documents.category, category))
    if (q) conditions.push(or(ilike(documents.title, `%${q}%`), ilike(documents.content, `%${q}%`), ilike(documents.author, `%${q}%`)))

    const rows = await db.select().from(documents)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(documents.submittedAt))
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
