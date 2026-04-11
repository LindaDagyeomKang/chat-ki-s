import { FastifyInstance } from 'fastify'
import { pool } from '../db'

const DANGEROUS_PATTERN = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|EXEC)\b/i

export async function datahubRoutes(app: FastifyInstance) {
  // DataHub SQL 실행 — AI가 생성한 SELECT 쿼리를 안전하게 실행
  app.post<{ Body: { sql: string } }>(
    '/api/datahub/execute',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const { sql } = request.body
      if (!sql) return reply.status(400).send({ error: 'SQL이 필요합니다.' })

      // 안전성 재검증 (AI 서비스에서 1차 검증 후 백엔드에서 2차)
      const trimmed = sql.trim().toUpperCase()
      if (!trimmed.startsWith('SELECT')) {
        return reply.status(403).send({ error: 'SELECT 쿼리만 실행 가능합니다.' })
      }
      if (DANGEROUS_PATTERN.test(sql)) {
        return reply.status(403).send({ error: '위험한 SQL이 감지되었습니다.' })
      }
      if (sql.toLowerCase().includes('password_hash')) {
        return reply.status(403).send({ error: '민감 데이터 접근이 차단되었습니다.' })
      }

      try {
        const result = await pool.query(sql)
        return {
          rows: result.rows.slice(0, 20),
          rowCount: result.rowCount,
          fields: result.fields.map(f => f.name),
        }
      } catch (err: any) {
        return reply.status(400).send({ error: `SQL 실행 오류: ${err.message}` })
      }
    }
  )
}
