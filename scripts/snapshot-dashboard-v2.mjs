// One-shot screenshot of the redesigned dashboard for visual diff vs V1.

import { chromium } from "@playwright/test";
import path from "node:path";
import fs from "node:fs/promises";

const PORT = process.env.PORT ?? "3099";
const BASE = `http://localhost:${PORT}`;
const OUT  = path.resolve("docs/baseline/v2-dashboard");
const VIEWPORT = { width: 393, height: 852 };

await fs.mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: VIEWPORT,
  deviceScaleFactor: 2,
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
});
await ctx.addInitScript(() => {
  try {
    localStorage.setItem("flowstate-active-role", "master");
    sessionStorage.setItem("flowstate-session-role", "master");
  } catch {}
});
const page = await ctx.newPage();
console.log("dashboard (master)");
try {
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle", timeout: 30_000 });
} catch {
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: 30_000 });
}
await page.waitForTimeout(2000);
await page.screenshot({ path: path.join(OUT, "dashboard-master.png"), fullPage: true });

console.log("dashboard (member)");
await page.evaluate(() => {
  try {
    localStorage.setItem("flowstate-active-role", "member");
    sessionStorage.setItem("flowstate-session-role", "member");
  } catch {}
});
try {
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle", timeout: 30_000 });
} catch {
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: 30_000 });
}
await page.waitForTimeout(2000);
await page.screenshot({ path: path.join(OUT, "dashboard-member.png"), fullPage: true });

await browser.close();
console.log(`Done → ${OUT}`);
