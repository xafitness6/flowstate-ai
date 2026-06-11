// Snap the dashboard at a true desktop viewport so we can see what the
// editorial column looks like with the full canvas available.

import { chromium } from "@playwright/test";
import path from "node:path";
import fs from "node:fs/promises";

const PORT = process.env.PORT ?? "3099";
const BASE = `http://localhost:${PORT}`;
const OUT  = path.resolve("docs/baseline/v2-dashboard");

await fs.mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1.5,
});
await ctx.addInitScript(() => {
  try {
    localStorage.setItem("flowstate-active-role", "master");
    sessionStorage.setItem("flowstate-session-role", "master");
  } catch {}
});
const page = await ctx.newPage();
console.log("dashboard (desktop master)");
try {
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle", timeout: 30_000 });
} catch {
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: 30_000 });
}
await page.waitForTimeout(2000);
await page.screenshot({ path: path.join(OUT, "dashboard-desktop-1440.png"), fullPage: true });

await browser.close();
console.log(`Done → ${OUT}/dashboard-desktop-1440.png`);
