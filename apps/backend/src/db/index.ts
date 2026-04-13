import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool, types } from 'pg'
import * as schema from './schema'

// pg 드라이버가 TIMESTAMPTZ를 문자열로 반환하도록 설정
// Drizzle/Fastify가 직렬화할 때 올바른 UTC 변환이 이루어지도록 함
const TIMESTAMPTZ_OID = 1184
const TIMESTAMP_OID = 1114
types.setTypeParser(TIMESTAMPTZ_OID, (val: string) => {
  // pg는 "2026-04-07 11:12:53.047913+09" 형태로 반환
  // new Date()에 이 문자열을 그대로 넘기면 +09를 인식함
  return new Date(val.replace(' ', 'T'))
})
types.setTypeParser(TIMESTAMP_OID, (val: string) => {
  return new Date(val.replace(' ', 'T'))
})

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  options: '-c timezone=UTC',
  max: 20,
})

export const db = drizzle(pool, { schema })
export { pool }
