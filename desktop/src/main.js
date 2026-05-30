// ───────────────────────────────────────────────────────────────────
// Baseline Flight Deck — landing shell logic.
//
// Tiny by design. Only does:
//   1. Persist the operator's chosen Mission Control mode + URL
//   2. Probe the health endpoint to color the connection pill
//   3. Navigate the same webview to Mission Control on demand
//
// Never stores credentials, never bypasses web auth, never executes
// arbitrary remote URLs. The allowlist below is enforced both here
// and in tauri.conf.json (CSP).
// ───────────────────────────────────────────────────────────────────

import { MODES, ALLOWED_HOSTS, isAllowedUrl, activeUrl } from './allowlist.js'

const STORAGE_KEY = 'flight-deck.settings.v1'

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return { mode: 'production', customUrl: '' }
}

function saveSettings(s) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) } catch { /* ignore */ }
}

function setPill(state, label) {
  const pill = document.getElementById('connection-pill')
  pill.classList.remove('pill-muted', 'pill-ok', 'pill-warn', 'pill-err')
  pill.classList.add(`pill-${state}`)
  pill.textContent = label
}

async function probeConnection(url) {
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
  document.getElementById('custom-url').value = settings.customUrl || ''

  document.querySelectorAll('.mode').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = { ...loadSettings(), mode: btn.dataset.mode, customUrl: '' }
      saveSettings(next)
      paintModes(next)
      document.getElementById('custom-url').value = ''
      probeConnection(activeUrl(next))
    })
  })

  document.getElementById('save-custom').addEventListener('click', () => {
    const raw = document.getElementById('custom-url').value.trim()
    if (raw && !isAllowedUrl(raw)) {
      setPill('err', 'URL not allowlisted')
      return
    }
    const next = { ...loadSettings(), customUrl: raw }
    saveSettings(next)
    paintModes(next)
    probeConnection(activeUrl(next))
  })

  document.getElementById('open-mc').addEventListener('click', () => {
    const url = activeUrl(loadSettings())
    if (!isAllowedUrl(url)) {
      setPill('err', 'Blocked')
      return
    }
    // Navigate the same Tauri webview to Mission Control. The host
    // allowlist is enforced server-side too (MC_ALLOWED_HOSTS).
    window.location.assign(url)
  })

  document.getElementById('check-connection').addEventListener('click', () => {
    probeConnection(activeUrl(loadSettings()))
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

  const refreshBtn = document.getElementById('refresh-runtimes')
  if (refreshBtn) refreshBtn.addEventListener('click', () => fetchRuntimeStatus(activeUrl(loadSettings())))

  probeConnection(activeUrl(settings))
  fetchRuntimeStatus(activeUrl(settings))
}

async function fetchRuntimeStatus(baseUrl) {
  const list = document.querySelector('[data-testid="flight-deck-runtime-list"]')
  if (!list) return
  const probe = baseUrl.replace(/\/+$/, '') + '/api/agent-runtimes'
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 5000)
    const r = await fetch(probe, { signal: ctrl.signal, credentials: 'include' })
    clearTimeout(t)
    if (!r.ok) {
      list.querySelectorAll('li').forEach((li) => updateRuntimeRow(li, 'warn', 'login required'))
      return
    }
    const body = await r.json()
    const byId = Object.fromEntries((body.runtimes || []).map((rt) => [rt.id, rt]))
    list.querySelectorAll('li').forEach((li) => {
      const rt = byId[li.dataset.runtime]
      if (!rt) { updateRuntimeRow(li, 'muted', 'unknown'); return }
      if (rt.installed) updateRuntimeRow(li, 'ok', rt.version || 'connected')
      else updateRuntimeRow(li, 'muted', 'not connected')
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
export { isAllowedUrl, activeUrl, MODES, ALLOWED_HOSTS }
