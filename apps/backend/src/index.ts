import Fastify from 'fastify'
import fastifyJwt from '@fastify/jwt'
import fastifyCors from '@fastify/cors'
import fastifyWebsocket from '@fastify/websocket'
import fastifyMultipart from '@fastify/multipart'
import fastifyCookie from '@fastify/cookie'
import { authRoutes } from './routes/auth'
import { userRoutes } from './routes/users'
import { chatRoutes } from './routes/chat'
import { feedbackRoutes } from './routes/feedback'
import { conversationRoutes } from './routes/conversations'
import { ragRoutes } from './routes/rag'
import { noticeRoutes } from './routes/notices'
import { leaveRoutes } from './routes/leaves'
import { expenseRoutes } from './routes/expenses'
import { mailRoutes } from './routes/mails'
import { agentExecuteRoutes } from './routes/agentExecute'
import { approvalRoutes } from './routes/approvals'
import { assignmentRoutes } from './routes/assignments'
import { employeeRoutes } from './routes/employees'
import { calendarRoutes } from './routes/calendar'
import { roomRoutes } from './routes/rooms'
import { documentRoutes } from './routes/documents'
import { datahubRoutes } from './routes/datahub'
import { runMigrations } from './db/migrate'

const app = Fastify({ logger: true })

// CORS — 환경변수 CORS_ORIGIN으로 허용 도메인 설정 (쉼표 구분)
// 예: CORS_ORIGIN=http://localhost:3000,https://portal.kiwoom.com
const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : (process.env.NODE_ENV === 'production' ? false : true)
app.register(fastifyCors, { origin: corsOrigin, credentials: true })

// Cookie plugin (HttpOnly 토큰 저장)
app.register(fastifyCookie)

// JWT plugin
app.register(fastifyJwt, {
  secret: process.env.JWT_SECRET ?? 'dev-secret',
})

// WebSocket support
app.register(fastifyWebsocket)

// Multipart (file uploads for RAG document ingestion)
app.register(fastifyMultipart)

// Authenticate decorator — HttpOnly 쿠키 또는 Authorization 헤더에서 토큰 읽기
app.decorate('authenticate', async function (request, reply) {
  try {
    // 쿠키에 토큰이 있으면 Authorization 헤더로 주입
    const cookieToken = request.cookies?.accessToken
    if (cookieToken && !request.headers.authorization) {
      request.headers.authorization = `Bearer ${cookieToken}`
    }
    await request.jwtVerify()
  } catch (err) {
    reply.status(401).send({ error: 'Unauthorized' })
  }
})

// Health check
app.get('/health', async () => {
  return { status: 'ok', service: 'chat-ki-s-backend' }
})

// Routes
app.register(authRoutes)
app.register(userRoutes)
app.register(chatRoutes)
app.register(feedbackRoutes)
app.register(conversationRoutes)
app.register(ragRoutes)
app.register(noticeRoutes)
app.register(leaveRoutes)
app.register(expenseRoutes)
app.register(mailRoutes)
app.register(agentExecuteRoutes)
app.register(approvalRoutes)
app.register(assignmentRoutes)
app.register(employeeRoutes)
app.register(calendarRoutes)
app.register(roomRoutes)
app.register(documentRoutes)
app.register(datahubRoutes)

const start = async () => {
  try {
    await runMigrations()
    const port = Number(process.env.PORT) || 4000
    await app.listen({ port, host: '0.0.0.0' })
    console.log(`Backend running on port ${port}`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
