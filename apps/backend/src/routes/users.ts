import { FastifyInstance } from 'fastify'

export async function userRoutes(_app: FastifyInstance) {
  // /api/users/me is now handled in chat.ts (unified endpoint)
}
