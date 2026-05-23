import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

function readEnv() {
  const envPath = path.join(process.cwd(), '.env.local');
  const values: Record<string, string> = {};
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
      const index = trimmed.indexOf('=');
      values[trimmed.slice(0, index)] = trimmed.slice(index + 1);
    }
  }
  return { ...values, ...process.env };
}

function requireSupabaseAdmin() {
  const env = readEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  test.skip(!url || !serviceRoleKey, 'Supabase admin env is required for the real email-link test.');

  return createClient(url!, serviceRoleKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

test('reset page keeps password form visible when Supabase reports an expired hash link', async ({ page }) => {
  await page.goto(
    '/reset-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
  );

  await expect(page.locator('input[autocomplete="new-password"]').first()).toBeVisible();
  await expect(page.locator('input[autocomplete="new-password"]').nth(1)).toBeVisible();
  await expect(page.getByRole('button', { name: /update password/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /request a new link/i })).toHaveCount(0);
});

test('real Supabase email action link reaches password form and updates password', async ({ page, baseURL }) => {
  const admin = requireSupabaseAdmin();
  const email = `playwright-reset-${Date.now()}@example.com`;
  let userId: string | null = null;

  try {
    const created = await admin.auth.admin.createUser({
      email,
      password: 'OldPass123!',
      email_confirm: true,
    });
    if (created.error) throw created.error;
    userId = created.data.user.id;

    const link = await admin.auth.admin.generateLink({ type: 'recovery', email });
    if (link.error) throw link.error;

    // This is what clicking the email does: hit Supabase's one-time action
    // URL, receive a redirect with the password session in the hash, then land
    // on the app's reset page.
    const response = await fetch(link.data.properties.action_link, { redirect: 'manual' });
    const location = response.headers.get('location');
    if (!location) throw new Error(`Supabase action link did not redirect. status=${response.status}`);

    const hash = new URL(location).hash;
    const target = new URL('/reset-password', baseURL ?? 'http://localhost:3000');
    await page.goto(`${target.toString()}${hash}`);

    const passwordInputs = page.locator('input[autocomplete="new-password"]');
    await expect(passwordInputs.first()).toBeVisible();
    await expect(passwordInputs.nth(1)).toBeVisible();

    await passwordInputs.first().fill('NewPass123!');
    await passwordInputs.nth(1).fill('NewPass123!');
    await page.getByRole('button', { name: /update password/i }).click();

    await expect(page.getByRole('heading', { name: /password updated/i })).toBeVisible();
  } finally {
    if (userId) await admin.auth.admin.deleteUser(userId).catch(() => {});
  }
});

test('app-owned token reset path submits through Flowstate API', async ({ page }) => {
  await page.route('**/api/auth/password-reset/complete', async (route) => {
    const body = route.request().postDataJSON() as { token?: string; password?: string };
    expect(body.token).toBe('test-token');
    expect(body.password).toBe('NewPass123!');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.goto('/reset-password?token=test-token');

  const passwordInputs = page.locator('input[autocomplete="new-password"]');
  await expect(passwordInputs.first()).toBeVisible();
  await expect(passwordInputs.nth(1)).toBeVisible();

  await passwordInputs.first().fill('NewPass123!');
  await passwordInputs.nth(1).fill('NewPass123!');
  await page.getByRole('button', { name: /update password/i }).click();

  await expect(page.getByRole('heading', { name: /password updated/i })).toBeVisible();
});
