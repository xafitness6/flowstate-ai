import { test, expect } from '@playwright/test';

// Smoke tests — prove the app boots and key public pages render.
// Run visually with:  npx playwright test --ui
// These intentionally avoid fragile selectors so they don't flake; they
// just confirm the pages load and aren't a Next error screen.

test('login page loads', async ({ page }) => {
  await page.goto('/login');
  // The Next error overlay would say "Application error" / "500".
  await expect(page.locator('body')).toBeVisible();
  await expect(page).not.toHaveTitle(/error/i);
  // Leave a screenshot in the report so you can see what rendered.
  await page.screenshot({ path: 'test-results/login.png', fullPage: true });
});

test('root redirects somewhere sensible (not a crash)', async ({ page }) => {
  const res = await page.goto('/');
  expect(res?.status()).toBeLessThan(500);
  // No-session users should end up on /login.
  await page.waitForURL(/\/(login|onboarding|welcome)?$/, { timeout: 15_000 });
});

// NEXT STEP (uncomment + fill in once you've recorded it with codegen):
// test('invite → calibration flow', async ({ page }) => {
//   await page.goto('/invite/PUT-A-REAL-TOKEN-HERE');
//   ...
// });
