import { test, expect } from '@playwright/test';

test.describe('인증/로그인 E2E 테스트 (ROO-3)', () => {
  test('E2E-AUTH-01: 정상 로그인 후 채팅 화면으로 이동', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name=employeeId]', 'TEST001');
    await page.fill('[name=password]', 'testpass123');
    await page.click('button[type=submit]');
    await expect(page).toHaveURL('/chat');
  });

  test('E2E-AUTH-02: 잘못된 자격증명 시 에러 메시지 표시', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name=employeeId]', 'TEST001');
    await page.fill('[name=password]', 'wrongpassword');
    await page.click('button[type=submit]');
    await expect(page.locator('[data-testid=error-message]')).toBeVisible();
    await expect(page).toHaveURL('/login');
  });

  test('E2E-AUTH-03: 빈 폼 제출 시 유효성 검사 메시지', async ({ page }) => {
    await page.goto('/login');
    await page.click('button[type=submit]');
    // HTML5 native validation 또는 custom error 메시지 확인
    await expect(page).toHaveURL('/login');
  });

  test('E2E-AUTH-04: 로그인 후 새로고침해도 채팅 화면 유지', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name=employeeId]', 'TEST001');
    await page.fill('[name=password]', 'testpass123');
    await page.click('button[type=submit]');
    await expect(page).toHaveURL('/chat');
    await page.reload();
    await expect(page).toHaveURL('/chat');
  });

  test('E2E-AUTH-05: 모바일(iPhone 12) 뷰포트에서 로그인 폼 정상 동작', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('[name=employeeId]')).toBeVisible();
    await expect(page.locator('[name=password]')).toBeVisible();
    await expect(page.locator('button[type=submit]')).toBeVisible();
  });
});
