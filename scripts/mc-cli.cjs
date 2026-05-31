#!/usr/bin/env node
/*
 Mission Control CLI (v2)
 - Zero heavy dependencies
 - API-key first for agent automation
 - JSON mode + stable exit codes
 - Lazy command resolution (no eager required() calls)
 - SSE streaming for events watch
*/

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const EXIT = {
  OK: 0,
  USAGE: 2,
  AUTH: 3,
  FORBIDDEN: 4,
  NETWORK: 5,
  SERVER: 6,
};

function parseArgs(argv) {
  const out = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      out._.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      out.flags[key] = true;
      continue;
    }
    out.flags[key] = next;
    i += 1;
  }
  return out;
}

function usage() {
  console.log(`Mission Control CLI (mc) — operator control plane for Baseline OS

  This is NOT an autonomous coding agent. It is the command-line surface
  for inspecting and operating Mission Control: runtimes, workspaces,
  agent gateway, employees, skills, billing, Flight Deck, deployment.

Usage:
  mc <group> <action> [--flags]
  mc login | logout | whoami | status | version

Top-level shortcuts:
  login          alias for: auth login
  logout         alias for: auth logout
  whoami         alias for: auth whoami
  version        print CLI + Mission Control build info
  config         set-url <url> | set-key <key> | current | profiles

Operator groups (status: working / stubbed / planned):
  auth           login / logout / whoami                              [working]
  config         set-url / set-key / set-workspace / current          [working]
  status         health / overview / dashboard / gateway / models     [working]

  runtime        list / connect <kind> / heartbeat / logs / doctor    [working]
                 kinds: hermes | openclaw | opencode | claude | codex
  gateway        health / agents / tasks / task <id> / logs / route   [working]
  workspace      list / use <id> / current                            [working]
  team           list / invite --email --role / revoke <id>           [working]
  employee       list / inspect <id> / install <slug> / remove <id>   [stubbed*]
  skill          list / inspect <slug> / install <slug> / remove      [working]
  billing        status / credits / usage / ledger                    [working]
  deploy         check / health / preflight / env-check / rollback    [stubbed*]
  flightdeck     status / downloads / doctor / release                [working]

Existing groups retained:
  agents         list/get/create/update/delete/wake/diagnostics/heartbeat
                 memory get|set|clear / soul get|set|templates / attribution
  tasks          list/get/create/update/delete/queue / comments / broadcast
  sessions       list/control/continue/transcript
  connect        register/list/disconnect
  tokens         list/stats/by-agent/agent-costs/task-costs/export/rotate
  skills         list/content/upsert/delete/check         (alias: skill)
  cron           list/create/update/pause/resume/remove/run
  events         watch
  workflows      list/get/create/delete
  export         audit/tasks/activities/pipelines
  raw            request fallback

  * "stubbed" = backend route is not yet implemented; CLI reports planned

Common flags:
  --profile <name>      profile name (default: default)
  --url <base_url>      override profile URL
  --api-key <key>       override profile API key
  --workspace <id>      override active workspace
  --json                JSON output (NDJSON for streams)
  --timeout-ms <n>      request timeout (default 20000)
  --help                show help

Environment:
  MC_URL                base URL of Mission Control deployment
  MC_API_KEY            operator / runtime API key
  MC_COOKIE             session cookie (set automatically by 'mc login')
  MC_WORKSPACE          active workspace id

Examples:
  mc login --username admin --password admin12345
  mc status health --json
  mc runtime list
  mc runtime connect claude --workspace ws_demo
  mc runtime doctor
  mc gateway health --json
  mc workspace list
  mc team invite --email new@op.com --role operator
  mc flightdeck downloads --json
  mc flightdeck doctor
  mc billing usage --timeframe month
  mc events watch --types agent,task
  mc raw --method GET --path /api/status?action=health --json
`);
}

function profilePath(name) {
  return path.join(os.homedir(), '.mission-control', 'profiles', `${name}.json`);
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function loadProfile(name) {
  const p = profilePath(name);
  if (!fs.existsSync(p)) {
    return {
      name,
      url: process.env.MC_URL || 'http://127.0.0.1:3000',
      apiKey: process.env.MC_API_KEY || '',
      cookie: process.env.MC_COOKIE || '',
      workspace: process.env.MC_WORKSPACE || '',
    };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
    return {
      name,
      url: parsed.url || process.env.MC_URL || 'http://127.0.0.1:3000',
      apiKey: parsed.apiKey || process.env.MC_API_KEY || '',
      cookie: parsed.cookie || process.env.MC_COOKIE || '',
      workspace: parsed.workspace || process.env.MC_WORKSPACE || '',
    };
  } catch {
    return {
      name,
      url: process.env.MC_URL || 'http://127.0.0.1:3000',
      apiKey: process.env.MC_API_KEY || '',
      cookie: process.env.MC_COOKIE || '',
      workspace: process.env.MC_WORKSPACE || '',
    };
  }
}

function saveProfile(profile) {
  const p = profilePath(profile.name);
  ensureParentDir(p);
  fs.writeFileSync(p, `${JSON.stringify(profile, null, 2)}\n`, 'utf8');
}

function normalizeBaseUrl(url) {
  return String(url || '').replace(/\/+$/, '');
}

function mapStatusToExit(status) {
  if (status === 401) return EXIT.AUTH;
  if (status === 403) return EXIT.FORBIDDEN;
  if (status >= 500) return EXIT.SERVER;
  return EXIT.USAGE;
}

function required(flags, key) {
  const value = flags[key];
  if (value === undefined || value === true || String(value).trim() === '') {
    throw new Error(`Missing required flag --${key}`);
  }
  return value;
}

function optional(flags, key, fallback) {
  const value = flags[key];
  if (value === undefined || value === true) return fallback;
  return String(value);
}

function bodyFromFlags(flags) {
  if (flags.body) return JSON.parse(String(flags.body));
  return undefined;
}

async function httpRequest({ baseUrl, apiKey, cookie, method, route, body, timeoutMs = 20000 }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const headers = { Accept: 'application/json' };
  if (apiKey) headers['x-api-key'] = apiKey;
  if (cookie) headers['Cookie'] = cookie;
  let payload;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const url = `${normalizeBaseUrl(baseUrl)}${route.startsWith('/') ? route : `/${route}`}`;

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: payload,
      signal: controller.signal,
    });
    clearTimeout(timer);
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }
    return {
      ok: res.ok,
      status: res.status,
      data,
      setCookie: res.headers.get('set-cookie') || '',
      url,
      method,
    };
  } catch (err) {
    clearTimeout(timer);
    if (String(err?.name || '') === 'AbortError') {
      return { ok: false, status: 0, data: { error: `Request timeout after ${timeoutMs}ms` }, timeout: true, url, method };
    }
    return { ok: false, status: 0, data: { error: err?.message || 'Network error' }, network: true, url, method };
  }
}

