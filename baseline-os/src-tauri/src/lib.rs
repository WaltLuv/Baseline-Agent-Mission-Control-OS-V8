//! Baseline Flight Deck — the secure desktop connector for the PropControl
//! ecosystem.
//!
//! Flight Deck is a customer-facing desktop app (not a personal tool) that lets
//! any business operator securely bridge their local machine — files, runtimes,
//! browser workers, AI workforce — to their Mission Control cloud workspace.
//!
//! The connector controls and monitors local runtimes (Baseline OS, Mission
//! Control, Hermes, OpenClaw, Graphify) via a small, SAFE command surface.
//! Everything here is read-only or strictly allowlisted:
//!   * no arbitrary shell execution — `start/stop_runtime` only run fixed,
//!     pre-registered argv vectors for known runtimes,
//!   * `open_local_url` only opens loopback URLs,
//!   * `read/write_safe_config` only touches an allowlisted set of non-secret
//!     keys in the app config dir (0600), and refuses anything secret-looking.
//!
//! Frontend calls these via `window.__TAURI__.core.invoke` (withGlobalTauri).

use std::collections::BTreeMap;
use std::io::{Read, Write};
use std::net::{TcpStream, ToSocketAddrs};
use std::path::PathBuf;
use std::time::Duration;

use serde::Serialize;
use serde_json::{json, Value};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
use tauri_plugin_opener::OpenerExt;

// ── Runtime registry ────────────────────────────────────────────────────
// The fixed set of local runtimes the cockpit knows about. `port` (when set)
// is probed read-only over TCP. `launchd_label` runtimes are checked via
// `launchctl list`. Nothing here is user-supplied.

#[derive(Clone)]
struct RuntimeDef {
    id: &'static str,
    label: &'static str,
    kind: &'static str, // "web" | "gateway" | "sidecar" | "launchd"
    port: Option<u16>,
    url: Option<&'static str>,
    launchd_label: Option<&'static str>,
}

fn registry() -> Vec<RuntimeDef> {
    vec![
        RuntimeDef { id: "baseline-os", label: "Baseline OS", kind: "web", port: Some(5173), url: Some("http://localhost:5173"), launchd_label: None },
        RuntimeDef { id: "mission-control", label: "Mission Control", kind: "web", port: Some(3000), url: Some("http://localhost:3000"), launchd_label: None },
        RuntimeDef { id: "graphify", label: "Graphify", kind: "sidecar", port: Some(5173), url: Some("http://localhost:5173/__graphify"), launchd_label: None },
        RuntimeDef { id: "openclaw", label: "OpenClaw Gateway", kind: "gateway", port: Some(18789), url: Some("http://localhost:18789"), launchd_label: None },
        RuntimeDef { id: "hermes", label: "Hermes", kind: "launchd", port: None, url: None, launchd_label: Some("ai.hermes.gateway") },
    ]
}

// ── Start/stop allowlist ─────────────────────────────────────────────────
// Maps a runtime id to FIXED argv vectors. Anything not listed cannot be
// started/stopped from the cockpit (returns NotConfigured). No shell, no
// interpolation of user input — argv is constructed here only.

fn home() -> PathBuf {
    std::env::var_os("HOME").map(PathBuf::from).unwrap_or_default()
}

struct RuntimeAction {
    program: String,
    args: Vec<String>,
}

fn start_action(id: &str) -> Option<RuntimeAction> {
    match id {
        // Hermes runs under launchd; loading the agent is safe & idempotent.
        "hermes" => Some(RuntimeAction {
            program: "launchctl".into(),
            args: vec![
                "load".into(),
                "-w".into(),
                home()
                    .join("Library/LaunchAgents/ai.hermes.gateway.plist")
                    .to_string_lossy()
                    .into_owned(),
            ],
        }),
        _ => None,
    }
}

fn stop_action(id: &str) -> Option<RuntimeAction> {
    match id {
        "hermes" => Some(RuntimeAction {
            program: "launchctl".into(),
            args: vec![
                "unload".into(),
                home()
                    .join("Library/LaunchAgents/ai.hermes.gateway.plist")
                    .to_string_lossy()
                    .into_owned(),
            ],
        }),
        _ => None,
    }
}

