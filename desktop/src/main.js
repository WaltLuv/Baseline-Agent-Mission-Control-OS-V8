// ───────────────────────────────────────────────────────────────────
// Baseline Flight Deck — landing shell logic.
//
// Tiny by design. Only does:
//   1. Persist the operator's chosen Mission Control mode + URL
//   2. Probe the health endpoint to color the connection pill
//   3. Navigate the same webview to Mission Control on demand
//   4. Show runtime status on demand (no background polling)
//
// Never stores credentials, never bypasses web auth, never executes
// arbitrary remote URLs. The allowlist below is enforced both here
// and in tauri.conf.json (CSP).
//
// IMPORTANT: this shell does NOT auto-refresh. Auto-poll was removed
// after operators reported the page felt "jumpy" during demos. Status
// is refreshed only when the operator clicks "Refresh" or "Test".
// ───────────────────────────────────────────────────────────────────

import { MODES, ALLOWED_HOSTS, isAllowedUrl, activeUrl } from './allowlist.js'

const STORAGE_KEY = 'flight-deck.settings.v1'
const DEFAULT_MODE = 'emergent'

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return { mode: DEFAULT_MODE, customUrl: '' }
}

function saveSettings(s) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) } catch { /* ignore */ }
}

function setPill(state, label) {
  const pill = document.getElementById('connection-pill')
  if (!pill) return
  pill.classList.remove('pill-muted', 'pill-ok', 'pill-warn', 'pill-err')
  pill.classList.add(`pill-${state}`)
  pill.textContent = label
}

async function probeConnection(url) {
  if (!url || !isAllowedUrl(url)) {
    setPill('muted', 'Pick a target')
    return
  }
  setPill('warn', 'Checking…')
  const probe = url.replace(/\/+$/, '') + '/api/status?action=health'
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 5000)
    const r = await fetch(probe, { signal: ctrl.signal, credentials: 'omit' })
    clearTimeout(t)
    if (!r.ok) { setPill('err', `HTTP ${r.status}`); return }
    const body = await r.json().catch(() => null)
    if (body?.status === 'healthy') setPill('ok', 'Connected')
    else setPill('warn', body?.status || 'Degraded')
  } catch {
    setPill('err', 'Unreachable')
  }
}

function paintModes(settings) {
  document.querySelectorAll('.mode').forEach((el) => {
    const mine = el.dataset.mode === settings.mode && !settings.customUrl
    el.dataset.active = mine ? 'true' : 'false'
  })
}

function bind() {
  const settings = loadSettings()
  paintModes(settings)
  const customInput = document.getElementById('custom-url')
  if (customInput) customInput.value = settings.customUrl || ''

  document.querySelectorAll('.mode').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = { ...loadSettings(), mode: btn.dataset.mode, customUrl: '' }
      saveSettings(next)
      paintModes(next)
      if (customInput) customInput.value = ''
      probeConnection(activeUrl(next))
      fetchRuntimeStatus(activeUrl(next))
    })
  })

  document.getElementById('save-custom')?.addEventListener('click', () => {
    const raw = (customInput?.value || '').trim()
    if (raw && !isAllowedUrl(raw)) {
      setPill('err', 'URL not allowlisted')
      return
    }
    const next = { ...loadSettings(), customUrl: raw }
    saveSettings(next)
    paintModes(next)
    probeConnection(activeUrl(next))
    fetchRuntimeStatus(activeUrl(next))
  })

  document.getElementById('open-mc')?.addEventListener('click', () => {
    const url = activeUrl(loadSettings())
    if (!isAllowedUrl(url)) {
      setPill('err', 'Blocked')
      return
    }
    window.location.assign(url)
  })

  document.getElementById('check-connection')?.addEventListener('click', () => {
    probeConnection(activeUrl(loadSettings()))
    fetchRuntimeStatus(activeUrl(loadSettings()))
  })

  document.getElementById('refresh-runtimes')?.addEventListener('click', () => {
    fetchRuntimeStatus(activeUrl(loadSettings()))
  })

  // Reset session — clears Flight Deck's saved target/customURL and
  // wipes cookies for the current MC host so the next click re-prompts
  // for login. Does NOT clear credentials on remote MC — that is the
  // server's responsibility via /api/auth/logout.
  document.getElementById('reset-session')?.addEventListener('click', async () => {
    const cur = loadSettings()
    const url = activeUrl(cur)
    // Try to call MC logout if the host is reachable; ignore errors.
    if (url && isAllowedUrl(url)) {
      try {
        await fetch(url.replace(/\/+$/, '') + '/api/auth/logout', {
          method: 'POST',
          credentials: 'include',
        })
      } catch { /* ignore */ }
    }
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch { /* ignore */ }
    // Reset UI state without reloading
    const reset = { mode: DEFAULT_MODE, customUrl: '' }
    saveSettings(reset)
    paintModes(reset)
    if (customInput) customInput.value = ''
    setPill('muted', 'Reset · pick a target')
    document.querySelectorAll('[data-testid="flight-deck-runtime-list"] li').forEach((li) => {
      updateRuntimeRow(li, 'muted', '—')
    })
  })

  document.querySelectorAll('.shortcut').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault()
      const path = el.dataset.path || '/'
      const base = activeUrl(loadSettings()).replace(/\/+$/, '')
      const url = base + path
      if (isAllowedUrl(base)) window.location.assign(url)
    })
  })

  // Initial probe — runs once at startup, then never again until the
  // operator clicks. No auto-polling.
  probeConnection(activeUrl(settings))
  fetchRuntimeStatus(activeUrl(settings))
}