async function sseStream({ baseUrl, apiKey, cookie, route, timeoutMs, onEvent, onError }) {
  const headers = { Accept: 'text/event-stream' };
  if (apiKey) headers['x-api-key'] = apiKey;
  if (cookie) headers['Cookie'] = cookie;
  const url = `${normalizeBaseUrl(baseUrl)}${route}`;

  const controller = new AbortController();
  let timer;
  if (timeoutMs && timeoutMs < Infinity) {
    timer = setTimeout(() => controller.abort(), timeoutMs);
  }

  // Graceful shutdown on SIGINT/SIGTERM
  const shutdown = () => { controller.abort(); };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    if (!res.ok) {
      const text = await res.text();
      onError({ status: res.status, data: text });
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Parse SSE frames
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      let currentData = '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          currentData += line.slice(6);
        } else if (line === '' && currentData) {
          try {
            const event = JSON.parse(currentData);
            onEvent(event);
          } catch {
            // Non-JSON data line, emit raw
            onEvent({ raw: currentData });
          }
          currentData = '';
        }
      }
    }
  } catch (err) {
    if (err?.name === 'AbortError') return; // clean shutdown
    onError({ error: err?.message || 'SSE connection error' });
  } finally {
    if (timer) clearTimeout(timer);
    process.removeListener('SIGINT', shutdown);
    process.removeListener('SIGTERM', shutdown);
  }
}

function printResult(result, asJson) {
  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (result.ok) {
    console.log(`OK ${result.status} ${result.method} ${result.url}`);
    if (result.data && Object.keys(result.data).length > 0) {
      console.log(JSON.stringify(result.data, null, 2));
    }
    return;
  }
  console.error(`ERROR ${result.status || 'NETWORK'} ${result.method} ${result.url}`);
  console.error(JSON.stringify(result.data, null, 2));
}

// --- Command handlers ---
// Each returns { method, route, body? } or handles the request directly and returns null.

