/**
 * Route-health smoke test — loads every major customer-facing page in a real
 * headless browser and asserts: reachable, no error boundary in the RENDERED
 * DOM (not raw HTML — the error fallback ships in the bundle), and non-empty
 * content. Catches stale shells / crashes that node-fetch can't see.
 *
 * Usage: BASE=http://127.0.0.1:3000 node scripts/route-health.mjs
 */
import { chromium } from "@playwright/test";

const BASE = process.env.BASE || "http://127.0.0.1:3000";
const USER = process.env.MC_SMOKE_USER || "walt";
const PASS = process.env.MC_SMOKE_PASS || "BaselineLocalDev2026!";

const PUBLIC_ROUTES = ["/", "/signup", "/login", "/marketplace", "/flight-deck", "/pricing"];
const APP_ROUTES = [
  "/onboarding", "/app", "/app/activate", "/app/credentials", "/app/runtimes",
  "/app/billing", "/app/orchestration", "/app/value", "/app/personas",
  "/app/tasks", "/app/approvals", "/app/skills", "/app/creative", "/app/higgsfield",
];
const CRASH_MARKERS = ["Something went wrong", "Application error", "Unhandled Runtime Error", "client-side exception"];

const b = await chromium.launch();
const ctx = await b.newContext();
// Authenticate for /app/* routes.
await ctx.request.post(`${BASE}/api/auth/login`, { data: { username: USER, password: PASS } }).catch(() => {});
const p = await ctx.newPage();

const results = [];
for (const path of [...PUBLIC_ROUTES, ...APP_ROUTES]) {
  let status = 0, ok = false, note = "";
  try {
    const resp = await p.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => null);
    status = resp ? resp.status() : 0;
    await p.waitForTimeout(2500);
    const text = (await p.locator("body").innerText().catch(() => "")) || "";
    const crash = CRASH_MARKERS.find((m) => text.includes(m));
    const hasContent = text.trim().length > 40;
    const finalUrl = new URL(p.url()).pathname;
    // a redirect to /login or /verify-email is a healthy guard, not a crash
    const redirected = finalUrl !== path && (finalUrl.startsWith("/login") || finalUrl.startsWith("/verify-email"));
    ok = !crash && (hasContent || redirected);
    note = crash ? `CRASH: ${crash}` : redirected ? `→ ${finalUrl}` : !hasContent ? "BLANK" : "";
  } catch (e) {
    note = `ERR: ${e.message}`;
  }
  results.push({ path, status, ok, note });
}
await b.close();

let pass = 0;
for (const r of results) {
  console.log(`${r.ok ? "✅" : "❌"} ${r.path.padEnd(22)} ${r.note}`);
  if (r.ok) pass += 1;
}
console.log(`\nroute-health: ${pass}/${results.length} OK`);
process.exit(pass === results.length ? 0 : 1);