// ── Health probing ───────────────────────────────────────────────────────

fn port_open(port: u16) -> bool {
    let addr = format!("127.0.0.1:{port}");
    if let Ok(mut iter) = addr.to_socket_addrs() {
        if let Some(sock) = iter.next() {
            return TcpStream::connect_timeout(&sock, Duration::from_millis(350)).is_ok();
        }
    }
    false
}

fn launchd_loaded(label: &str) -> bool {
    // `launchctl list <label>` exits 0 when the job is loaded. Fixed argv.
    std::process::Command::new("launchctl")
        .arg("list")
        .arg(label)
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

#[derive(Serialize)]
struct RuntimeStatus {
    id: String,
    label: String,
    kind: String,
    status: String, // "online" | "offline" | "setup-needed"
    detail: String,
    url: Option<String>,
    can_start: bool,
    can_stop: bool,
}

fn status_for(def: &RuntimeDef) -> RuntimeStatus {
    let (status, detail) = match def.kind {
        "launchd" => {
            let label = def.launchd_label.unwrap_or("");
            if launchd_loaded(label) {
                ("online".to_string(), format!("launchd job {label} loaded"))
            } else {
                ("offline".to_string(), format!("launchd job {label} not loaded"))
            }
        }
        _ => {
            if let Some(p) = def.port {
                if port_open(p) {
                    ("online".to_string(), format!("listening on :{p}"))
                } else {
                    ("offline".to_string(), format!("nothing on :{p} — start it"))
                }
            } else {
                ("setup-needed".to_string(), "no probe configured".to_string())
            }
        }
    };
    RuntimeStatus {
        id: def.id.to_string(),
        label: def.label.to_string(),
        kind: def.kind.to_string(),
        status,
        detail,
        url: def.url.map(|u| u.to_string()),
        can_start: start_action(def.id).is_some(),
        can_stop: stop_action(def.id).is_some(),
    }
}

// ── Commands ───────────────────────────────────────────────────────────

#[tauri::command]
fn get_runtime_status() -> Vec<RuntimeStatus> {
    registry().iter().map(status_for).collect()
}

#[tauri::command]
fn get_system_status(app: AppHandle) -> Value {
    let defs = registry();
    let statuses: Vec<RuntimeStatus> = defs.iter().map(status_for).collect();
    let online = statuses.iter().filter(|s| s.status == "online").count();
    json!({
        "app": "Baseline Flight Deck",
        "version": app.package_info().version.to_string(),
        "os": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
        "family": std::env::consts::FAMILY,
        "runtimes_total": statuses.len(),
        "runtimes_online": online,
    })
}

#[derive(Serialize)]
struct PortStatus {
    port: u16,
    open: bool,
}

#[tauri::command]
fn check_ports(ports: Option<Vec<u16>>) -> Vec<PortStatus> {
    let list = ports.unwrap_or_else(|| {
        registry().iter().filter_map(|d| d.port).collect::<Vec<_>>()
    });
    list.into_iter()
        .map(|p| PortStatus { port: p, open: port_open(p) })
        .collect()
}

/// Only loopback http(s) URLs may be opened — never arbitrary external URLs.
fn is_local_url(url: &str) -> bool {
    let lower = url.to_lowercase();
    let rest = if let Some(r) = lower.strip_prefix("http://") {
        r
    } else if let Some(r) = lower.strip_prefix("https://") {
        r
    } else {
        return false;
    };
    let host = rest.split(['/', ':']).next().unwrap_or("");
    matches!(host, "localhost" | "127.0.0.1" | "0.0.0.0" | "::1")
}

#[tauri::command]
fn open_local_url(app: AppHandle, url: String) -> Result<(), String> {
    if !is_local_url(&url) {
        return Err(format!("refused: only loopback URLs may be opened (got {url})"));
    }
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|e| e.to_string())
}

#[derive(Serialize)]
struct ActionResult {
    ok: bool,
    runtime: String,
    message: String,
}

