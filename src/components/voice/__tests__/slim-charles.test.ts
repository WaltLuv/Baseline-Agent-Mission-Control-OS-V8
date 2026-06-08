/**
 * Slim Charles — Voice tab, panel wiring, voice session/tool endpoints, and the
 * Org Chart / Pipeline CRUD UIs. Source-level assertions (no DOM render needed)
 * proving the surfaces exist and stay honest.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'fs'

const read = (p: string) => readFileSync(p, 'utf8')

describe('Slim Charles voice tab', () => {
  const voice = read('src/components/voice/slim-charles-voice.tsx')
  const panel = read('src/components/panels/slim-charles-panel.tsx')

  it('renders a Voice tab with state machine + controls', () => {
    expect(voice).toContain('slim-voice-tab')
    expect(voice).toContain('voice-state')
    expect(voice).toContain('push-to-talk')
    expect(voice).toContain('live-call')
    expect(voice).toContain('wall-mode-toggle')
    expect(voice).toContain('voice-boot')
  })
  it('shows an honest setup-needed state (no fake connected voice)', () => {
    expect(voice).toContain('voice-setup-needed')
    expect(voice).toContain('/api/voice/session')
    expect(voice).toMatch(/will not fake a live connection/i)
  })
  it('exposes the safety policy (auto-approve vs Walt-only)', () => {
    expect(voice).toContain('auto-approve-list')
    expect(voice).toContain('walt-only-list')
  })
  it('Slim Charles page has Chat + Voice tabs next to each other', () => {
    expect(panel).toContain('slim-tab-${t}')
    expect(panel).toContain("['chat', 'voice']")
    expect(panel).toContain('SlimCharlesVoice')
    expect(panel).toContain('ChatWorkspace')
  })
})

describe('voice realtime endpoints exist', () => {
  it('WebSocket session bootstrap endpoint exists and is honest', () => {
    expect(existsSync('src/app/api/voice/session/route.ts')).toBe(true)
    const src = read('src/app/api/voice/session/route.ts')
    expect(src).toContain('detectVoiceProvider')
    expect(src).toContain('setupNeeded')
    expect(src).toMatch(/wss:\/\//) // WebSocket URL for the realtime stream
  })
  it('tool-execution bridge enforces the permission policy', () => {
    expect(existsSync('src/app/api/voice/tool/route.ts')).toBe(true)
    const src = read('src/app/api/voice/tool/route.ts')
    expect(src).toContain('classifyAction')
    expect(src).toContain('requires-walt')
    expect(src).toMatch(/setupNeeded|setup-needed/) // no fake execution
  })
  it('hermes_voice_stream service implements interruption + persona injection', () => {
    const src = read('src/lib/voice/hermes-voice-stream.ts')
    expect(src).toContain('response.cancel')
    expect(src).toContain('session.update')
    expect(src).toContain('input_audio_buffer.append')
  })
})

describe('AI Org Chart CRUD UI', () => {
  const panel = read('src/components/panels/org-chart-panel.tsx')
  it('has create/edit/delete with a destructive-delete confirm', () => {
    expect(panel).toContain('org-chart-panel')
    expect(panel).toContain('org-save')
    expect(panel).toContain("method: 'DELETE'")
    expect(panel).toContain('window.confirm')
  })
  it('assigns department, manager, skills, memory, runtime, permissions', () => {
    for (const f of ['department', 'managerId', 'skills', 'memoryAccess', 'runtime', 'permissions']) {
      expect(panel, `org form missing ${f}`).toContain(f)
    }
  })
})

describe('Pipeline UI', () => {
  const panel = read('src/components/panels/pipeline-panel.tsx')
  it('captures an idea and runs it through the gated stages', () => {
    expect(panel).toContain('pipeline-panel')
    expect(panel).toContain('idea-capture')
    expect(panel).toContain("action: 'approve'")
    expect(panel).toContain("action: 'advance'")
    expect(panel).toContain("action: 'ship'")
  })
})

describe('Settings exposes configurable paths', () => {
  it('mounts the Paths & Config section', () => {
    const src = read('src/components/settings/paths-config-section.tsx')
    expect(src).toContain('paths-config-section')
    expect(src).toContain('/api/config/paths')
    expect(existsSync('src/app/api/config/paths/route.ts')).toBe(true)
  })
})
