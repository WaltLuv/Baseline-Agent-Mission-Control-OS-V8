// Baseline Flight Deck — secure desktop connector for the Baseline Automations ecosystem.
// Talks to the Rust backend via the global Tauri API (withGlobalTauri: true).
const invoke = window.__TAURI__?.core?.invoke;
const tauriEvent = window.__TAURI__?.event;
const updater = window.__TAURI__?.updater;

const $ = (s) => document.querySelector(s);
function toast(msg, ms = 3200) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add("hidden"), ms);
}

// Plain-English, business-operator-friendly metadata per local connection.
const META = {
  "baseline-os":      { icon: "🛰️", blurb: "Advanced operator workspace — build automations, manage agents & knowledge." },
  "mission-control":  { icon: "🏢", blurb: "Your cloud platform — maintenance, approvals, dispatch, replay & billing." },
  "graphify":         { icon: "🧠", blurb: "Maps your files & projects so your AI workers find things instantly." },
  "openclaw":         { icon: "🦾", blurb: "Runs your local automation workers (e.g. browser automation)." },
  "hermes":           { icon: "📨", blurb: "Your AI operations assistant for messages and tasks." },
};
const FRIENDLY_STATUS = { online: "Connected", offline: "Off", "setup-needed": "Needs setup" };

const EXAMPLES = [
  "open mission control",
  "find a file",
  "run today's maintenance",
  "check what's connected",
  "ask hermes to review today",
];

const SECURITY = [
  { icon: "🔐", t: "Per-device pairing", d: "Each device links to one workspace and can be revoked anytime." },
  { icon: "🏢", t: "Workspace-scoped", d: "This device only sees the workspace it's paired to." },
  { icon: "✅", t: "Approval gates", d: "Sensitive or destructive actions ask for your OK before running." },
  { icon: "🚫", t: "No loose commands", d: "Only an allowlisted, fixed set of actions can run locally — no open terminal." },
  { icon: "🗝️", t: "Encrypted config", d: "No secrets are stored in plain text on this device." },
  { icon: "🎬", t: "Proof & replay", d: "Every action is logged and can be replayed for audit." },
];

// ── Command Bridge routing (mirrors src/lib/flight-deck-command.ts) ──
const DESTRUCTIVE =
  /\b(deploy|delete|remove|drop|charge|bill|billing|payment|invoice|refund|send|email|sms|text|message|publish|prod|production|destroy|wipe|reset|migrate)\b/i;

function routeCommand(raw) {
  const command = (raw || "").trim();
  const t = command.toLowerCase();
  const base = { command, needsApproval: DESTRUCTIVE.test(t), route: null };
  if (/\b(graphify|locate|find|where is|which file|file|structural|codebase|brain)\b/.test(t))
    return { ...base, label: "Graphify", kind: "find", route: "http://localhost:5173/__graphify",
      rationale: "Looks like a file lookup — Graphify maps your projects so this is fast." };
  if (/\b(runtime|runtimes|connected|registry|running|status|health)\b/.test(t))
    return { ...base, label: "This device", kind: "status",
      rationale: "That's a status question — the cards above show what's connected, live." };
  if (/\b(mission control|property|tenant|maintenance|comms|billing|customer|approval|dispatch)\b/.test(t))
    return { ...base, label: "Mission Control", kind: "open", route: "http://localhost:3000",
      rationale: "This belongs in your Mission Control workspace — I'll open it." };
  if (/\b(hermes|ask|review|summari|operator|message|work order)\b/.test(t))
    return { ...base, label: "Hermes · AI assistant", kind: "assistant",
      rationale: "Sounds like a task for your AI assistant — hand it to Hermes." };
  if (/\b(baseline os|flight deck|open os|dashboard|workforce|agent|memory|automation)\b/.test(t))
    return { ...base, label: "Baseline OS", kind: "open", route: "http://localhost:5173/flight-deck",
      rationale: "That's an advanced builder task — Baseline OS is the place." };
  return { ...base, label: "Not sure yet", kind: "—",
    rationale: "I couldn't match that. Try “open mission control”, “find …”, or “ask hermes …”." };
}

// ── Renderers ──
function runtimeCard(rt) {
  const meta = META[rt.id] || { icon: "•", blurb: rt.detail || "" };
  const el = document.createElement("div");
  el.className = `rt s-${rt.status}`;
  const open = rt.url ? `<button class="open-primary mini" data-open="${rt.url}" title="Open ${rt.label}">Open ↗</button>` : "";
  const start = rt.can_start && rt.status !== "online" ? `<button class="cyan mini" data-start="${rt.id}">Start</button>` : "";
  const stop = rt.can_stop && rt.status === "online" ? `<button class="ghost mini" data-stop="${rt.id}">Stop</button>` : "";
  const help = (rt.status !== "online" && !rt.can_start)
    ? `<span class="panel-sub" style="align-self:center">start it from its own app</span>` : "";
  el.innerHTML = `
    <div class="rt-top">
      <span class="rt-ico">${meta.icon}</span>
      <div style="flex:1"><div class="rt-name">${rt.label}</div></div>
      <span class="pill">${FRIENDLY_STATUS[rt.status] || rt.status}</span>
    </div>
    <div class="rt-desc">${meta.blurb}</div>
    <div class="rt-actions">${open}${start}${stop}${help}</div>`;
  return el;
}

