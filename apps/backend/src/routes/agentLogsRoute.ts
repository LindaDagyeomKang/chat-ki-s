import { FastifyInstance } from 'fastify'
import { db } from '../db'
import { agentLogs } from '../db/schema'
import { desc, sql } from 'drizzle-orm'

export async function agentLogsRoutes(app: FastifyInstance) {
  // 최근 로그 조회
  app.get('/api/agent/logs', { preHandler: [app.authenticate] }, async () => {
    const logs = await db.select().from(agentLogs).orderBy(desc(agentLogs.createdAt)).limit(50)
    return logs
  })

  // 통계 요약
  app.get('/api/agent/stats', { preHandler: [app.authenticate] }, async () => {
    const totalResult = await db.select({ count: sql<number>`count(*)` }).from(agentLogs)
    const total = totalResult[0]?.count ?? 0

    const byAction = await db.select({
      action: agentLogs.action,
      count: sql<number>`count(*)`,
      avgResponseMs: sql<number>`avg(response_time_ms)::int`,
      totalTokens: sql<number>`sum(total_tokens)::int`,
    }).from(agentLogs).groupBy(agentLogs.action)

    const tokenResult = await db.select({
      promptTokens: sql<number>`sum(prompt_tokens)::int`,
      completionTokens: sql<number>`sum(completion_tokens)::int`,
      totalTokens: sql<number>`sum(total_tokens)::int`,
    }).from(agentLogs)

    return {
      total,
      byAction,
      tokens: tokenResult[0] ?? { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    }
  })
}
