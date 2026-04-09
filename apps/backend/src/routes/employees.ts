import { FastifyInstance } from 'fastify'
import { db } from '../db'
import { employees, users } from '../db/schema'
import { eq, ilike, or, sql } from 'drizzle-orm'

// 임원 직급
const EXECUTIVE_RANKS = ['사장', '부사장', '전무', '상무', '이사']

// 민감정보 제거 (전체 공통)
function removeSensitive(emp: any) {
  const { birthDate, mbti, gender, ...safe } = emp
  return safe
}

// 타 부문: 기본 정보만
function basicInfoOnly(emp: any) {
  return {
    name: emp.name,
    division: emp.division,
    team: emp.team,
    rank: emp.rank,
    position: emp.position,
    email: emp.email,
  }
}

// 임원: 비서실 안내
function executiveRedact(emp: any) {
  return {
    name: emp.name,
    rank: emp.rank,
    position: emp.position,
    division: emp.division,
    email: null,
    phone: null,
    duty: null,
    notice: '임원 연락은 비서실(내선 1000, secretary@kiwoom.com)을 통해 문의해 주세요.',
  }
}

// 요청자의 부문 조회
async function getUserDivision(userId: string): Promise<string | null> {
  // users 테이블에서 부서 조회 → employees 테이블에서 부문 매칭
  const userRows = await db.select().from(users).where(eq(users.id, userId))
  if (!userRows.length) return null
  const empRows = await db.select().from(employees).where(eq(employees.name, userRows[0].name)).limit(1)
  return empRows.length ? empRows[0].division : null
}

// 접근 제어 적용
function applyAccessControl(results: any[], myDivision: string | null) {
  return results.map((emp) => {
    // 임원 → 비서실 안내
    if (EXECUTIVE_RANKS.includes(emp.rank)) {
      return executiveRedact(emp)
    }
    // 같은 부문 → 민감정보만 제거
    if (myDivision && emp.division === myDivision) {
      return removeSensitive(emp)
    }
    // 타 부문 → 기본 정보만
    return basicInfoOnly(emp)
  })
}

export async function employeeRoutes(app: FastifyInstance) {
  // 임직원 검색
  app.get<{ Querystring: { q?: string; team?: string; division?: string } }>(
    '/api/employees/search',
    { preHandler: [app.authenticate] },
    async (request) => {
      const { sub } = request.user as { sub: string }
      const { q, team, division } = request.query
      const myDivision = await getUserDivision(sub)

      let results: any[] = []

      if (q) {
        const pattern = `%${q}%`
        results = await db.select().from(employees).where(
          sql`name ILIKE ${pattern} OR team ILIKE ${pattern} OR duty ILIKE ${pattern} OR division ILIKE ${pattern} OR position ILIKE ${pattern}`
        ).orderBy(
          sql`CASE
            WHEN team ILIKE ${pattern} THEN 0
            WHEN division ILIKE ${pattern} THEN 1
            WHEN name ILIKE ${pattern} THEN 2
            ELSE 3
          END`,
          sql`CASE WHEN position IS NOT NULL AND position != '-' THEN 0 ELSE 1 END`
        ).limit(50)
      } else if (team) {
        results = await db.select().from(employees).where(sql`team ILIKE ${'%' + team + '%'}`).limit(50)
      } else if (division) {
        results = await db.select().from(employees).where(sql`division ILIKE ${'%' + division + '%'}`).limit(100)
      }

      return applyAccessControl(results, myDivision)
    }
  )

  // 부문/팀 목록 조회
  app.get<{ Querystring: { division?: string } }>(
    '/api/employees/teams',
    { preHandler: [app.authenticate] },
    async (request) => {
      const { division } = request.query
      if (division) {
        const teams = await db.select({ team: employees.team }).from(employees)
          .where(sql`division ILIKE ${'%' + division + '%'} AND team IS NOT NULL`)
          .groupBy(employees.team)
        return teams.map((t: any) => t.team).filter(Boolean).sort()
      }
      const teams = await db.select({ team: employees.team }).from(employees)
        .where(sql`team IS NOT NULL`)
        .groupBy(employees.team)
      return teams.map((t: any) => t.team).filter(Boolean).sort()
    }
  )

  // 부문 목록 조회
  app.get('/api/employees/divisions', { preHandler: [app.authenticate] }, async () => {
    const divs = await db.select({ division: employees.division }).from(employees)
      .where(sql`division IS NOT NULL`)
      .groupBy(employees.division)
    return divs.map((d: any) => d.division).filter(Boolean).sort()
  })

  // 전체 주소록 (페이징)
  app.get<{ Querystring: { page?: string; limit?: string } }>(
    '/api/employees',
    { preHandler: [app.authenticate] },
    async (request) => {
      const { sub } = request.user as { sub: string }
      const myDivision = await getUserDivision(sub)

      const page = parseInt(request.query.page ?? '1')
      const limit = Math.min(parseInt(request.query.limit ?? '50'), 100)
      const offset = (page - 1) * limit

      const results = await db.select().from(employees).limit(limit).offset(offset)
      const countResult = await db.select({ count: sql<number>`count(*)` }).from(employees)
      const total = countResult[0]?.count ?? 0

      return { data: applyAccessControl(results, myDivision), total, page, limit }
    }
  )
}
