import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Import after mocks set by each test
async function loadModule() {
  return await import('../agent-gateway-client')
}

describe('agent-gateway-client', () => {
  const ORIG_ENV = { ...process.env }
  beforeEach(() => {
    vi.resetModules()
    process.env = { ...ORIG_ENV }
    delete process.env.AGENT_GATEWAY_URL
    delete process.env.AGENT_GATEWAY_API_KEY
    delete process.env.API_KEY
  })
  afterEach(() => {
    vi.restoreAllMocks()
    process.env = { ...ORIG_ENV }
  })

  it('getGatewayUrl defaults to 127.0.0.1:8765 and strips trailing slash', async () => {
    const m = await loadModule()
    expect(m.getGatewayUrl()).toBe('http://127.0.0.1:8765')

    process.env.AGENT_GATEWAY_URL = 'https://gateway.example.com/'
    vi.resetModules()
    const m2 = await loadModule()
    expect(m2.getGatewayUrl()).toBe('https://gateway.example.com')
  })

  it('getGatewayApiKey prefers AGENT_GATEWAY_API_KEY over API_KEY', async () => {
    process.env.API_KEY = 'fallback-key'
    process.env.AGENT_GATEWAY_API_KEY = 'preferred-key'
    const m = await loadModule()
    expect(m.getGatewayApiKey()).toBe('preferred-key')

    delete process.env.AGENT_GATEWAY_API_KEY
    vi.resetModules()
    const m2 = await loadModule()
    expect(m2.getGatewayApiKey()).toBe('fallback-key')
  })

  it('health returns reachable=false on network error', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'))
    const m = await loadModule()
    const res = await m.getGatewayHealth()
    expect(res.reachable).toBe(false)
    if (!res.reachable) {
      expect(res.error).toContain('ECONNREFUSED')
      expect(res.gatewayUrl).toBe('http://127.0.0.1:8765')
    }
    fetchSpy.mockRestore()
  })

  it('health passes x-api-key + bearer when API key set', async () => {
    process.env.AGENT_GATEWAY_API_KEY = 'sekret-123'
    const captured: any = { headers: null, url: null }
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((url, init) => {
      captured.url = String(url)
      captured.headers = (init as any)?.headers
      return Promise.resolve(new Response(JSON.stringify({ status: 'ok' }), { status: 200 }))
    })
    const m = await loadModule()
    const res = await m.getGatewayHealth()
    expect(res.reachable).toBe(true)
    expect(captured.url).toContain('/health')
    expect(captured.headers['x-api-key']).toBe('sekret-123')
    expect(captured.headers['authorization']).toBe('Bearer sekret-123')
    fetchSpy.mockRestore()
  })

  it('listGatewayTasks encodes query params', async () => {
    const captured: any = {}
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      captured.url = String(url)
      return Promise.resolve(new Response(JSON.stringify({ tasks: [] }), { status: 200 }))
    })
    const m = await loadModule()
    await m.listGatewayTasks({ limit: 25, agent: 'codex' })
    expect(captured.url).toMatch(/\/v1\/tasks\?.*limit=25/)
    expect(captured.url).toMatch(/agent=codex/)
    fetchSpy.mockRestore()
  })
})