function renderSecurity() {
  const g = $("#secure-grid");
  g.innerHTML = "";
  SECURITY.forEach((s) => {
    const d = document.createElement("div");
    d.className = "secure";
    d.innerHTML = `<span class="secure-ico">${s.icon}</span><div><div class="secure-t">${s.t}</div><div class="secure-d">${s.d}</div></div>`;
    g.appendChild(d);
  });
}

// ── Device pairing (real Mission Control handshake; tokens live in keychain) ──
let pollTimer = null;
function show(id, on) { const el = $(id); if (el) el.classList.toggle("hidden", !on); }

async function renderPairing() {
  let st = { paired: false, status: "unpaired", permissions: [] };
  try { st = (await invoke("get_pairing_state")) || st; } catch { /* not in tauri */ }
  const panel = $("#pairing-panel");
  const revoked = st.status === "revoked" || st.status === "expired";

  // reset sub-sections
  show("#pairing-detail", false);

  if (st.paired) {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    panel.classList.add("s-online");
    $("#pairing-ico").textContent = "🔗";
    $("#pairing-title").textContent = `Paired${st.workspace ? " · workspace " + st.workspace : ""}`;
    $("#pairing-sub").textContent = "This device is securely connected to Mission Control" + (st.last_heartbeat_ok === false ? " · last heartbeat failed" : st.last_heartbeat_ok ? " · heartbeat OK" : "") + ".";
    $("#pairing-actions").innerHTML = `<button class="ghost" id="unpair-btn">Unpair</button>`;
    show("#pairing-start", false); show("#pairing-code-box", false); show("#pairing-detail", true);
    $("#pairing-facts").innerHTML =
      `<span class="fact">Role: <b>${st.role || "operator"}</b></span>` +
      `<span class="fact">Device: ${st.device_name || st.device_id?.slice(0,8) || "—"}</span>` +
      `<span class="fact">${st.mission_control_url || ""}</span>`;
    $("#pairing-perms").innerHTML = (st.permissions || []).map((p) => `<span class="perm">${p}</span>`).join("") || `<span class="panel-sub">no permissions granted</span>`;
  } else {
    panel.classList.remove("s-online");
    $("#pairing-ico").textContent = revoked ? "⚠️" : "🔌";
    $("#pairing-title").textContent = revoked
      ? (st.status === "expired" ? "Pairing expired — pair again" : "Device revoked — pair again")
      : "This device isn't paired yet";
    $("#pairing-sub").textContent = revoked
      ? "Mission Control ended this device's access. Pair again to reconnect."
      : "Pairing creates a secure, revocable bridge between this Mac and your Mission Control workspace.";
    $("#pairing-actions").innerHTML = `<button class="primary" id="pair-btn">Pair this device →</button>`;
    show("#pairing-code-box", false);
  }
}

async function startPairing() {
  const url = ($("#mc-url")?.value || "http://localhost:3000").trim();
  try {
    const r = await invoke("pairing_start", { missionControlUrl: url });
    $("#pairing-code").textContent = r.pairing_code || "––––";
    show("#pairing-start", false); show("#pairing-code-box", true);
    $("#pairing-actions").innerHTML = "";
    window.__pairUrl = r.pairing_url;
    // Poll for approval.
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(async () => {
      try {
        const st = await invoke("pairing_poll");
        if (st.paired) { clearInterval(pollTimer); pollTimer = null; renderPairing(); refresh(); toast("Paired ✓"); }
      } catch (e) { /* keep polling */ }
    }, 2500);
  } catch (e) { toast("Pairing failed: " + e); }
}

async function refresh() {
  if (!invoke) { $("#sys-line").textContent = "open this from the Flight Deck app"; return; }
  try {
    const sys = await invoke("get_system_status");
    $("#sys-line").textContent = `${sys.runtimes_online} of ${sys.runtimes_total} connected`;
    $("#foot-version").textContent = `v${sys.version} · ${sys.os}/${sys.arch}`;

    const runtimes = await invoke("get_runtime_status");
    const grid = $("#runtime-grid");
    grid.innerHTML = "";
    runtimes.forEach((rt) => grid.appendChild(runtimeCard(rt)));

    const ports = await invoke("check_ports", {});
    const row = $("#ports-row");
    row.innerHTML = "";
    ports.forEach((p) => {
      const c = document.createElement("span");
      c.className = `port ${p.open ? "open" : ""}`;
      c.textContent = `:${p.port} ${p.open ? "● open" : "○ closed"}`;
      row.appendChild(c);
    });
    await renderPairing();
  } catch (e) {
    toast("Couldn't refresh: " + e);
  }
}

