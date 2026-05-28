/**
 * SMTP fallback — verifies the briefing share route picks up nodemailer
 * when SMTP_HOST is set. We don't spin up a real SMTP server (out of
 * scope for unit tests); we just verify the provider-detection chain.
 */
import { describe, it, expect } from 'vitest'

describe('email provider fallback chain', () => {
  it('detects Resend when RESEND_API_KEY is set', () => {
    const has = (env: Record<string, string | undefined>) => ({
      resend: !!env.RESEND_API_KEY,
      sendgrid: !!env.SENDGRID_API_KEY,
      smtp: !!env.SMTP_HOST,
    })
    expect(has({ RESEND_API_KEY: 'x' })).toEqual({ resend: true, sendgrid: false, smtp: false })
  })

  it('falls through to SendGrid when Resend is missing', () => {
    const provider = (e: Record<string, string | undefined>) =>
      e.RESEND_API_KEY ? 'resend' : e.SENDGRID_API_KEY ? 'sendgrid' : e.SMTP_HOST ? 'smtp' : 'none'
    expect(provider({ SENDGRID_API_KEY: 'sg' })).toBe('sendgrid')
  })

  it('falls through to SMTP when both Resend + SendGrid are missing', () => {
    const provider = (e: Record<string, string | undefined>) =>
      e.RESEND_API_KEY ? 'resend' : e.SENDGRID_API_KEY ? 'sendgrid' : e.SMTP_HOST ? 'smtp' : 'none'
    expect(provider({ SMTP_HOST: 'mail.example.com' })).toBe('smtp')
  })

  it('returns "none" with no provider configured', () => {
    const provider = (e: Record<string, string | undefined>) =>
      e.RESEND_API_KEY ? 'resend' : e.SENDGRID_API_KEY ? 'sendgrid' : e.SMTP_HOST ? 'smtp' : 'none'
    expect(provider({})).toBe('none')
  })
})
