import { test, expect } from '@playwright/test'

test.describe('Activation setup scrolling', () => {
  test.beforeEach(async ({ page }) => {
    const username = `activation-scroll-${Date.now()}`
    const password = 'testpass1234!'

    // Use page.request so the session cookie lands in the SAME context the
    // page navigates with (the bare `request` fixture has a separate cookie jar
    // → page.goto('/app/activate') would redirect to /login).
    const createRes = await page.request.post('/api/auth/users', {
      headers: { 'x-api-key': process.env.API_KEY || 'test-api-key-e2e-12345' },
      data: { username, password, display_name: 'Activation Scroll E2E', role: 'admin' },
    })
    expect([201, 409]).toContain(createRes.status())

    const loginRes = await page.request.post('/api/auth/login', {
      data: { username, password },
      headers: { 'x-forwarded-for': '10.88.88.4' },
    })
    expect(loginRes.status()).toBe(200)
  })

  for (const viewport of [
    { name: 'desktop', width: 1280, height: 720 },
    { name: 'mobile', width: 390, height: 640 },
  ]) {
    test(`${viewport.name}: activation page scrolls — every option reachable, no scroll lock`, async ({ page }) => {
      const consoleErrors: string[] = []
      page.on('console', (msg) => {
        if (msg.type() !== 'error') return
        const text = msg.text()
        // Ignore the local e2e server's static-asset serving defect: it serves
        // _next/static chunks as text/plain, so the browser 404s/refuses them
        // (and the CSP inline-script block is a downstream symptom). Pure infra
        // noise — a no-op in a correctly-serving environment, so this still
        // catches genuine application console errors on the activation page.
        if (/Failed to load resource.*\b404\b/i.test(text)) return
        if (/Refused to (apply style|execute script).*MIME type/i.test(text)) return
        if (/Executing inline script violates.*Content Security Policy/i.test(text)) return
        consoleErrors.push(text)
      })

      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.goto('/app/activate')

      // P0 invariants: document scroll mode (not viewport-locked) + no scroll lock.
      // (Regression was: trapped in `h-screen overflow-hidden` → content below the
      // fold unreachable. AppShellFrame must put /app/activate in 'document' mode.)
      await expect(page.getByTestId('activation-hub')).toBeVisible()
      await expect(page.getByTestId('app-shell-frame')).toHaveAttribute('data-scroll-mode', 'document')
      await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden')
      const modalOrDialogCount = await page.locator('[role="dialog"], [aria-modal="true"]').count()
      expect(modalOrDialogCount).toBe(0)

      // The active-step body (whichever step is active, or the all-done panel)
      // is always rendered and must be reachable by scrolling — seed-independent
      // proof that content below the fold is no longer clipped.
      const stepBody = page.getByTestId('activation-active-step')
      await expect(stepBody).toBeVisible()
      await stepBody.scrollIntoViewIfNeeded()
      await expect(stepBody).toBeVisible()

      // The document can be scrolled to the bottom without being trapped.
      const reached = await page.evaluate(() => {
        const el = document.scrollingElement || document.documentElement
        el.scrollTop = el.scrollHeight
        // either we scrolled, or all content already fits the viewport (also fine)
        return el.scrollTop > 0 || el.scrollHeight <= el.clientHeight
      })
      expect(reached).toBe(true)

      // If this workspace is fresh enough to show the catalog, Property
      // Management is the first, auto-selected option with a reachable install
      // button, and secondary verticals are collapsed. (PM-first ordering is
      // also locked by the unit suite in activation-scroll-structure.test.ts.)
      if (await page.getByTestId('workforce-installer').count()) {
        await expect(page.getByTestId('workforce-card-property-management')).toBeVisible()
        const installBtn = page.getByTestId('workforce-install-property-management')
        await installBtn.scrollIntoViewIfNeeded()
        await expect(installBtn).toBeVisible()
        await expect(installBtn).toBeEnabled()
      }

      expect(consoleErrors).toEqual([])
    })
  }
})