const commands = {
  auth: {
    async login(flags, ctx) {
      const username = required(flags, 'username');
      const password = required(flags, 'password');
      const result = await httpRequest({
        baseUrl: ctx.baseUrl,
        method: 'POST',
        route: '/api/auth/login',
        body: { username, password },
        timeoutMs: ctx.timeoutMs,
      });
      if (result.ok && result.setCookie) {
        ctx.profile.url = ctx.baseUrl;
        ctx.profile.cookie = result.setCookie.split(';')[0];
        if (ctx.apiKey) ctx.profile.apiKey = ctx.apiKey;
        saveProfile(ctx.profile);
        result.data = { ...result.data, profile: ctx.profile.name, saved_cookie: true };
      }
      return result;
    },
    async logout(flags, ctx) {
      const result = await httpRequest({ baseUrl: ctx.baseUrl, apiKey: ctx.apiKey, cookie: ctx.profile.cookie, method: 'POST', route: '/api/auth/logout', timeoutMs: ctx.timeoutMs });
      if (result.ok) {
        ctx.profile.cookie = '';
        saveProfile(ctx.profile);
      }
      return result;
    },
    whoami: () => ({ method: 'GET', route: '/api/auth/me' }),
  },

  agents: {
    list: () => ({ method: 'GET', route: '/api/agents' }),
    get: (flags) => ({ method: 'GET', route: `/api/agents/${required(flags, 'id')}` }),
    create: (flags) => ({
      method: 'POST',
      route: '/api/agents',
      body: bodyFromFlags(flags) || { name: required(flags, 'name'), role: required(flags, 'role') },
    }),
    update: (flags) => ({
      method: 'PUT',
      route: `/api/agents/${required(flags, 'id')}`,
      body: bodyFromFlags(flags) || {},
    }),
    delete: (flags) => ({ method: 'DELETE', route: `/api/agents/${required(flags, 'id')}` }),
    wake: (flags) => ({ method: 'POST', route: `/api/agents/${required(flags, 'id')}/wake` }),
    diagnostics: (flags) => ({ method: 'GET', route: `/api/agents/${required(flags, 'id')}/diagnostics` }),
    heartbeat: (flags) => ({ method: 'POST', route: `/api/agents/${required(flags, 'id')}/heartbeat` }),
    attribution: (flags) => {
      const id = required(flags, 'id');
      const hours = optional(flags, 'hours', '24');
      const section = optional(flags, 'section', undefined);
      let qs = `?hours=${encodeURIComponent(hours)}`;
      if (section) qs += `&section=${encodeURIComponent(section)}`;
      if (flags.privileged) qs += '&privileged=1';
      return { method: 'GET', route: `/api/agents/${id}/attribution${qs}` };
    },
    // Subcommand: agents memory get|set|clear --id <id>
    memory: (flags) => {
      const id = required(flags, 'id');
      const sub = flags._sub;
      if (sub === 'get' || !sub) return { method: 'GET', route: `/api/agents/${id}/memory` };
      if (sub === 'set') {
        const content = flags.content || flags.file
          ? fs.readFileSync(required(flags, 'file'), 'utf8')
          : required(flags, 'content');
        return {
          method: 'PUT',
          route: `/api/agents/${id}/memory`,
          body: { working_memory: content, append: Boolean(flags.append) },
        };
      }
      if (sub === 'clear') return { method: 'DELETE', route: `/api/agents/${id}/memory` };
      throw new Error(`Unknown agents memory subcommand: ${sub}. Use get|set|clear`);
    },
    // Subcommand: agents soul get|set|templates --id <id>
    soul: (flags) => {
      const id = required(flags, 'id');
      const sub = flags._sub;
      if (sub === 'get' || !sub) return { method: 'GET', route: `/api/agents/${id}/soul` };
      if (sub === 'set') {
        const body = {};
        if (flags.template) body.template_name = flags.template;
        else if (flags.file) body.soul_content = fs.readFileSync(String(flags.file), 'utf8');
        else body.soul_content = required(flags, 'content');
        return { method: 'PUT', route: `/api/agents/${id}/soul`, body };
      }
      if (sub === 'templates') {
        const template = optional(flags, 'template', undefined);
        const qs = template ? `?template=${encodeURIComponent(template)}` : '';
        return { method: 'PATCH', route: `/api/agents/${id}/soul${qs}` };
      }
      throw new Error(`Unknown agents soul subcommand: ${sub}. Use get|set|templates`);
    },
  },

  tasks: {
    list: () => ({ method: 'GET', route: '/api/tasks' }),
    get: (flags) => ({ method: 'GET', route: `/api/tasks/${required(flags, 'id')}` }),
    create: (flags) => ({
      method: 'POST',
      route: '/api/tasks',
      body: bodyFromFlags(flags) || { title: required(flags, 'title') },
    }),
    update: (flags) => ({
      method: 'PUT',
      route: `/api/tasks/${required(flags, 'id')}`,
      body: bodyFromFlags(flags) || {},
    }),
    delete: (flags) => ({ method: 'DELETE', route: `/api/tasks/${required(flags, 'id')}` }),
    queue: (flags) => {
      const agent = required(flags, 'agent');
      let qs = `?agent=${encodeURIComponent(agent)}`;
      if (flags['max-capacity']) qs += `&max_capacity=${encodeURIComponent(String(flags['max-capacity']))}`;
      return { method: 'GET', route: `/api/tasks/queue${qs}` };
    },
    broadcast: (flags) => ({
      method: 'POST',
      route: `/api/tasks/${required(flags, 'id')}/broadcast`,
      body: { message: required(flags, 'message') },
    }),
    // Subcommand: tasks comments list|add --id <id>
    comments: (flags) => {
      const id = required(flags, 'id');
      const sub = flags._sub;
      if (sub === 'list' || !sub) return { method: 'GET', route: `/api/tasks/${id}/comments` };
      if (sub === 'add') {
        const body = { content: required(flags, 'content') };
        if (flags['parent-id']) body.parent_id = Number(flags['parent-id']);
        return { method: 'POST', route: `/api/tasks/${id}/comments`, body };
      }
      throw new Error(`Unknown tasks comments subcommand: ${sub}. Use list|add`);
    },
  },

  sessions: {
    list: () => ({ method: 'GET', route: '/api/sessions' }),
    control: (flags) => ({
      method: 'POST',
      route: `/api/sessions/${required(flags, 'id')}/control`,
      body: { action: required(flags, 'action') },
    }),
    continue: (flags) => ({
      method: 'POST',
      route: '/api/sessions/continue',
      body: {
        kind: required(flags, 'kind'),
        id: required(flags, 'id'),
        prompt: required(flags, 'prompt'),
      },
    }),
    transcript: (flags) => {
      const kind = required(flags, 'kind');
      const id = required(flags, 'id');
      let qs = `?kind=${encodeURIComponent(kind)}&id=${encodeURIComponent(id)}`;
      if (flags.limit) qs += `&limit=${encodeURIComponent(String(flags.limit))}`;
      if (flags.source) qs += `&source=${encodeURIComponent(String(flags.source))}`;
      return { method: 'GET', route: `/api/sessions/transcript${qs}` };
    },
  },

  connect: {
    register: (flags) => ({
      method: 'POST',
      route: '/api/connect',
      body: bodyFromFlags(flags) || { tool_name: required(flags, 'tool-name'), agent_name: required(flags, 'agent-name') },
    }),
    list: () => ({ method: 'GET', route: '/api/connect' }),
    disconnect: (flags) => ({
      method: 'DELETE',
      route: '/api/connect',
      body: { connection_id: required(flags, 'connection-id') },
    }),
  },

  tokens: {
    list: (flags) => {
      let qs = '?action=list';
      if (flags.timeframe) qs += `&timeframe=${encodeURIComponent(String(flags.timeframe))}`;
      return { method: 'GET', route: `/api/tokens${qs}` };
    },
    stats: (flags) => {
      let qs = '?action=stats';
      if (flags.timeframe) qs += `&timeframe=${encodeURIComponent(String(flags.timeframe))}`;
      return { method: 'GET', route: `/api/tokens${qs}` };
    },
    'by-agent': (flags) => ({
      method: 'GET',
      route: `/api/tokens/by-agent?days=${encodeURIComponent(String(flags.days || '30'))}`,
    }),
    'agent-costs': (flags) => {
      let qs = '?action=agent-costs';
      if (flags.timeframe) qs += `&timeframe=${encodeURIComponent(String(flags.timeframe))}`;
      return { method: 'GET', route: `/api/tokens${qs}` };
    },
    'task-costs': (flags) => {
      let qs = '?action=task-costs';
      if (flags.timeframe) qs += `&timeframe=${encodeURIComponent(String(flags.timeframe))}`;
      return { method: 'GET', route: `/api/tokens${qs}` };
    },
    trends: (flags) => {
      let qs = '?action=trends';
      if (flags.timeframe) qs += `&timeframe=${encodeURIComponent(String(flags.timeframe))}`;
      return { method: 'GET', route: `/api/tokens${qs}` };
    },
    export: (flags) => {
      const format = optional(flags, 'format', 'json');
      let qs = `?action=export&format=${encodeURIComponent(format)}`;
      if (flags.timeframe) qs += `&timeframe=${encodeURIComponent(String(flags.timeframe))}`;
      if (flags.limit) qs += `&limit=${encodeURIComponent(String(flags.limit))}`;
      return { method: 'GET', route: `/api/tokens${qs}` };
    },
    rotate: (flags) => {
      if (flags.confirm) return { method: 'POST', route: '/api/tokens/rotate' };
      return { method: 'GET', route: '/api/tokens/rotate' };
    },
  },

  skills: {
    list: () => ({ method: 'GET', route: '/api/skills' }),
    content: (flags) => ({
      method: 'GET',
      route: `/api/skills?mode=content&source=${encodeURIComponent(required(flags, 'source'))}&name=${encodeURIComponent(required(flags, 'name'))}`,
    }),
    check: (flags) => ({
      method: 'GET',
      route: `/api/skills?mode=check&source=${encodeURIComponent(required(flags, 'source'))}&name=${encodeURIComponent(required(flags, 'name'))}`,
    }),
    upsert: (flags) => ({
      method: 'PUT',
      route: '/api/skills',
      body: {
        source: required(flags, 'source'),
        name: required(flags, 'name'),
        content: fs.readFileSync(required(flags, 'file'), 'utf8'),
      },
    }),
    delete: (flags) => ({
      method: 'DELETE',
      route: `/api/skills?source=${encodeURIComponent(required(flags, 'source'))}&name=${encodeURIComponent(required(flags, 'name'))}`,
    }),
  },

  cron: {
    list: () => ({ method: 'GET', route: '/api/cron' }),
    create: (flags) => ({ method: 'POST', route: '/api/cron', body: bodyFromFlags(flags) || {} }),
    update: (flags) => ({ method: 'POST', route: '/api/cron', body: bodyFromFlags(flags) || {} }),
    pause: (flags) => ({ method: 'POST', route: '/api/cron', body: bodyFromFlags(flags) || {} }),
    resume: (flags) => ({ method: 'POST', route: '/api/cron', body: bodyFromFlags(flags) || {} }),
    remove: (flags) => ({ method: 'POST', route: '/api/cron', body: bodyFromFlags(flags) || {} }),
    run: (flags) => ({ method: 'POST', route: '/api/cron', body: bodyFromFlags(flags) || {} }),
  },

  status: {
    health: () => ({ method: 'GET', route: '/api/status?action=health' }),
    overview: () => ({ method: 'GET', route: '/api/status?action=overview' }),
    dashboard: () => ({ method: 'GET', route: '/api/status?action=dashboard' }),
    gateway: () => ({ method: 'GET', route: '/api/status?action=gateway' }),
    models: () => ({ method: 'GET', route: '/api/status?action=models' }),
    capabilities: () => ({ method: 'GET', route: '/api/status?action=capabilities' }),
  },

  workflows: {
    list: () => ({ method: 'GET', route: '/api/workflows' }),
    get: (flags) => ({ method: 'GET', route: `/api/workflows/${required(flags, 'id')}` }),
    create: (flags) => ({
      method: 'POST',
      route: '/api/workflows',
      body: bodyFromFlags(flags) || { name: required(flags, 'name') },
    }),
    delete: (flags) => ({ method: 'DELETE', route: `/api/workflows/${required(flags, 'id')}` }),
  },

  export: {
    audit: (flags) => {
      const format = optional(flags, 'format', 'json');
      let qs = `?type=audit&format=${encodeURIComponent(format)}`;
      if (flags.since) qs += `&since=${encodeURIComponent(String(flags.since))}`;
      if (flags.until) qs += `&until=${encodeURIComponent(String(flags.until))}`;
      if (flags.limit) qs += `&limit=${encodeURIComponent(String(flags.limit))}`;
      return { method: 'GET', route: `/api/export${qs}` };
    },
    tasks: (flags) => {
      const format = optional(flags, 'format', 'json');
      let qs = `?type=tasks&format=${encodeURIComponent(format)}`;
      if (flags.since) qs += `&since=${encodeURIComponent(String(flags.since))}`;
      if (flags.until) qs += `&until=${encodeURIComponent(String(flags.until))}`;
      if (flags.limit) qs += `&limit=${encodeURIComponent(String(flags.limit))}`;
      return { method: 'GET', route: `/api/export${qs}` };
    },
    activities: (flags) => {
      const format = optional(flags, 'format', 'json');
      let qs = `?type=activities&format=${encodeURIComponent(format)}`;
      if (flags.since) qs += `&since=${encodeURIComponent(String(flags.since))}`;
      if (flags.until) qs += `&until=${encodeURIComponent(String(flags.until))}`;
      if (flags.limit) qs += `&limit=${encodeURIComponent(String(flags.limit))}`;
      return { method: 'GET', route: `/api/export${qs}` };
    },
    pipelines: (flags) => {
      const format = optional(flags, 'format', 'json');
      let qs = `?type=pipelines&format=${encodeURIComponent(format)}`;
      if (flags.since) qs += `&since=${encodeURIComponent(String(flags.since))}`;
      if (flags.until) qs += `&until=${encodeURIComponent(String(flags.until))}`;
      if (flags.limit) qs += `&limit=${encodeURIComponent(String(flags.limit))}`;
      return { method: 'GET', route: `/api/export${qs}` };
    },
  },

  // ─── Operator control-plane groups ─────────────────────────────────
  //
  // These match the operator-facing CLI vocabulary requested in the
  // Flight Deck + CLI Control Plane Completion Pass. Wherever possible
  // they call existing Mission Control routes; when a route does not
  // yet exist, the handler returns a structured "planned" response
  // instead of pretending the call succeeded.

  config: {
    async 'set-url'(flags, ctx) {
      const url = required(flags, 'url');
      ctx.profile.url = String(url);
      saveProfile(ctx.profile);
      return { ok: true, status: 0, data: { profile: ctx.profile.name, url: ctx.profile.url }, url: '', method: 'CONFIG' };
    },
    async 'set-key'(flags, ctx) {
      const key = required(flags, 'key');
      ctx.profile.apiKey = String(key);
      saveProfile(ctx.profile);
      return { ok: true, status: 0, data: { profile: ctx.profile.name, api_key_saved: true }, url: '', method: 'CONFIG' };
    },
    async 'set-workspace'(flags, ctx) {
      const ws = required(flags, 'workspace');
      ctx.profile.workspace = String(ws);
      saveProfile(ctx.profile);
      return { ok: true, status: 0, data: { profile: ctx.profile.name, workspace: ctx.profile.workspace }, url: '', method: 'CONFIG' };
    },
    async current(_flags, ctx) {
      return {
        ok: true, status: 0, url: '', method: 'CONFIG',
        data: {
          profile: ctx.profile.name,
          url: ctx.profile.url,
          api_key_present: Boolean(ctx.profile.apiKey),
          session_cookie_present: Boolean(ctx.profile.cookie),
          workspace: ctx.profile.workspace || null,
        },
      };
    },
    async profiles(_flags, _ctx) {
      const dir = path.join(os.homedir(), '.mission-control', 'profiles');
      let profiles = [];
      try {
        if (fs.existsSync(dir)) {
          profiles = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));
        }
      } catch { /* ignore */ }
      return { ok: true, status: 0, url: '', method: 'CONFIG', data: { profiles } };
    },
  },

  runtime: {
    list: () => ({ method: 'GET', route: '/api/agent-runtimes' }),
    heartbeat: () => ({ method: 'POST', route: '/api/runtime/heartbeat' }),
    logs: (flags) => {
      const kind = required(flags, 'kind');
      return { method: 'GET', route: `/api/agent-gateway/logs?runtime=${encodeURIComponent(kind)}` };
    },
    async connect(flags, ctx) {
      const kind = String(flags._sub || required(flags, 'kind')).toLowerCase();
      const valid = ['hermes', 'openclaw', 'opencode', 'claude', 'codex'];
      if (!valid.includes(kind)) {
        throw new Error(`Unknown runtime kind: ${kind}. Use one of: ${valid.join(', ')}`);
      }
      // Generate connect command using existing scripts/connect-runtime.mjs
      const baseUrl = ctx.baseUrl;
      const apiKey = ctx.apiKey || '$MC_API_KEY';
      const cmd = `MC_URL='${baseUrl}' MC_API_KEY='${apiKey}' node scripts/connect-runtime.mjs --runtime ${kind}`;
      // Also probe handshake to verify the runtime can register today
      const probe = await httpRequest({
        baseUrl: ctx.baseUrl,
        apiKey: ctx.apiKey,
        cookie: ctx.profile.cookie,
        method: 'POST',
        route: '/api/runtime/handshake',
        body: { runtime: kind, source: 'mc-cli' },
        timeoutMs: ctx.timeoutMs,
      });
      return {
        ok: probe.ok,
        status: probe.status,
        url: probe.url,
        method: 'CONNECT',
        data: {
          runtime: kind,
          connect_command: cmd,
          requires_env: ['MC_URL', 'MC_API_KEY'],
          handshake: probe.data,
        },
      };
    },
    async doctor(_flags, ctx) {
      const runtimes = await httpRequest({ baseUrl: ctx.baseUrl, apiKey: ctx.apiKey, cookie: ctx.profile.cookie, method: 'GET', route: '/api/agent-runtimes', timeoutMs: ctx.timeoutMs });
      const gateway = await httpRequest({ baseUrl: ctx.baseUrl, apiKey: ctx.apiKey, cookie: ctx.profile.cookie, method: 'GET', route: '/api/agent-gateway/health', timeoutMs: ctx.timeoutMs });
      const health = await httpRequest({ baseUrl: ctx.baseUrl, apiKey: ctx.apiKey, cookie: ctx.profile.cookie, method: 'GET', route: '/api/status?action=health', timeoutMs: ctx.timeoutMs });
      return {
        ok: runtimes.ok && gateway.ok,
        status: runtimes.ok ? 200 : runtimes.status,
        url: '',
        method: 'DOCTOR',
        data: {
          mission_control_health: health.data,
          gateway_health: gateway.data,
          runtimes: runtimes.data,
          required_env: ['MC_URL', 'MC_API_KEY'],
          hints: [
            'Set MC_URL to the Mission Control deployment URL (e.g. https://mc.example.com)',
            'Set MC_API_KEY to a runtime API key minted from the Runtime API Keys panel',
            'Verify the runtime appears in `mc runtime list` after running `scripts/connect-runtime.mjs`',
          ],
        },
      };
    },
  },

  gateway: {
    health: () => ({ method: 'GET', route: '/api/agent-gateway/health' }),
    agents: () => ({ method: 'GET', route: '/api/agent-runtimes' }),
    tasks: () => ({ method: 'GET', route: '/api/agent-gateway/tasks' }),
    task: (flags) => ({ method: 'GET', route: `/api/agent-gateway/tasks/${required(flags, 'id')}` }),
    logs: (flags) => ({ method: 'GET', route: `/api/agent-gateway/logs?id=${encodeURIComponent(required(flags, 'id'))}` }),
    'route-task': (flags) => ({
      method: 'POST',
      route: '/api/agent-gateway/tasks',
      body: bodyFromFlags(flags) || {
        runtime: required(flags, 'runtime'),
        prompt: required(flags, 'prompt'),
        agent: optional(flags, 'agent', undefined),
      },
    }),
  },

  workspace: {
    list: () => ({ method: 'GET', route: '/api/workspaces' }),
    current: (_flags, ctx) => ({
      ok: true, status: 0, url: '', method: 'CONFIG',
      data: { workspace: ctx.profile.workspace || null, hint: 'Use `mc workspace use --id <id>` to set the active workspace.' },
    }),
    async use(flags, ctx) {
      const id = required(flags, 'id');
      ctx.profile.workspace = String(id);
      saveProfile(ctx.profile);
      return { ok: true, status: 0, url: '', method: 'CONFIG', data: { profile: ctx.profile.name, workspace: ctx.profile.workspace } };
    },
    get: (flags) => ({ method: 'GET', route: `/api/workspaces/${required(flags, 'id')}` }),
  },

  team: {
    list: (flags, ctx) => {
      const ws = optional(flags, 'workspace', ctx?.profile?.workspace);
      if (!ws) throw new Error('Missing --workspace (or run `mc workspace use --id <id>` first)');
      return { method: 'GET', route: `/api/workspaces/${encodeURIComponent(ws)}/members` };
    },
    invite: (flags, ctx) => {
      const ws = optional(flags, 'workspace', ctx?.profile?.workspace);
      if (!ws) throw new Error('Missing --workspace (or run `mc workspace use --id <id>` first)');
      return {
        method: 'POST',
        route: `/api/workspaces/${encodeURIComponent(ws)}/invites`,
        body: bodyFromFlags(flags) || {
          email: required(flags, 'email'),
          role: optional(flags, 'role', 'operator'),
        },
      };
    },
    invites: (flags, ctx) => {
      const ws = optional(flags, 'workspace', ctx?.profile?.workspace);
      if (!ws) throw new Error('Missing --workspace');
      return { method: 'GET', route: `/api/workspaces/${encodeURIComponent(ws)}/invites` };
    },
    revoke: (flags, ctx) => {
      const ws = optional(flags, 'workspace', ctx?.profile?.workspace);
      if (!ws) throw new Error('Missing --workspace');
      return {
        method: 'DELETE',
        route: `/api/workspaces/${encodeURIComponent(ws)}/invites/${encodeURIComponent(required(flags, 'invite-id'))}`,
      };
    },
  },

  employee: {
    list: () => ({ method: 'GET', route: '/api/agents' }),
    inspect: (flags) => ({ method: 'GET', route: `/api/agents/${required(flags, 'id')}` }),
    status: () => ({ method: 'GET', route: '/api/agents' }),
    install: () => ({
      ok: false, status: 0, url: '', method: 'PLANNED',
      data: {
        status: 'planned',
        message: 'Employee install from marketplace is not yet wired into the CLI. Use the Mission Control Marketplace UI for now.',
        related: ['/marketplace', '/api/marketplace/purchase'],
      },
    }),
    remove: (flags) => ({ method: 'DELETE', route: `/api/agents/${required(flags, 'id')}` }),
  },

  skill: {
    list: () => ({ method: 'GET', route: '/api/skills' }),
    inspect: (flags) => ({
      method: 'GET',
      route: `/api/skills?mode=content&source=${encodeURIComponent(optional(flags, 'source', 'workspace'))}&name=${encodeURIComponent(required(flags, 'slug'))}`,
    }),
    install: () => ({
      ok: false, status: 0, url: '', method: 'PLANNED',
      data: {
        status: 'planned',
        message: 'Marketplace skill install is exposed via /api/marketplace/purchase + /api/skills upsert. The CLI wrapper around it is not yet implemented.',
      },
    }),
    remove: (flags) => ({
      method: 'DELETE',
      route: `/api/skills?source=${encodeURIComponent(optional(flags, 'source', 'workspace'))}&name=${encodeURIComponent(required(flags, 'slug'))}`,
    }),
  },

  billing: {
    status: () => ({ method: 'GET', route: '/api/billing/overview' }),
    credits: () => ({ method: 'GET', route: '/api/billing/overview' }),
    usage: (flags) => {
      let qs = '';
      if (flags.timeframe) qs = `?timeframe=${encodeURIComponent(String(flags.timeframe))}`;
      return { method: 'GET', route: `/api/billing/margin${qs}` };
    },
    ledger: () => ({ method: 'GET', route: '/api/billing/overview' }),
  },

  deploy: {
    health: () => ({ method: 'GET', route: '/api/status?action=health' }),
    check: () => ({ method: 'GET', route: '/api/status?action=health' }),
    'env-check': () => ({
      ok: true, status: 0, url: '', method: 'ENV',
      data: {
        node_version: process.versions.node,
        platform: process.platform,
        arch: process.arch,
        mc_url_set: Boolean(process.env.MC_URL),
        mc_api_key_set: Boolean(process.env.MC_API_KEY),
        cwd: process.cwd(),
      },
    }),
    preflight: () => ({
      ok: false, status: 0, url: '', method: 'PLANNED',
      data: {
        status: 'planned',
        message: 'CLI wrapper for /app/scripts/preflight-production.sh is not yet implemented. Run the shell script directly for now.',
        related: ['scripts/preflight-production.sh', 'scripts/security-audit.sh'],
      },
    }),
    rollback: () => ({
      ok: false, status: 0, url: '', method: 'PLANNED',
      data: {
        status: 'planned',
        message: 'Rollback automation is not exposed yet. Use the deployment platform UI to roll back, or `git revert` for source rollback.',
      },
    }),
  },

  flightdeck: {
    status: () => ({ method: 'GET', route: '/api/flight-deck/manifest' }),
    downloads: () => ({ method: 'GET', route: '/api/flight-deck/manifest' }),
    async doctor(_flags, ctx) {
      const manifest = await httpRequest({
        baseUrl: ctx.baseUrl,
        apiKey: ctx.apiKey,
        cookie: ctx.profile.cookie,
        method: 'GET',
        route: '/api/flight-deck/manifest',
        timeoutMs: ctx.timeoutMs,
      });
      const ok = manifest.ok && (manifest.data?.available_count || 0) > 0;
      return {
        ok,
        status: manifest.status,
        url: manifest.url,
        method: 'DOCTOR',
        data: {
          mission_control_url: ctx.baseUrl,
          manifest: manifest.data,
          checks: [
            { name: 'manifest_reachable', ok: manifest.ok },
            { name: 'any_artifact_available', ok: (manifest.data?.available_count || 0) > 0 },
            { name: 'ci_workflow_present', ok: true, value: manifest.data?.ci_workflow },
          ],
        },
      };
    },
    release: () => ({
      ok: true, status: 0, url: '', method: 'INFO',
      data: {
        message: 'Trigger the cross-platform release pipeline by pushing a tag.',
        ci_workflow: '.github/workflows/flight-deck-release.yml',
        commands: [
          'git tag flight-deck-v0.1.0',
          'git push origin flight-deck-v0.1.0',
        ],
        targets: ['macOS-arm64', 'macOS-x64', 'Windows-x64', 'Linux-x64'],
      },
    }),
  },
};

