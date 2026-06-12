// Re-snap every major page in the current state so we can compare against
// docs/baseline/v1 (frozen) and see where the editorial-premium pass has
// landed vs. what still carries V1 patterns.
//
//   PORT=3099 npx next dev --port 3099 &
//   node scripts/snapshot-current.mjs

import { chromium } from "@playwright/test";
import path from "node:path";
import fs from "node:fs/promises";

const PORT = process.env.PORT ?? "3099";
const BASE = `http://localhost:${PORT}`;
const OUT  = path.resolve("docs/baseline/current");

// Mobile-first viewport so this is comparable to docs/baseline/v1/*.png.
const VIEWPORT = { width: 393, height: 852 };

const AUTHED_PAGES = [
  ["dashboard",         "/dashboard"],
  ["nutrition",         "/nutrition"],
  ["coach",             "/coach"],
  ["program",           "/program"],
  ["program-library",   "/program/library"],
  ["learn",             "/learn"],
  ["progress",          "/progress"],
  ["accountability",    "/accountability"],
  ["calendar",          "/calendar"],
  ["my-clients",        "/my-clients"],
  ["admin",             "/admin"],
  ["admin-invites",     "/admin/invites"],
  ["pricing",           "/pricing"],
  ["settings",          "/settings"],
  ["settings-billing",  "/settings/billing"],
  ["profile-master",    "/profile/master"],
];

const ANON_PAGES = [
  ["login",             "/login"],
  ["welcome",           "/welcome"],
  ["onboarding-welcome","/onboarding/welcome"],
  ["privacy",           "/privacy"],
  ["terms",             "/terms"],
  ["disclaimer",        "/disclaimer"],
];

async function snap(page, slug, route) {
  const url = `${BASE}${route}`;
  process.stdout.write(`  ${slug.padEnd(22)} → ${route}\n`);
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
  } catch {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
  }
  await page.waitForTimeout(1800);
  await page.screenshot({
    path: path.join(OUT, `${slug}.png`),
    fullPage: true,
  });
}

(async () => {
  await fs.mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });

  console.log("Anonymous pages");
  const anon = await ctx.newPage();
  for (const [slug, route] of ANON_PAGES) {
    await snap(anon, slug, route);
  }
  await anon.close();

  console.log("Authed pages (demo master)");
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem("flowstate-active-role", "master");
      sessionStorage.setItem("flowstate-session-role", "master");
    } catch {}
  });
  const page = await ctx.newPage();
  for (const [slug, route] of AUTHED_PAGES) {
    await snap(page, slug, route);
  }
  await page.close();

  await browser.close();
  console.log(`\nDone → ${OUT}`);
})();
