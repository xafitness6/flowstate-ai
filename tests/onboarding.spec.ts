import { test, expect } from '@playwright/test';

// Walk a real invite link and record the whole thing as video.
//
// Run it against the LIVE deploy with a real invite token:
//   PLAYWRIGHT_BASE_URL=https://flowstate-ai-pi.vercel.app \
//   INVITE_PATH=/invite/PUT_REAL_TOKEN_HERE \
//   npx playwright test onboarding --headed
//
// Then watch the recording:  npx playwright show-report
// (every step has a screenshot + a playable video of the run)

const INVITE_PATH = process.env.INVITE_PATH;

test('open invite link and reach onboarding', async ({ page }) => {
  test.skip(!INVITE_PATH, 'Set INVITE_PATH=/invite/<token> to run this.');

  await page.goto(INVITE_PATH!);
  await page.screenshot({ path: 'test-results/01-invite-landing.png', fullPage: true });

  // The invite landing should offer account creation, not a 404 / error.
  await expect(page.locator('body')).toBeVisible();
  await expect(page).not.toHaveTitle(/error|not found/i);

  // From here it needs your input (email/password). Pausing opens the
  // Playwright Inspector so you can drive it by hand while video records.
  await page.pause();
});
