/**
 * Jest 전역 테스트 설정
 *
 * NOTE: Fastify app을 testable하게 만들려면 apps/backend/src/app.ts에
 * buildApp() factory 함수를 분리해야 합니다.
 * 현재 src/index.ts에서 직접 start()를 호출하므로 리팩토링이 필요합니다.
 *
 * 예시:
 *   export async function buildApp(opts = {}) {
 *     const app = Fastify(opts)
 *     await app.register(authPlugin)
 *     await app.register(authRoutes)
 *     return app
 *   }
 */

// 테스트용 환경변수 설정
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/chat_ki_s_test';
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.JWT_EXPIRES_IN = '1h';
