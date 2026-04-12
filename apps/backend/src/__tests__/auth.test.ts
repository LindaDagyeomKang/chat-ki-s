import Fastify, { FastifyInstance } from 'fastify'
import fastifyJwt from '@fastify/jwt'
import fastifyCookie from '@fastify/cookie'
import { authRoutes } from '../routes/auth'
import { chatRoutes } from '../routes/chat'

// Mock the database module
jest.mock('../db', () => ({
  db: {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
  },
}))

const { db } = require('../db')

const TEST_USER = {
  id: '00000000-0000-0000-0000-000000000001',
  employeeId: 'EMP001',
  name: 'Test User',
  email: 'test@example.com',
  department: 'Engineering',
  passwordHash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08', // sha256('test')
  createdAt: new Date('2026-01-01T00:00:00Z'),
}

function buildApp(): FastifyInstance {
  const app = Fastify({ logger: false })

  app.register(fastifyJwt, { secret: 'test-secret' })

  app.decorate('authenticate', async function (request: any, reply: any) {
    try {
      await request.jwtVerify()
    } catch (err) {
      reply.send(err)
    }
  })

  app.register(fastifyCookie)
  app.register(authRoutes)
  app.register(chatRoutes)

  return app
}

describe('POST /api/auth/login', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    app = buildApp()
    await app.ready()
  })

  afterEach(async () => {
    await app.close()
    jest.clearAllMocks()
  })

  it('returns 401 for unknown employeeId', async () => {
    db.limit.mockResolvedValueOnce([])

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { employeeId: 'UNKNOWN', password: 'test' },
    })

    expect(res.statusCode).toBe(401)
    expect(JSON.parse(res.body)).toEqual({ error: 'Invalid credentials' })
  })

  it('returns 401 for wrong password', async () => {
    db.limit.mockResolvedValueOnce([TEST_USER])

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { employeeId: 'EMP001', password: 'wrong' },
    })

    expect(res.statusCode).toBe(401)
    expect(JSON.parse(res.body)).toEqual({ error: 'Invalid credentials' })
  })

  it('returns accessToken and user on valid credentials', async () => {
    db.limit.mockResolvedValueOnce([TEST_USER])

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { employeeId: 'EMP001', password: 'test' },
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.accessToken).toBeDefined()
    expect(body.user.employeeId).toBe('EMP001')
    expect(body.user).not.toHaveProperty('passwordHash')
  })
})

describe('GET /api/users/me', () => {
  let app: FastifyInstance
  let token: string

  beforeEach(async () => {
    app = buildApp()
    await app.ready()
    token = app.jwt.sign({ sub: TEST_USER.id, employeeId: TEST_USER.employeeId })
  })

  afterEach(async () => {
    await app.close()
    jest.clearAllMocks()
  })

  it('returns 401 without token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/users/me' })
    expect(res.statusCode).toBe(401)
  })

  it('returns user profile with valid token', async () => {
    db.limit.mockResolvedValueOnce([TEST_USER])

    const res = await app.inject({
      method: 'GET',
      url: '/api/users/me',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.id).toBe(TEST_USER.id)
    expect(body.employeeId).toBe('EMP001')
    expect(body).not.toHaveProperty('passwordHash')
  })

  it('returns 404 when user no longer exists', async () => {
    db.limit.mockResolvedValueOnce([])

    const res = await app.inject({
      method: 'GET',
      url: '/api/users/me',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(404)
  })
})

describe('POST /api/auth/refresh', () => {
  let app: FastifyInstance
  let token: string

  beforeEach(async () => {
    app = buildApp()
    await app.ready()
    token = app.jwt.sign({ sub: TEST_USER.id, employeeId: TEST_USER.employeeId })
  })

  afterEach(async () => {
    await app.close()
    jest.clearAllMocks()
  })

  it('returns new accessToken with valid token', async () => {
    db.limit.mockResolvedValueOnce([TEST_USER])

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.accessToken).toBeDefined()
  })

  it('returns 401 without token', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/auth/refresh' })
    expect(res.statusCode).toBe(401)
  })
})