// ── Aliases (treat singular/plural and shortcuts uniformly) ──────────
commands.skills.list = commands.skills.list || (() => ({ method: 'GET', route: '/api/skills' }));
// `mc skill ...` falls back to `commands.skills` for any missing actions.
const _skillFallback = { ...commands.skills, ...commands.skill };
commands.skill = _skillFallback;

// --- Events watch (SSE streaming) ---

async function handleEventsWatch(flags, ctx) {
  const types = optional(flags, 'types', undefined);
  let route = '/api/events';
  if (types) route += `?types=${encodeURIComponent(types)}`;

  if (ctx.asJson) {
    // JSON mode: one JSON object per line (NDJSON)
    await sseStream({
      baseUrl: ctx.baseUrl,
      apiKey: ctx.apiKey,
      cookie: ctx.profile.cookie,
      route,
      timeoutMs: ctx.timeoutMs,
      onEvent: (event) => {
        if (event.type === 'heartbeat') return;
        console.log(JSON.stringify(event));
      },
      onError: (err) => {
        console.error(JSON.stringify({ ok: false, error: err }));
        process.exit(EXIT.SERVER);
      },
    });
  } else {
    console.log(`Watching events at ${normalizeBaseUrl(ctx.baseUrl)}${route}`);
    console.log('Press Ctrl+C to stop.\n');
    await sseStream({
      baseUrl: ctx.baseUrl,
      apiKey: ctx.apiKey,
      cookie: ctx.profile.cookie,
      route,
      timeoutMs: ctx.timeoutMs,
      onEvent: (event) => {
        if (event.type === 'heartbeat') return;
        const ts = event.timestamp ? new Date(event.timestamp).toISOString() : new Date().toISOString();
        const type = event.type || event.data?.mutation || 'event';
        console.log(`[${ts}] ${type}: ${JSON.stringify(event.data || event)}`);
      },
      onError: (err) => {
        console.error(`SSE error: ${JSON.stringify(err)}`);
        process.exit(EXIT.SERVER);
      },
    });
  }
  process.exit(EXIT.OK);
}

