import { test, expect } from '@playwright/test';

test('equipment skip uses a safe default and continues even if server save fails', async ({ page }) => {
  await page.addInitScript(() => {
    const userId = '11111111-1111-4111-8111-111111111111';
    window.localStorage.setItem('flowstate-active-role', userId);
    window.sessionStorage.setItem('flowstate-session-role', userId);
  });

  await page.route('**/api/onboarding/starter-complete', async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Simulated program save failure' }),
    });
  });

  await page.goto('/onboarding/calibration');

  await page.getByRole('button', { name: /build muscle/i }).click();
  await expect(page.getByRole('heading', { name: /training experience/i })).toBeVisible();

  await page.getByRole('button', { name: /just starting out/i }).click();
  await expect(page.getByRole('heading', { name: /how much time/i })).toBeVisible();

  await page.getByRole('button', { name: /continue/i }).click();
  await expect(page.getByRole('heading', { name: /how do you usually eat/i })).toBeVisible();

  await page.getByRole('button', { name: /continue/i }).click();
  await expect(page.getByRole('heading', { name: /what should the ai watch for/i })).toBeVisible();

  await page.getByRole('button', { name: /^consistency$/i }).click();
  await page.getByRole('button', { name: /continue/i }).click();
  await expect(page.getByRole('heading', { name: /what equipment do you have/i })).toBeVisible();

  await page.getByRole('button', { name: /skip/i }).click();

  await expect(page).toHaveURL(/\/onboarding\/tutorial/);
  await expect(page.getByText(/something interrupted setup/i)).toHaveCount(0);
});