async function fetchRuntimeStatus(baseUrl) {
  const list = document.querySelector('[data-testid="flight-deck-runtime-list"]')
  if (!list) return
  if (!baseUrl || !isAllowedUrl(baseUrl)) {
    list.querySelectorAll('li').forEach((li) => updateRuntimeRow(li, 'muted', 'select a target'))
    return
  }
  const probe = baseUrl.replace(/\/+$/, '') + '/api/agent-runtimes'
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 5000)
    const r = await fetch(probe, { signal: ctrl.signal, credentials: 'include' })
    clearTimeout(t)
    if (r.status === 401 || r.status === 403) {
      list.querySelectorAll('li').forEach((li) => updateRuntimeRow(li, 'warn', 'login required'))
      return
    }
    if (!r.ok) {
      list.querySelectorAll('li').forEach((li) => updateRuntimeRow(li, 'err', `HTTP ${r.status}`))
      return
    }
    const body = await r.json()
    // Filesystem-detected runtimes (this MC host)
    const byId = Object.fromEntries((body.runtimes || []).map((rt) => [rt.id, rt]))
    // DB-registered runtimes (remote handshake)
    const registeredByType = {}
    for (const reg of (body.registered || [])) {
      const key = reg.runtime_type === 'claude' ? 'claude' : reg.runtime_type
      if (!registeredByType[key]) registeredByType[key] = []
      registeredByType[key].push(reg)
    }
    list.querySelectorAll('li').forEach((li) => {
      const rtId = li.dataset.runtime
      const rt = byId[rtId]
      const remote = registeredByType[rtId] || []
      const connectedRemote = remote.find((r) => r.connection_status === 'connected')
      const staleRemote = remote.find((r) => r.connection_status === 'stale')
      if (connectedRemote) {
        updateRuntimeRow(li, 'ok', `${connectedRemote.name} · live`)
      } else if (rt && rt.installed) {
        updateRuntimeRow(li, 'ok', rt.version || 'local · connected')
      } else if (staleRemote) {
        updateRuntimeRow(li, 'warn', `${staleRemote.name} · stale`)
      } else if (remote.length > 0) {
        updateRuntimeRow(li, 'err', `${remote[0].name} · disconnected`)
      } else {
        updateRuntimeRow(li, 'muted', 'not connected')
      }
    })
  } catch {
    list.querySelectorAll('li').forEach((li) => updateRuntimeRow(li, 'err', 'unreachable'))
  }
}

function updateRuntimeRow(li, state, label) {
  const dot = li.querySelector('.rt-dot')
  if (dot) dot.dataset.state = state
  const status = li.querySelector('.rt-status')
  if (status) status.textContent = label
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind)
  } else {
    bind()
  }
}

// Re-export pure helpers for convenience (real test target is ./allowlist.js).
export { isAllowedUrl, activeUrl, MODES, ALLOWED_HOSTS, fetchRuntimeStatus, updateRuntimeRow }
