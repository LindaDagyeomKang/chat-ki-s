import Fastify, { FastifyInstance } from 'fastify'
import fastifyJwt from '@fastify/jwt'
import fastifyWebsocket from '@fastify/websocket'
import { conversationRoutes } from '../routes/conversations'

// Mock the database module
jest.mock('../db', () => ({
  db: {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn(),
    values: jest.fn().mockReturnThis(),
    returning: jest.fn(),
    set: jest.fn().mockReturnThis(),
    orderBy: jest.fn(),
  },
}))

const { db } = require('../db')

const USER_ID = '00000000-0000-0000-0000-000000000001'
const CONV_ID = 'aaaaaaaa-0000-0000-0000-000000000001'

const TEST_CONV = {
  id: CONV_ID,
  userId: USER_ID,
  title: 'Test Conversation',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
}

const TEST_MSG = {
  id: 'bbbbbbbb-0000-0000-0000-000000000001',
  conversationId: CONV_ID,
  role: 'user',
  content: 'Hello',
  createdAt: new Date('2026-01-01T00:00:00Z'),
}

function buildApp(): FastifyInstance {
  const app = Fastify({ logger: false })
  app.register(fastifyJwt, { secret: 'test-secret' })
  app.register(fastifyWebsocket)
  app.decorate('authenticate', async function (request: any, reply: any) {
    try {
      await request.jwtVerify()
    } catch (err) {
      reply.send(err)
    }
  })
  app.register(conversationRoutes)
  return app
}

describe('POST /api/conversations', () => {
  let app: FastifyInstance
  let token: string

  beforeEach(async () => {
    app = buildApp()
    await app.ready()
    token = app.jwt.sign({ sub: USER_ID, employeeId: 'EMP001' })
  })

  afterEach(async () => {
    await app.close()
    jest.clearAllMocks()
  })

  it('creates a conversation and returns 201', async () => {
    db.returning.mockResolvedValueOnce([TEST_CONV])

    const res = await app.inject({
      method: 'POST',
      url: '/api/conversations',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'Test Conversation' },
    })

    expect(res.statusCode).toBe(201)
    const body = JSON.parse(res.body)
    expect(body.id).toBe(CONV_ID)
    expect(body.title).toBe('Test Conversation')
    expect(body.messages).toEqual([])
  })

  it('returns 401 without token', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/conversations' })
    expect(res.statusCode).toBe(401)
  })
})

describe('GET /api/conversations', () => {
  let app: FastifyInstance
  let token: string

  beforeEach(async () => {
    app = buildApp()
    await app.ready()
    token = app.jwt.sign({ sub: USER_ID, employeeId: 'EMP001' })
  })

  afterEach(async () => {
    await app.close()
    jest.clearAllMocks()
  })

  it('returns list of user conversations', async () => {
    // select().from().where() chain returns array
    db.where.mockResolvedValueOnce([TEST_CONV])

    const res = await app.inject({
      method: 'GET',
      url: '/api/conversations',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(Array.isArray(body)).toBe(true)
    expect(body[0].id).toBe(CONV_ID)
  })
})

describe('GET /api/conversations/:id/messages', () => {
  let app: FastifyInstance
  let token: string

  beforeEach(async () => {
    app = buildApp()
    await app.ready()
    token = app.jwt.sign({ sub: USER_ID, employeeId: 'EMP001' })
  })

  afterEach(async () => {
    await app.close()
    jest.clearAllMocks()
  })

  it('returns messages for owned conversation', async () => {
    // First select: conversation ownership check (.limit())
    db.limit.mockResolvedValueOnce([TEST_CONV])
    // Second select: messages (.orderBy())
    db.orderBy.mockResolvedValueOnce([TEST_MSG])

    const res = await app.inject({
      method: 'GET',
      url: `/api/conversations/${CONV_ID}/messages`,
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(Array.isArray(body)).toBe(true)
    expect(body[0].content).toBe('Hello')
  })

  it('returns 404 for conversation belonging to another user', async () => {
    db.limit.mockResolvedValueOnce([{ ...TEST_CONV, userId: 'other-user-id' }])

    const res = await app.inject({
      method: 'GET',
      url: `/api/conversations/${CONV_ID}/messages`,
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(404)
  })

  it('returns 404 for non-existent conversation', async () => {
    db.limit.mockResolvedValueOnce([])

    const res = await app.inject({
      method: 'GET',
      url: `/api/conversations/${CONV_ID}/messages`,
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(404)
  })
})
