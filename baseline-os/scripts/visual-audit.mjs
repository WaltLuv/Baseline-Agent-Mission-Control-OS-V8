/**
 * Baseline OS visual audit — screenshots every major route and asserts the
 * identity system is actually present in the rendered DOM:
 *   · Mansa V2 identity   (gold/indigo HUD surfaces, Sankoré crest)
 *   · Graphify awareness  ([data-testid="graphify-awareness"])
 *   · Identity header     ([data-testid="agent-identity-header"])
 *   · Collapsible nav     ([data-testid^="sidebar-section-toggle-"])
 * Saves PNGs to docs/audit/os-visual/ and prints a pass/fail matrix.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://127.0.0.1:5173";
const OUT = "docs/audit/os-visual";
mkdirSync(OUT, { recursive: true });

const ROUTES = [
  { path: "/", name: "home", expect: ["mansa", "graphify", "nav"] },
  { path: "/flight-deck", name: "flight-deck", expect: ["graphify", "nav"] },
  { path: "/agents/hermes", name: "hermes", expect: ["identity", "graphify", "nav"] },
  { path: "/agents/ruflo", name: "pi-agent", expect: ["identity", "graphify", "nav"] },
  { path: "/agents/gemini", name: "gemini", expect: ["identity", "nav"] },
  { path: "/agents/codex", name: "codex", expect: ["identity", "nav"] },
  { path: "/agents/openclaw", name: "openclaw", expect: ["identity", "graphify", "nav"] },
  { path: "/agents/claude-code", name: "claude-code", expect: ["identity", "graphify", "nav"] },
  { path: "/agents/notebooklm", name: "notebooklm", expect: ["identity", "graphify", "nav"] },
  { path: "/agents/antigravity", name: "antigravity", expect: ["identity", "graphify", "nav"] },
  { path: "/agents/free-claude", name: "coding-agent", expect: ["identity", "graphify", "nav"] },
  { path: "/agents/hermes-mcp", name: "hermes-mcp", expect: ["identity", "graphify", "nav"] },
  { path: "/agents/pi-runtime", name: "pi-runtime", expect: ["identity", "graphify", "nav"] },
  { path: "/maestro", name: "maestro", expect: ["graphify", "nav"] },
  { path: "/personas", name: "agent-factory", expect: ["graphify", "nav"] },
  { path: "/memory", name: "knowledge-os", expect: ["graphify", "nav"] },
  { path: "/graphify", name: "graphify", expect: ["nav"] },
];

const SEL = {
  identity: '[data-testid="agent-identity-header"]',
  graphify: '[data-testid="graphify-awareness"]',
  nav: '[data-testid^="sidebar-section-toggle-"]',
  mansa: '[data-testid="baseline-system-map"], [data-testid="home-graphify-card"]',
};

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const rows = [];

for (const r of ROUTES) {
  const res = { route: r.path, name: r.name };
  try {
    await page.goto(`${BASE}${r.path}`, { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(1200); // let graphify fetch + render settle
    await page.screenshot({ path: `${OUT}/${r.name}.png`, fullPage: false });
    for (const marker of r.expect) {
      res[marker] = (await page.locator(SEL[marker]).count()) > 0 ? "✓" : "✗ MISSING";
    }
    // verify a section actually toggles (collapsible proof) on the home route only
    if (r.name === "home") {
      const toggle = page.locator('[data-testid="sidebar-section-toggle-tools"]').first();
      const before = await toggle.getAttribute("aria-expanded");
      await toggle.click();
      await page.waitForTimeout(150);
      const after = await toggle.getAttribute("aria-expanded");
      res.collapse = before !== after ? "✓ toggles" : "✗ no-toggle";
    }
    res.shot = `${r.name}.png`;
  } catch (e) {
    res.error = String(e).split("\n")[0].slice(0, 80);
  }
  rows.push(res);
  console.log(JSON.stringify(res));
}

await browser.close();
console.log("\n=== MATRIX ===");
for (const r of rows) {
  console.log(
    `${r.route.padEnd(24)} ${["identity", "graphify", "nav", "mansa", "collapse"].map((k) => (r[k] ? `${k}:${r[k]}` : "")).filter(Boolean).join("  ")}${r.error ? " ERR:" + r.error : ""}`,
  );
}
