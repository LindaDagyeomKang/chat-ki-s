import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

export async function runMigrations(): Promise<void> {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/chat_ki_s',
  })

  try {
    const db = drizzle(pool)

    // Drizzle Kit이 생성한 마이그레이션 실행
    await migrate(db, { migrationsFolder: join(__dirname, '../../drizzle') })
    console.log('Drizzle migrations complete')

    // Seed data if no users exist or FORCE_RESEED is set
    const { rows } = await pool.query('SELECT id FROM users LIMIT 1')
    if (rows.length === 0 || process.env.FORCE_RESEED === 'true') {
      if (rows.length > 0) {
        await pool.query(`
          DELETE FROM good_answers; DELETE FROM feedback;
          DELETE FROM documents;
          DELETE FROM room_reservations; DELETE FROM meeting_rooms;
          DELETE FROM calendar_events; DELETE FROM survey_responses; DELETE FROM survey_questions;
          DELETE FROM mails; DELETE FROM assignments; DELETE FROM notices;
          DELETE FROM leave_requests; DELETE FROM expenses;
          DELETE FROM messages; DELETE FROM conversations;
          DELETE FROM employees; DELETE FROM users;
        `)
        console.log('Existing data cleared for reseed')
      }
      const seedPath = join(__dirname, 'seed.sql')
      const seedSql = readFileSync(seedPath, 'utf-8')
      await pool.query(seedSql)
      console.log('Seed data loaded from seed.sql')
    }
    // Glossary 자동 적재 (테이블 없으면 생성 + CSV 데이터 적재)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS glossary (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        term VARCHAR(200) NOT NULL,
        description TEXT NOT NULL
      )
    `)
    const { rows: glossaryCount } = await pool.query('SELECT COUNT(*) as cnt FROM glossary')
    if (parseInt(glossaryCount[0].cnt) === 0) {
      const csvPath = join(__dirname, '../../../data/seed_data/금융용어사전.csv')
      if (existsSync(csvPath)) {
        const csvContent = readFileSync(csvPath, 'utf-8').replace(/^\uFEFF/, '') // BOM 제거
        const lines = csvContent.split('\n').slice(1) // 헤더 스킵
        let loaded = 0
        for (const line of lines) {
          if (!line.trim()) continue
          // CSV 파싱: "term","description" 형태
          const match = line.match(/^"?([^"]*)"?\s*,\s*"?([\s\S]*)"?\s*$/)
          if (match && match[1]?.trim()) {
            const term = match[1].trim().replace(/""/g, '"')
            const desc = (match[2] || '').trim().replace(/""/g, '"').replace(/"$/, '')
            if (term && desc) {
              try {
                await pool.query('INSERT INTO glossary (term, description) VALUES ($1, $2) ON CONFLICT DO NOTHING', [term, desc])
                loaded++
              } catch {}
            }
          }
        }
        console.log(`Glossary loaded: ${loaded} terms from CSV`)
      } else {
        console.log('Glossary CSV not found, skipping')
      }
    } else {
      console.log(`Glossary already has ${glossaryCount[0].cnt} terms, skipping`)
    }
  } finally {
    await pool.end()
  }
}