fn run_action(id: &str, action: Option<RuntimeAction>, verb: &str) -> Result<ActionResult, String> {
    let action = action.ok_or_else(|| {
        format!("{verb} isn't available for '{id}' yet — start it from its own app. (Full local runtime control is on the roadmap.)")
    })?;
    // Fixed argv, no shell. Never echoes environment or secrets.
    let out = std::process::Command::new(&action.program)
        .args(&action.args)
        .output()
        .map_err(|e| format!("failed to run {}: {e}", action.program))?;
    let ok = out.status.success();
    let mut message = if ok {
        format!("{verb} dispatched to {id}")
    } else {
        let err = String::from_utf8_lossy(&out.stderr);
        format!("{verb} failed for {id}: {}", err.trim())
    };
    if message.is_empty() {
        message = format!("{verb} {id}");
    }
    Ok(ActionResult { ok, runtime: id.to_string(), message })
}

#[tauri::command]
fn start_runtime(id: String) -> Result<ActionResult, String> {
    run_action(&id, start_action(&id), "start")
}

#[tauri::command]
fn stop_runtime(id: String) -> Result<ActionResult, String> {
    run_action(&id, stop_action(&id), "stop")
}

// ── Secure local config (non-secret prefs only) ──────────────────────────

// Allowlisted preference keys. Nothing secret may be stored here — pairing
// TOKENS belong in the OS keychain (Phase 2), never this plaintext file. These
// are non-secret identifiers that support the per-user / per-workspace /
// per-device model.
const ALLOWED_CONFIG_KEYS: &[&str] = &[
    "theme",
    "last_view",
    "window_width",
    "window_height",
    "auto_check_updates",
    "runtime_endpoints",
    // Device-pairing / multi-workspace identifiers (non-secret):
    "mission_control_url",
    "workspace",
    "workspace_id",
    "device_name",
    "role",
    "paired",
];

fn key_is_secretish(k: &str) -> bool {
    let l = k.to_lowercase();
    ["secret", "token", "password", "passwd", "apikey", "api_key", "key", "credential", "auth"]
        .iter()
        .any(|bad| l.contains(bad))
}

fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("no app config dir: {e}"))?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("flight-deck.json"))
}

#[cfg(unix)]
fn lock_perms(path: &PathBuf) {
    use std::os::unix::fs::PermissionsExt;
    let _ = std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600));
}
#[cfg(not(unix))]
fn lock_perms(_path: &PathBuf) {}

#[tauri::command]
fn read_safe_config(app: AppHandle) -> Result<Value, String> {
    let path = config_path(&app)?;
    if !path.exists() {
        return Ok(json!({}));
    }
    let mut s = String::new();
    std::fs::File::open(&path)
        .and_then(|mut f| f.read_to_string(&mut s))
        .map_err(|e| e.to_string())?;
    let v: Value = serde_json::from_str(&s).unwrap_or_else(|_| json!({}));
    Ok(v)
}

#[tauri::command]
fn write_safe_config(app: AppHandle, patch: BTreeMap<String, Value>) -> Result<Value, String> {
    // Reject anything that isn't an explicitly allowed, non-secret pref.
    for (k, _) in patch.iter() {
        if key_is_secretish(k) {
            return Err(format!("refused: '{k}' looks like a secret — secrets are never stored here"));
        }
        if !ALLOWED_CONFIG_KEYS.contains(&k.as_str()) {
            return Err(format!("refused: '{k}' is not an allowed config key"));
        }
    }
    let path = config_path(&app)?;
    let mut current = match read_safe_config(app.clone())? {
        Value::Object(m) => m,
        _ => serde_json::Map::new(),
    };
    for (k, v) in patch {
        current.insert(k, v);
    }
    let merged = Value::Object(current);
    let body = serde_json::to_string_pretty(&merged).map_err(|e| e.to_string())?;
    let mut f = std::fs::File::create(&path).map_err(|e| e.to_string())?;
    f.write_all(body.as_bytes()).map_err(|e| e.to_string())?;
    lock_perms(&path);
    Ok(merged)
}

// ── Window / tray / shortcut wiring ──────────────────────────────────────

fn toggle_main_window(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        match win.is_visible() {
            Ok(true) => {
                let _ = win.hide();
            }
            _ => {
                let _ = win.show();
                let _ = win.set_focus();
            }
        }
    }
}