// ── Welcome guide (dismiss persisted in localStorage) ──
function setWelcome(show) { $("#welcome").classList.toggle("hidden", !show); }
$("#welcome-close").addEventListener("click", () => { localStorage.setItem("fd_onboarded", "1"); setWelcome(false); });
$("#help-btn").addEventListener("click", () => setWelcome($("#welcome").classList.contains("hidden")));

// ── Example chips ──
function renderExamples() {
  const box = $("#bridge-examples");
  EXAMPLES.forEach((ex) => {
    const b = document.createElement("button");
    b.className = "ex";
    b.textContent = ex;
    b.addEventListener("click", () => { $("#bridge-input").value = ex; route(); });
    box.appendChild(b);
  });
}

function route() {
  const plan = routeCommand($("#bridge-input").value);
  const box = $("#bridge-plan");
  box.classList.remove("hidden");
  box.innerHTML = `
    <div class="route-to">
      <span class="panel-sub">goes to</span>
      <span class="tag system">${plan.label}</span>
      ${plan.kind !== "—" ? `<span class="tag kind">${plan.kind}</span>` : ""}
      ${plan.needsApproval ? '<span class="tag gate">needs your OK</span>' : ""}
      ${plan.route ? `<button class="open-primary mini" data-open="${plan.route}">Open ↗</button>` : ""}
    </div>
    <div class="rationale">${plan.rationale}</div>`;
}

// ── Events ──
document.addEventListener("click", async (ev) => {
  const t = ev.target.closest("button");
  if (!t || !invoke) return;
  if (t.id === "pair-btn") {
    show("#pairing-start", true); show("#pairing-code-box", false);
    $("#pairing-actions").innerHTML = "";
    return;
  }
  if (t.id === "start-btn") { await startPairing(); return; }
  if (t.id === "open-mc-btn") {
    try { await invoke("open_local_url", { url: window.__pairUrl || "http://localhost:3000" }); } catch (e) { toast(String(e)); }
    return;
  }
  if (t.id === "cancel-pair-btn") {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    show("#pairing-code-box", false); renderPairing();
    return;
  }
  if (t.id === "unpair-btn") {
    try { await invoke("unpair"); toast("This device is no longer paired."); renderPairing(); refresh(); } catch (e) { toast(String(e)); }
    return;
  }
  if (t.dataset.open) {
    try { await invoke("open_local_url", { url: t.dataset.open }); toast("Opening…"); }
    catch (e) { toast("Can't open that: " + e); }
  } else if (t.dataset.start) {
    try { const r = await invoke("start_runtime", { id: t.dataset.start }); toast(r.message); setTimeout(refresh, 700); }
    catch (e) { toast(String(e)); }
  } else if (t.dataset.stop) {
    try { const r = await invoke("stop_runtime", { id: t.dataset.stop }); toast(r.message); setTimeout(refresh, 700); }
    catch (e) { toast(String(e)); }
  }
});
$("#refresh-btn").addEventListener("click", () => { refresh(); toast("Refreshed"); });
$("#bridge-route").addEventListener("click", route);
$("#bridge-input").addEventListener("keydown", (e) => { if (e.key === "Enter") route(); });
$("#update-btn").addEventListener("click", async () => {
  if (!updater) { toast("Updates work in the installed app."); return; }
  try {
    const update = await updater.check();
    toast(update ? `Update available: ${update.version}` : "You're on the latest version.");
  } catch { toast("No update feed yet — you're current."); }
});
document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "r") { e.preventDefault(); refresh(); }
});

// Heartbeat: when paired, ping Mission Control so it shows this device online.
// A revoked/expired token clears local auth (handled in the Rust command) and
// renderPairing() then shows the "pair again" state.
async function heartbeatTick() {
  if (!invoke) return;
  try {
    const st = await invoke("get_pairing_state");
    if (st && st.paired) {
      await invoke("device_heartbeat");
      renderPairing();
    }
  } catch { /* offline / not paired */ }
}

if (tauriEvent) tauriEvent.listen("flight-deck-ready", () => refresh());
setWelcome(localStorage.getItem("fd_onboarded") !== "1");
renderExamples();
renderSecurity();
refresh();
setInterval(refresh, 8000);
heartbeatTick();
setInterval(heartbeatTick, 30000);
