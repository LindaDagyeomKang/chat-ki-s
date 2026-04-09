/**
 * ROO-18: docker-compose 기반 통합 테스트 (Integration Test Suite)
 *
 * Runs against a live backend at BASE_URL (default: http://localhost:4099).
 * Auth + Chat scenarios required to pass per acceptance criteria.
 */

const BASE_URL = process.env.TEST_BASE_URL ?? 'http://localhost:4099'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyBody = any

async function post(path: string, body: unknown, token?: string): Promise<{ status: number; body: AnyBody }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  return { status: res.status, body: await res.json() as AnyBody }
}

async function get(path: string, token?: string): Promise<{ status: number; body: AnyBody }> {
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${BASE_URL}${path}`, { headers })
  return { status: res.status, body: await res.json() as AnyBody }
}

describe('[INT] Health check', () => {
  it('GET /health → 200 { status: ok }', async () => {
    const { status, body } = await get('/health')
    expect(status).toBe(200)
    expect(body.status).toBe('ok')
  })
})

describe('[INT] Auth – POST /api/auth/login', () => {
  it('INT-AUTH-01: valid credentials → 200 + accessToken', async () => {
    const { status, body } = await post('/api/auth/login', {
      employeeId: 'TEST001',
      password: 'testpass123',
    })
    expect(status).toBe(200)
    expect(body.accessToken).toBeDefined()
    expect(typeof body.accessToken).toBe('string')
    expect(body.user.employeeId).toBe('TEST001')
    expect(body.user).not.toHaveProperty('passwordHash')
  })

  it('INT-AUTH-02: wrong password → 401', async () => {
    const { status, body } = await post('/api/auth/login', {
      employeeId: 'TEST001',
      password: 'wrongpassword',
    })
    expect(status).toBe(401)
    expect(body.error).toBe('Invalid credentials')
  })

  it('INT-AUTH-03: unknown employeeId → 401', async () => {
    const { status, body } = await post('/api/auth/login', {
      employeeId: 'NOBODY999',
      password: 'testpass123',
    })
    expect(status).toBe(401)
    expect(body.error).toBe('Invalid credentials')
  })

  it('INT-AUTH-04: missing fields → 400', async () => {
    const { status } = await post('/api/auth/login', {})
    expect(status).toBe(400)
  })
})

describe('[INT] Auth – GET /api/users/me', () => {
  let token: string

  beforeAll(async () => {
    const { body } = await post('/api/auth/login', {
      employeeId: 'TEST001',
      password: 'testpass123',
    })
    token = body.accessToken
  })

  it('INT-AUTH-05: valid token → 200 + user profile', async () => {
    const { status, body } = await get('/api/users/me', token)
    expect(status).toBe(200)
    expect(body.employeeId).toBe('TEST001')
    expect(body).not.toHaveProperty('passwordHash')
  })

  it('INT-AUTH-06: no token → 401', async () => {
    const { status } = await get('/api/users/me')
    expect(status).toBe(401)
  })

  it('INT-AUTH-07: invalid token → 401', async () => {
    const { status } = await get('/api/users/me', 'invalid.token.here')
    expect(status).toBe(401)
  })
})

describe('[INT] Auth – POST /api/auth/refresh', () => {
  let token: string

  beforeAll(async () => {
    const { body } = await post('/api/auth/login', {
      employeeId: 'TEST001',
      password: 'testpass123',
    })
    token = body.accessToken
  })

  it('INT-AUTH-08: valid token → new accessToken', async () => {
    const { status, body } = await post('/api/auth/refresh', {}, token)
    expect(status).toBe(200)
    expect(body.accessToken).toBeDefined()
  })

  it('INT-AUTH-09: no token → 401', async () => {
    const { status } = await post('/api/auth/refresh', {})
    expect(status).toBe(401)
  })
})

describe('[INT] Chat – POST /api/chat', () => {
  let token: string

  beforeAll(async () => {
    const { body } = await post('/api/auth/login', {
      employeeId: 'TEST001',
      password: 'testpass123',
    })
    token = body.accessToken
  })

  it('INT-CHAT-01: authenticated question → 200 + answer + chatLogId', async () => {
    const { status, body } = await post(
      '/api/chat',
      { question: '연차 신청 방법을 알려주세요' },
      token
    )
    expect(status).toBe(200)
    expect(body.chatLogId).toBeDefined()
    expect(typeof body.answer).toBe('string')
    expect(body.answer.length).toBeGreaterThan(0)
    expect(Array.isArray(body.sources)).toBe(true)
    expect(body.createdAt).toBeDefined()
  }, 15000)

  it('INT-CHAT-02: chat without auth → 401', async () => {
    const { status } = await post('/api/chat', { question: '안녕하세요' })
    expect(status).toBe(401)
  })

  it('INT-CHAT-03: empty question → 400', async () => {
    const { status } = await post('/api/chat', { question: '' }, token)
    expect(status).toBe(400)
  })

  it('INT-CHAT-04: missing question field → 400', async () => {
    const { status } = await post('/api/chat', {}, token)
    expect(status).toBe(400)
  })

  it('INT-CHAT-05: second question → independent chatLogId', async () => {
    const r1 = await post('/api/chat', { question: '복리후생 안내' }, token)
    const r2 = await post('/api/chat', { question: '사내 식당 운영 시간' }, token)
    expect(r1.status).toBe(200)
    expect(r2.status).toBe(200)
    expect(r1.body.chatLogId).not.toBe(r2.body.chatLogId)
  }, 15000)
})

describe('[INT] Conversations', () => {
  let token: string

  beforeAll(async () => {
    const { body } = await post('/api/auth/login', {
      employeeId: 'TEST001',
      password: 'testpass123',
    })
    token = body.accessToken
  })

  it('INT-CONV-01: create conversation → 201', async () => {
    const { status, body } = await post(
      '/api/conversations',
      { title: '통합 테스트 대화' },
      token
    )
    expect(status).toBe(201)
    expect(body.id).toBeDefined()
    expect(body.title).toBe('통합 테스트 대화')
  })

  it('INT-CONV-02: list conversations → 200 + array', async () => {
    const { status, body } = await get('/api/conversations', token)
    expect(status).toBe(200)
    expect(Array.isArray(body)).toBe(true)
  })
})
