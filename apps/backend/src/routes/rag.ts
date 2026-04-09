import { FastifyInstance } from 'fastify'

const AI_SERVICE_URL = process.env.AI_SERVICE_URL ?? 'http://localhost:8001'

export async function ragRoutes(app: FastifyInstance) {
  /**
   * POST /api/rag/search
   * Proxy semantic search to the AI service.
   */
  app.post<{ Body: { query: string; top_k?: number } }>('/api/rag/search', {
    onRequest: [app.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['query'],
        properties: {
          query: { type: 'string', minLength: 1 },
          top_k: { type: 'number', minimum: 1, maximum: 20 },
        },
      },
    },
  }, async (request, reply) => {
    const { query, top_k = 5 } = request.body

    const res = await fetch(`${AI_SERVICE_URL}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, top_k }),
    })

    if (!res.ok) {
      const text = await res.text()
      return reply.status(502).send({ error: 'AI service error', detail: text })
    }

    return reply.send(await res.json())
  })

  /**
   * POST /api/rag/documents
   * Proxy document ingestion to the AI service (multipart passthrough).
   */
  app.post('/api/rag/documents', {
    onRequest: [app.authenticate],
  }, async (request, reply) => {
    const data = await request.file?.()
    if (!data) {
      return reply.status(400).send({ error: 'No file uploaded' })
    }

    const chunks: Buffer[] = []
    for await (const chunk of data.file) {
      chunks.push(chunk)
    }
    const fileBuffer = Buffer.concat(chunks)

    const formData = new FormData()
    formData.append('file', new Blob([fileBuffer], { type: data.mimetype }), data.filename)

    const res = await fetch(`${AI_SERVICE_URL}/documents/ingest`, {
      method: 'POST',
      body: formData,
    })

    if (!res.ok) {
      const text = await res.text()
      return reply.status(502).send({ error: 'AI service error', detail: text })
    }

    return reply.send(await res.json())
  })

  /**
   * GET /api/rag/documents
   * List ingested documents.
   */
  app.get('/api/rag/documents', {
    onRequest: [app.authenticate],
  }, async (_request, reply) => {
    const res = await fetch(`${AI_SERVICE_URL}/documents`)

    if (!res.ok) {
      const text = await res.text()
      return reply.status(502).send({ error: 'AI service error', detail: text })
    }

    return reply.send(await res.json())
  })
}
