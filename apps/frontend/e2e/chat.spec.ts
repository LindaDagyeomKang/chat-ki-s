import { test, expect } from '@playwright/test';

test.describe('채팅 UI E2E 테스트 (ROO-4)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name=employeeId]', 'TEST001');
    await page.fill('[name=password]', 'testpass123');
    await page.click('button[type=submit]');
    await expect(page).toHaveURL('/chat');
  });

  test('E2E-CHAT-01: 메시지 전송 시 채팅 목록에 표시', async ({ page }) => {
    await page.fill('[data-testid=chat-input]', '연차 신청 방법 알려줘');
    await page.press('[data-testid=chat-input]', 'Enter');
    await expect(page.locator('[data-testid=message-user]').last()).toContainText('연차 신청 방법');
  });

  test('E2E-CHAT-02: AI 응답 수신 시 메시지 표시', async ({ page }) => {
    await page.fill('[data-testid=chat-input]', '안녕하세요');
    await page.press('[data-testid=chat-input]', 'Enter');
    // 로딩 인디케이터 나타났다가 사라짐
    await expect(page.locator('[data-testid=message-ai]').last()).toBeVisible({ timeout: 10000 });
  });

  test('E2E-CHAT-03: 여러 메시지 후 자동 스크롤', async ({ page }) => {
    for (let i = 0; i < 5; i++) {
      await page.fill('[data-testid=chat-input]', `테스트 메시지 ${i + 1}`);
      await page.press('[data-testid=chat-input]', 'Enter');
      await page.waitForTimeout(300);
    }
    // 마지막 메시지가 뷰포트 내에 있는지 확인
    const lastMsg = page.locator('[data-testid=message-user]').last();
    await expect(lastMsg).toBeInViewport();
  });

  test('E2E-CHAT-05: 비로그인 접근 시 /login으로 리다이렉트', async ({ page }) => {
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
    await page.goto('/chat');
    await expect(page).toHaveURL('/login');
  });
});
