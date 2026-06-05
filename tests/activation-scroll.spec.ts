import { test, expect } from '@playwright/test'

test.describe('Activation setup scrolling', () => {
  test.beforeEach(async ({ request }) => {
    const username = `activation-scroll-${Date.now()}`
    const password = 'testpass1234!'

    const createRes = await request.post('/api/auth/users', {
      headers: { 'x-api-key': process.env.API_KEY || 'test-api-key-e2e-12345' },
      data: {
        username,
        password,
        display_name: 'Activation Scroll E2E',
        role: 'admin',
      },
    })
    expect([201, 409]).toContain(createRes.status())

    const loginRes = await request.post('/api/auth/login', {
      data: { username, password },
      headers: { 'x-forwarded-for': '10.88.88.4' },
    })
    expect(loginRes.status()).toBe(200)
  })

  for (const viewport of [
    { name: 'desktop', width: 1280, height: 720 },
    { name: 'mobile', width: 390, height: 640 },
  ]) {
    test(`${viewport.name}: runtime picker is reachable without scroll lock`, async ({ page }) => {
      const consoleErrors: string[] = []
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text())
      })

      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.goto('/app/activate')

      await expect(page.getByTestId('activation-hub')).toBeVisible()
      await expect(page.getByTestId('app-shell-frame')).toHaveAttribute('data-scroll-mode', 'document')
      await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden')
      await expect(page.getByTestId('runtime-wizard-option-claude')).toBeVisible()
      await expect(page.getByTestId('runtime-wizard-option-codex')).toBeVisible()

      await page.getByTestId('runtime-wizard-option-hermes').scrollIntoViewIfNeeded()
      await expect(page.getByTestId('runtime-wizard-option-hermes')).toBeVisible()
      await page.getByTestId('runtime-wizard-option-hermes').click()
      await expect(page.getByTestId('runtime-wizard-generate')).toBeEnabled()

      await page.getByTestId('runtime-wizard-generate').scrollIntoViewIfNeeded()
      await expect(page.getByTestId('runtime-wizard-generate')).toBeVisible()

      const modalOrDialogCount = await page.locator('[role="dialog"], [aria-modal="true"]').count()
      expect(modalOrDialogCount).toBe(0)
      expect(consoleErrors).toEqual([])
    })
  }
})
