import { test, expect } from '@playwright/test';

test('direct protected app URL without a session redirects to login', async ({ page }) => {
  await page.goto('/progress');
  await page.waitForURL(/\/login/, { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
});

test('unauthenticated AI backend calls are rejected', async ({ request }) => {
  const cases = [
    { url: '/api/ai/coach-voice', body: { text: 'read this' } },
    { url: '/api/ai/form-check', body: { exerciseName: 'Squat', frames: ['data:image/jpeg;base64,aaa', 'data:image/jpeg;base64,bbb'] } },
    { url: '/api/ai/coach-avatar', body: { text: 'read this' } },
  ];

  for (const c of cases) {
    const res = await request.post(c.url, { data: c.body });
    expect(res.status(), c.url).toBe(401);
  }
});
