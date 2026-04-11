import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { readFileSync } from 'fs'
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
  } finally {
    await pool.end()
  }
}
