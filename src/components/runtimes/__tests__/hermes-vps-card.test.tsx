/**
 * Hermes VPS card — UI contract (task #105).
 *
 * Renders the real component against a mocked /api/runtimes. Guards:
 *   - card renders with identity + capabilities
 *   - "Not paired" state when no registry row exists
 *   - "Generate pairing key" mints + shows a one-time curl command
 *   - NO SSH password field exists anywhere in the card
 *   - hardening warning is present
 *   - "Connected" only when a healthy heartbeat projection exists
 *   - revoke action available once registered
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { HermesVpsCard } from '../hermes-vps-card'

function mockFetch(handler: (url: string, init?: RequestInit) => unknown) {
  global.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const body = handler(String(url), init)
    return { ok: true, status: 200, json: async () => body } as Response
  }) as unknown as typeof fetch
}

beforeEach(() => {
  // jsdom has no clipboard by default
  Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => {}) } })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('HermesVpsCard', () => {
  it('renders identity, capabilities, and the hardening warning', async () => {
    mockFetch(() => ({ runtimes: [] }))
    render(<HermesVpsCard />)
    expect(await screen.findByTestId('hermes-vps-card')).toBeInTheDocument()
    expect(screen.getByText('Hermes VPS')).toBeInTheDocument()
    expect(screen.getByTestId('hermes-vps-workspace-hint')).toHaveTextContent('/opt/data/profiles/slim-charles')
    const caps = screen.getByTestId('hermes-vps-capabilities')
    expect(caps).toHaveTextContent('production-controller')
    expect(caps).toHaveTextContent('maintenance-pipelines')
    expect(screen.getByTestId('hermes-vps-hardening-warning')).toHaveTextContent(/do not paste root passwords/i)
    expect(screen.getByTestId('hermes-vps-hardening-link')).toBeInTheDocument()
  })

  it('shows "Not paired" with a Generate button when there is no registry row', async () => {
    mockFetch(() => ({ runtimes: [] }))
    render(<HermesVpsCard />)
    await screen.findByTestId('hermes-vps-card')
    expect(screen.getByTestId('hermes-vps-status')).toHaveTextContent('Not paired')
    expect(screen.getByTestId('hermes-vps-generate')).toBeInTheDocument()
    // not connected, no revoke yet
    expect(screen.queryByTestId('hermes-vps-revoke')).toBeNull()
  })

  it('NEVER renders an SSH/password input field', async () => {
    mockFetch(() => ({ runtimes: [] }))
    const { container } = render(<HermesVpsCard />)
    await screen.findByTestId('hermes-vps-card')
    expect(container.querySelector('input[type="password"]')).toBeNull()
    // the card collects no free-text input at all (key flow is mint+curl)
    expect(container.querySelectorAll('input').length).toBe(0)
  })

  it('Generate pairing key mints a one-time curl command (no raw key persisted in UI)', async () => {
    mockFetch((url, init) => {
      if (url.startsWith('/api/onboarding/runtime-key')) {
        const sentKind = JSON.parse(String(init?.body || '{}')).runtime
        expect(sentKind).toBe('hermes-vps')
        return {
          api_key_hint: 'mca_abcd...wxyz',
          curl_command: 'curl -sS -X POST "https://mc/api/runtime/handshake" -H "X-API-Key: mca_secret" -d \'{"kind":"hermes-vps"}\'',
          docs_url: '/docs/security/VPS_HERMES_PAIRING',
          workspace_id: 1,
        }
      }
      return { runtimes: [] }
    })
    render(<HermesVpsCard />)
    fireEvent.click(await screen.findByTestId('hermes-vps-generate'))
    const cmd = await screen.findByTestId('hermes-vps-command')
    expect(cmd).toHaveTextContent('/api/runtime/handshake')
    expect(cmd).toHaveTextContent('"kind":"hermes-vps"')
    // After minting (no heartbeat yet) the card must NOT claim connected.
    expect(screen.getByTestId('hermes-vps-status')).not.toHaveTextContent('Connected')
  })

  it('shows "Connected" + revoke ONLY when a healthy heartbeat projection exists', async () => {
    mockFetch((url) => {
      if (url.startsWith('/api/runtimes')) {
        return {
          runtimes: [{
            runtime_id: 'hermes-vps', runtime_type: 'hermes-vps', name: 'Hermes VPS',
            status: 'healthy', heartbeat_age: 12, last_seen: 1, workspace_id: 1,
            capabilities: ['production-controller'], internal_id: 42,
          }],
        }
      }
      return {}
    })
    render(<HermesVpsCard />)
    await screen.findByTestId('hermes-vps-card')
    await waitFor(() => expect(screen.getByTestId('hermes-vps-status')).toHaveTextContent('Connected'))
    expect(screen.getByTestId('hermes-vps-heartbeat')).toHaveTextContent('live')
    expect(screen.getByTestId('hermes-vps-revoke')).toBeInTheDocument()
  })

  it('a warning heartbeat projection renders "Stale", not "Connected"', async () => {
    mockFetch((url) => {
      if (url.startsWith('/api/runtimes')) {
        return {
          runtimes: [{
            runtime_id: 'hermes-vps', runtime_type: 'hermes-vps', name: 'Hermes VPS',
            status: 'warning', heartbeat_age: 200, last_seen: 1, workspace_id: 1,
            capabilities: [], internal_id: 7,
          }],
        }
      }
      return {}
    })
    render(<HermesVpsCard />)
    await screen.findByTestId('hermes-vps-card')
    await waitFor(() => expect(screen.getByTestId('hermes-vps-status')).toHaveTextContent('Stale'))
  })
})
