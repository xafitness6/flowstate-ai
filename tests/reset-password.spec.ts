import { test, expect } from '@playwright/test';

test('reset page uses email code form, not Supabase auto-login link state', async ({ page }) => {
  await page.goto(
    '/reset-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
  );

  await expect(page.getByText(/enter the code from your email/i)).toBeVisible();
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[autocomplete="one-time-code"]')).toBeVisible();
  await expect(page.locator('input[autocomplete="new-password"]').first()).toBeVisible();
  await expect(page.locator('input[autocomplete="new-password"]').nth(1)).toBeVisible();
  await expect(page.getByRole('button', { name: /request a new link/i })).toHaveCount(0);
});

test('code reset path submits through Flowstate API', async ({ page }) => {
  await page.route('**/api/auth/password-reset/complete', async (route) => {
    const body = route.request().postDataJSON() as {
      email?: string;
      code?: string;
      password?: string;
    };
    expect(body.email).toBe('member@example.com');
    expect(body.code).toBe('123456');
    expect(body.password).toBe('NewPass123!');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.goto('/reset-password?email=member%40example.com');

  await page.locator('input[autocomplete="one-time-code"]').fill('123456');
  const passwordInputs = page.locator('input[autocomplete="new-password"]');
  await passwordInputs.first().fill('NewPass123!');
  await passwordInputs.nth(1).fill('NewPass123!');
  await page.getByRole('button', { name: /update password/i }).click();

  await expect(page.getByRole('heading', { name: /password updated/i })).toBeVisible();
});

test('forgot password requests an email code and links to code entry', async ({ page }) => {
  await page.route('**/api/auth/password-reset/request', async (route) => {
    const body = route.request().postDataJSON() as { email?: string };
    expect(body.email).toBe('member@example.com');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, emailSent: true }),
    });
  });

  await page.goto('/forgot-password');
  await page.locator('input[type="email"]').fill('member@example.com');
  await page.getByRole('button', { name: /send reset link|send reset code/i }).click();

  await expect(page.getByRole('heading', { name: /check your email/i })).toBeVisible();
});
