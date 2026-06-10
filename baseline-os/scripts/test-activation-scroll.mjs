import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const baseUrl = process.env.BASE_URL ?? "http://localhost:8081";
const screenshotDir = process.env.SCREENSHOT_DIR ?? "docs/activation-proof";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

try {
  await mkdir(screenshotDir, { recursive: true });
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("requestfailed", (request) => {
    errors.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? "failed"}`);
  });

  await page.goto(`${baseUrl}/app/activate`, { waitUntil: "networkidle" });
  await page.getByText("Set up your", { exact: false }).waitFor({ timeout: 10_000 });

  const initial = await page.evaluate(() => ({
    bodyOverflow: document.body.style.overflow,
    htmlOverflow: document.documentElement.style.overflow,
    dialogs: document.querySelectorAll('[role="dialog"], [aria-modal="true"]').length,
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight,
    appShell: document.querySelectorAll("aside, header").length,
  }));

  assert(initial.bodyOverflow !== "hidden", "body scroll is locked");
  assert(initial.htmlOverflow !== "hidden", "html scroll is locked");
  assert(initial.dialogs === 0, "activation page mounted a dialog by default");
  assert(initial.scrollHeight > initial.clientHeight, "activation page does not expose document scroll");
  assert(initial.appShell === 0, "activation page is nested inside the dashboard shell");

  await page.mouse.wheel(0, 900);
  await page.getByRole("button", { name: /Start setup/i }).click();
  await page.getByRole("button", { name: /Next/i }).click();

  await page.getByRole("button", { name: /Claude Code/i }).waitFor();
  await page.getByRole("button", { name: /OpenAI Codex/i }).waitFor();
  await page.getByRole("button", { name: /OpenClaw \/ OpenCode/i }).waitFor();
  await page.getByRole("button", { name: /Hermes Agent/i }).waitFor();
  await page.getByRole("button", { name: /Hermes Agent/i }).scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: /Next/i }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${screenshotDir}/activation-desktop.png`, fullPage: true });

  const afterRuntime = await page.evaluate(() => ({
    bodyOverflow: document.body.style.overflow,
    htmlOverflow: document.documentElement.style.overflow,
    dialogs: document.querySelectorAll('[role="dialog"], [aria-modal="true"]').length,
    hermesRect: (() => {
      const candidates = [...document.querySelectorAll("button")];
      const el = candidates.find((button) => button.textContent?.includes("Hermes Agent"));
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, height: rect.height };
    })(),
    nextRect: (() => {
      const candidates = [...document.querySelectorAll("button")];
      const el = candidates.find((button) => button.textContent?.trim().includes("Next"));
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, height: rect.height };
    })(),
    scrollTop: document.documentElement.scrollTop || document.body.scrollTop,
  }));

  assert(afterRuntime.bodyOverflow !== "hidden", "body scroll became locked after runtime step");
  assert(afterRuntime.htmlOverflow !== "hidden", "html scroll became locked after runtime step");
  assert(afterRuntime.dialogs === 0, "runtime step mounted a dialog by default");
  assert(afterRuntime.hermesRect && afterRuntime.hermesRect.height > 0, "Hermes runtime card is not reachable");
  assert(afterRuntime.nextRect && afterRuntime.nextRect.height > 0, "continue button is not reachable");
  assert(afterRuntime.scrollTop >= 0, "document scroll state is invalid");
  assert(errors.length === 0, `console/network errors:\n${errors.join("\n")}`);

  await page.getByRole("button", { name: /Hermes Agent/i }).click();
  await page.getByRole("button", { name: /Next/i }).click();
  await page.getByText("Connect your memory", { exact: false }).waitFor({ timeout: 10_000 });

  await page.reload({ waitUntil: "networkidle" });
  await page.getByText("Set up your", { exact: false }).waitFor({ timeout: 10_000 });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "networkidle" });
  await page.getByText("Set up your", { exact: false }).waitFor({ timeout: 10_000 });
  await page.getByRole("button", { name: /Start setup/i }).click();
  await page.getByRole("button", { name: /Next/i }).click();
  await page.getByRole("button", { name: /Hermes Agent/i }).scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: /Next/i }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${screenshotDir}/activation-mobile.png`, fullPage: true });

  const mobile = await page.evaluate(() => ({
    bodyOverflow: document.body.style.overflow,
    htmlOverflow: document.documentElement.style.overflow,
    dialogs: document.querySelectorAll('[role="dialog"], [aria-modal="true"]').length,
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight,
    hermesVisible: (() => {
      const candidates = [...document.querySelectorAll("button")];
      const el = candidates.find((button) => button.textContent?.includes("Hermes Agent"));
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      return rect.bottom > 0 && rect.top < window.innerHeight;
    })(),
  }));

  assert(mobile.bodyOverflow !== "hidden", "mobile body scroll is locked");
  assert(mobile.htmlOverflow !== "hidden", "mobile html scroll is locked");
  assert(mobile.dialogs === 0, "mobile activation mounted a dialog by default");
  assert(mobile.scrollHeight > mobile.clientHeight, "mobile activation page is not scrollable");
  assert(mobile.hermesVisible, "mobile Hermes runtime card is not reachable");

  console.log("activation scroll regression passed");
} finally {
  await browser.close();
}