fn show_main_window(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Cmd+Shift+F (Ctrl+Shift+F off-mac) toggles the cockpit globally.
    let toggle = Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::KeyF);
    let toggle_for_handler = toggle;

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |app, shortcut, event| {
                    if event.state == ShortcutState::Pressed && shortcut == &toggle_for_handler {
                        toggle_main_window(app);
                    }
                })
                .build(),
        )
        .setup(move |app| {
            let handle = app.handle().clone();

            // Register the global shortcut.
            if let Err(e) = app.global_shortcut().register(toggle) {
                eprintln!("[flight-deck] global shortcut register failed: {e}");
            }

            // System tray with a menu + click-to-toggle.
            let show_item = MenuItem::with_id(app, "show", "Show Flight Deck", true, None::<&str>)?;
            let hide_item = MenuItem::with_id(app, "hide", "Hide", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit Flight Deck", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &hide_item, &quit_item])?;

            let _tray = TrayIconBuilder::with_id("main")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Baseline Flight Deck")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => show_main_window(app),
                    "hide" => {
                        if let Some(win) = app.get_webview_window("main") {
                            let _ = win.hide();
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, .. } = event {
                        toggle_main_window(tray.app_handle());
                    }
                })
                .build(app)?;

            let _ = handle.emit("flight-deck-ready", true);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_system_status,
            get_runtime_status,
            check_ports,
            open_local_url,
            start_runtime,
            stop_runtime,
            read_safe_config,
            write_safe_config
        ])
        .run(tauri::generate_context!())
        .expect("error while running Baseline Flight Deck");
}

// ── Tests: prove the security boundary ───────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_loopback_urls_open() {
        assert!(is_local_url("http://localhost:5173"));
        assert!(is_local_url("http://127.0.0.1:3000/app"));
        assert!(is_local_url("https://localhost:3000"));
        assert!(!is_local_url("http://evil.com"));
        assert!(!is_local_url("https://example.com/app"));
        assert!(!is_local_url("file:///etc/passwd"));
        assert!(!is_local_url("http://localhost.evil.com"));
        assert!(!is_local_url("javascript:alert(1)"));
    }

    #[test]
    fn start_stop_allowlist_rejects_unknown() {
        assert!(start_action("hermes").is_some());
        assert!(stop_action("hermes").is_some());
        assert!(start_action("rm-rf").is_none());
        assert!(start_action("baseline-os").is_none()); // not start-configured yet (Phase 2)
        assert!(stop_action("../../bin/sh").is_none());
    }

    #[test]
    fn config_rejects_secretish_keys() {
        assert!(key_is_secretish("api_key"));
        assert!(key_is_secretish("STRIPE_SECRET_KEY"));
        assert!(key_is_secretish("auth_token"));
        assert!(key_is_secretish("password"));
        assert!(!key_is_secretish("theme"));
        assert!(!key_is_secretish("last_view"));
    }

    #[test]
    fn config_keys_are_allowlisted() {
        assert!(ALLOWED_CONFIG_KEYS.contains(&"theme"));
        assert!(!ALLOWED_CONFIG_KEYS.contains(&"arbitrary_key"));
    }

    #[test]
    fn pairing_identifiers_allowed_but_tokens_rejected() {
        // Non-secret pairing/workspace identifiers are storable.
        for k in ["workspace", "workspace_id", "device_name", "mission_control_url", "role", "paired"] {
            assert!(ALLOWED_CONFIG_KEYS.contains(&k), "missing pairing key {k}");
            assert!(!key_is_secretish(k), "{k} wrongly flagged secret");
        }
        // But a pairing TOKEN must never be storable here.
        assert!(key_is_secretish("pairing_token"));
        assert!(key_is_secretish("device_auth_token"));
    }

    #[test]
    fn registry_has_all_runtimes() {
        let ids: Vec<&str> = registry().iter().map(|r| r.id).collect();
        for want in ["baseline-os", "mission-control", "graphify", "openclaw", "hermes"] {
            assert!(ids.contains(&want), "missing runtime {want}");
        }
    }
}