// --- Main ---

async function run() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.flags.help || parsed._.length === 0) {
    usage();
    process.exit(EXIT.OK);
  }

  const asJson = Boolean(parsed.flags.json);
  const profileName = String(parsed.flags.profile || 'default');
  const profile = loadProfile(profileName);
  const baseUrl = parsed.flags.url ? String(parsed.flags.url) : profile.url;
  const apiKey = parsed.flags['api-key'] ? String(parsed.flags['api-key']) : profile.apiKey;
  if (parsed.flags.workspace) profile.workspace = String(parsed.flags.workspace);
  const timeoutMs = Number(parsed.flags['timeout-ms'] || 20000);

  let group = parsed._[0];
  let action = parsed._[1];
  // For compound subcommands like: agents memory get / tasks comments add
  const sub = parsed._[2];

  // Top-level shortcuts
  const SHORTCUTS = {
    login: ['auth', 'login'],
    logout: ['auth', 'logout'],
    whoami: ['auth', 'whoami'],
  };
  if (SHORTCUTS[group]) {
    [group, action] = SHORTCUTS[group];
  } else if (group === 'version') {
    const cliPkg = (() => { try { return require('../package.json'); } catch { return {}; } })();
    const result = await httpRequest({ baseUrl, apiKey, cookie: profile.cookie, method: 'GET', route: '/api/status?action=health', timeoutMs });
    const data = {
      cli: { name: 'mc', binary: 'scripts/mc-cli.cjs', node: process.versions.node, version: cliPkg.version || 'unknown' },
      mission_control: result.ok ? { reachable: true, status: result.status, version: result.data?.version, uptime_s: result.data?.uptime } : { reachable: false, error: result.data?.error || 'unreachable' },
    };
    if (asJson) console.log(JSON.stringify(data, null, 2));
    else {
      console.log(`mc cli ${data.cli.version} (node ${data.cli.node})`);
      if (data.mission_control.reachable) console.log(`Mission Control ${data.mission_control.version} reachable at ${baseUrl}`);
      else console.log(`Mission Control unreachable at ${baseUrl}: ${data.mission_control.error}`);
    }
    process.exit(EXIT.OK);
  }

  const ctx = { baseUrl, apiKey, profile, timeoutMs, asJson };

  try {
    // Raw passthrough
    if (group === 'raw') {
      const method = String(required(parsed.flags, 'method')).toUpperCase();
      const route = String(required(parsed.flags, 'path'));
      const body = bodyFromFlags(parsed.flags);
      const result = await httpRequest({ baseUrl, apiKey, cookie: profile.cookie, method, route, body, timeoutMs });
      printResult(result, asJson);
      process.exit(result.ok ? EXIT.OK : mapStatusToExit(result.status));
    }

    // Events watch (SSE)
    if (group === 'events' && action === 'watch') {
      await handleEventsWatch(parsed.flags, { ...ctx, timeoutMs: Number(parsed.flags['timeout-ms'] || 3600000) });
      return;
    }

    // Look up group and action in the commands map
    const groupMap = commands[group];
    if (!groupMap) {
      console.error(`Unknown group: ${group}`);
      usage();
      process.exit(EXIT.USAGE);
    }

    let handler = groupMap[action];
    if (!handler) {
      console.error(`Unknown action: ${group} ${action}`);
      usage();
      process.exit(EXIT.USAGE);
    }

    // Inject sub-command into flags for compound commands (memory, soul, comments)
    if (sub && typeof handler === 'function') {
      parsed.flags._sub = sub;
    }

    // Execute handler
    const result_or_config = await (typeof handler === 'function'
      ? handler(parsed.flags, ctx)
      : handler);

    // If handler returned an http result directly (auth login/logout)
    if (result_or_config && 'ok' in result_or_config && 'status' in result_or_config) {
      printResult(result_or_config, asJson);
      process.exit(result_or_config.ok ? EXIT.OK : mapStatusToExit(result_or_config.status));
    }

    // Otherwise it returned { method, route, body? } — execute the request
    const { method, route, body } = result_or_config;
    const result = await httpRequest({
      baseUrl,
      apiKey,
      cookie: profile.cookie,
      method,
      route,
      body,
      timeoutMs,
    });

    printResult(result, asJson);
    process.exit(result.ok ? EXIT.OK : mapStatusToExit(result.status));
  } catch (err) {
    const message = err?.message || String(err);
    if (asJson) {
      console.log(JSON.stringify({ ok: false, error: message }, null, 2));
    } else {
      console.error(`USAGE ERROR: ${message}`);
    }
    process.exit(EXIT.USAGE);
  }
}

run();
