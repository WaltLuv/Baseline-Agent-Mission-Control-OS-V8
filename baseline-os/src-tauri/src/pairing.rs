//! Flight Deck pairing client — talks to Mission Control's device-pairing API.
//!
//! Security: the **device token** and the **claim token** are SECRETS and are
//! stored in the OS keychain (macOS Keychain via the `keyring` crate), never in
//! the plaintext pairing-state file. The state file holds only non-secret
//! metadata (device id/name, workspace, role, permissions, MC url, paired flag).
//! Tokens are never returned to the frontend and never logged.

use std::io::{Read, Write};
use std::path::PathBuf;

use serde::Serialize;
use serde_json::{json, Value};
use tauri::{AppHandle, Manager};

const KEYCHAIN_SERVICE: &str = "com.baseline.flightdeck";
const KC_DEVICE_TOKEN: &str = "device_token";
const KC_CLAIM_TOKEN: &str = "claim_token";

// ── Keychain helpers (secrets only) ──────────────────────────────────────
fn kc(account: &str) -> keyring::Result<keyring::Entry> {
    keyring::Entry::new(KEYCHAIN_SERVICE, account)
}
fn kc_set(account: &str, secret: &str) -> Result<(), String> {
    kc(account).and_then(|e| e.set_password(secret)).map_err(|e| e.to_string())
}
fn kc_get(account: &str) -> Option<String> {
    kc(account).ok().and_then(|e| e.get_password().ok())
}
fn kc_delete(account: &str) {
    if let Ok(e) = kc(account) {
        let _ = e.delete_credential();
    }
}

// ── Non-secret pairing-state file (0600) ─────────────────────────────────
fn state_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("pairing.json"))
}

fn read_state(app: &AppHandle) -> Value {
    let Ok(p) = state_path(app) else { return json!({}) };
    if !p.exists() {
        return json!({});
    }
    let mut s = String::new();
    if std::fs::File::open(&p).and_then(|mut f| f.read_to_string(&mut s)).is_ok() {
        serde_json::from_str(&s).unwrap_or_else(|_| json!({}))
    } else {
        json!({})
    }
}

fn write_state(app: &AppHandle, v: &Value) -> Result<(), String> {
    let p = state_path(app)?;
    let body = serde_json::to_string_pretty(v).map_err(|e| e.to_string())?;
    let mut f = std::fs::File::create(&p).map_err(|e| e.to_string())?;
    f.write_all(body.as_bytes()).map_err(|e| e.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(&p, std::fs::Permissions::from_mode(0o600));
    }
    Ok(())
}

fn merge_state(app: &AppHandle, patch: Value) -> Result<Value, String> {
    let mut cur = match read_state(app) {
        Value::Object(m) => m,
        _ => serde_json::Map::new(),
    };
    if let Value::Object(p) = patch {
        for (k, val) in p {
            cur.insert(k, val);
        }
    }
    let merged = Value::Object(cur);
    write_state(app, &merged)?;
    Ok(merged)
}

fn device_id(app: &AppHandle) -> String {
    let st = read_state(app);
    if let Some(id) = st.get("device_id").and_then(|v| v.as_str()) {
        return id.to_string();
    }
    let id = uuid::Uuid::new_v4().to_string();
    let _ = merge_state(app, json!({ "device_id": id }));
    id
}

fn device_name() -> String {
    std::env::var("HOST")
        .ok()
        .or_else(|| std::env::var("HOSTNAME").ok())
        .unwrap_or_else(|| "My Mac".to_string())
}

fn normalize_url(raw: &str) -> String {
    let t = raw.trim().trim_end_matches('/');
    if t.is_empty() {
        "http://localhost:3000".to_string()
    } else if t.starts_with("http://") || t.starts_with("https://") {
        t.to_string()
    } else {
        format!("http://{t}")
    }
}

// ── Command results ───────────────────────────────────────────────────────
#[derive(Serialize)]
pub struct PairingStart {
    device_id: String,
    pairing_code: String,
    pairing_url: String,
    expires_at: Option<i64>,
}

#[derive(Serialize, Default)]
pub struct PairingState {
    paired: bool,
    status: String, // "unpaired" | "pending" | "paired" | "revoked" | "expired"
    mission_control_url: Option<String>,
    workspace: Option<String>,
    role: Option<String>,
    permissions: Vec<String>,
    device_id: Option<String>,
    device_name: Option<String>,
    last_heartbeat_ok: Option<bool>,
}

fn http() -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(12))
        .build()
        .unwrap_or_default()
}

// ── Commands ───────────────────────────────────────────────────────────

/// Begin pairing: register a pending device with Mission Control, stash the
/// (secret) claim token in the keychain, and return the human pairing code + URL.
#[tauri::command]
pub async fn pairing_start(app: AppHandle, mission_control_url: String) -> Result<PairingStart, String> {
    let mc = normalize_url(&mission_control_url);
    let dev_id = device_id(&app);
    let body = json!({
        "device_id": dev_id,
        "device_name": device_name(),
        "device_type": "desktop",
        "platform": std::env::consts::OS,
        "app_version": app.package_info().version.to_string(),
    });
    let res = http()
        .post(format!("{mc}/api/devices/pairing/start"))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("couldn't reach Mission Control at {mc}: {e}"))?;
    if !res.status().is_success() {
        return Err(format!("pairing start failed ({})", res.status()));
    }
    let j: Value = res.json().await.map_err(|e| e.to_string())?;
    let pairing_code = j.get("pairing_code").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let claim_token = j.get("claim_token").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let pairing_url = j
        .get("pairing_url")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| format!("{mc}/app/flight-deck"));
    let expires_at = j.get("expires_at").and_then(|v| v.as_i64());

    // Claim token is a SECRET → keychain, never the state file.
    kc_set(KC_CLAIM_TOKEN, &claim_token)?;
    merge_state(
        &app,
        json!({ "mission_control_url": mc, "status": "pending", "paired": false, "device_name": device_name() }),
    )?;

    Ok(PairingStart { device_id: dev_id, pairing_code, pairing_url, expires_at })
}

/// Poll Mission Control after the user approves. On first success the device
/// token is issued ONCE → store it in the keychain; persist non-secret metadata.
#[tauri::command]
pub async fn pairing_poll(app: AppHandle) -> Result<PairingState, String> {
    let st = read_state(&app);
    let mc = st.get("mission_control_url").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let dev_id = device_id(&app);
    let Some(claim) = kc_get(KC_CLAIM_TOKEN) else {
        return Ok(get_pairing_state(app.clone()).await);
    };
    let url = format!("{mc}/api/devices/{}/status?claim={}", dev_id, urlencode(&claim));
    let res = http().get(url).send().await.map_err(|e| e.to_string())?;
    let j: Value = res.json().await.map_err(|e| e.to_string())?;
    let status = j.get("status").and_then(|v| v.as_str()).unwrap_or("pending");

    if status == "paired" {
        if let Some(tok) = j.get("device_token").and_then(|v| v.as_str()) {
            // First successful claim — store the device token (secret) in keychain.
            kc_set(KC_DEVICE_TOKEN, tok)?;
            kc_delete(KC_CLAIM_TOKEN); // claim token is single-use, drop it
        }
        let role = j.get("role").and_then(|v| v.as_str()).unwrap_or("operator").to_string();
        let perms: Vec<String> = j
            .get("permissions")
            .and_then(|v| v.as_array())
            .map(|a| a.iter().filter_map(|x| x.as_str().map(String::from)).collect())
            .unwrap_or_default();
        let workspace = j.get("workspace_id").map(|v| v.to_string());
        merge_state(
            &app,
            json!({ "paired": true, "status": "paired", "role": role, "permissions": perms, "workspace": workspace }),
        )?;
    }
    Ok(get_pairing_state(app.clone()).await)
}

/// Heartbeat using the device token from the keychain. Revoked/expired → wipe
/// the local token and mark unpaired so the UI prompts to pair again.
#[tauri::command]
pub async fn device_heartbeat(app: AppHandle) -> Result<PairingState, String> {
    let st = read_state(&app);
    let mc = st.get("mission_control_url").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let Some(token) = kc_get(KC_DEVICE_TOKEN) else {
        return Ok(get_pairing_state(app.clone()).await);
    };
    let res = http()
        .post(format!("{mc}/api/devices/heartbeat"))
        .header("authorization", format!("Bearer {token}"))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if res.status().as_u16() == 401 || res.status().as_u16() == 410 {
        // Revoked / expired → clear local auth.
        kc_delete(KC_DEVICE_TOKEN);
        let status = if res.status().as_u16() == 410 { "expired" } else { "revoked" };
        merge_state(&app, json!({ "paired": false, "status": status, "last_heartbeat_ok": false }))?;
        return Ok(get_pairing_state(app.clone()).await);
    }

    if res.status().is_success() {
        let j: Value = res.json().await.unwrap_or_else(|_| json!({}));
        let role = j.get("role").and_then(|v| v.as_str()).map(String::from);
        let perms: Option<Vec<String>> = j
            .get("permissions")
            .and_then(|v| v.as_array())
            .map(|a| a.iter().filter_map(|x| x.as_str().map(String::from)).collect());
        let mut patch = json!({ "paired": true, "status": "paired", "last_heartbeat_ok": true });
        if let Some(r) = role {
            patch["role"] = json!(r);
        }
        if let Some(p) = perms {
            patch["permissions"] = json!(p);
        }
        merge_state(&app, patch)?;
    }
    Ok(get_pairing_state(app.clone()).await)
}

/// Current pairing state for the UI. Never returns any token.
#[tauri::command]
pub async fn get_pairing_state(app: AppHandle) -> PairingState {
    let st = read_state(&app);
    let has_token = kc_get(KC_DEVICE_TOKEN).is_some();
    let paired = has_token && st.get("paired").and_then(|v| v.as_bool()).unwrap_or(false);
    PairingState {
        paired,
        status: st
            .get("status")
            .and_then(|v| v.as_str())
            .unwrap_or(if paired { "paired" } else { "unpaired" })
            .to_string(),
        mission_control_url: st.get("mission_control_url").and_then(|v| v.as_str()).map(String::from),
        workspace: st.get("workspace").and_then(|v| v.as_str()).map(String::from),
        role: st.get("role").and_then(|v| v.as_str()).map(String::from),
        permissions: st
            .get("permissions")
            .and_then(|v| v.as_array())
            .map(|a| a.iter().filter_map(|x| x.as_str().map(String::from)).collect())
            .unwrap_or_default(),
        device_id: st.get("device_id").and_then(|v| v.as_str()).map(String::from),
        device_name: st.get("device_name").and_then(|v| v.as_str()).map(String::from),
        last_heartbeat_ok: st.get("last_heartbeat_ok").and_then(|v| v.as_bool()),
    }
}

/// Unpair locally: delete tokens from the keychain and clear pairing metadata.
#[tauri::command]
pub async fn unpair(app: AppHandle) -> Result<PairingState, String> {
    kc_delete(KC_DEVICE_TOKEN);
    kc_delete(KC_CLAIM_TOKEN);
    merge_state(
        &app,
        json!({ "paired": false, "status": "unpaired", "workspace": Value::Null, "role": Value::Null, "permissions": [] }),
    )?;
    Ok(get_pairing_state(app.clone()).await)
}

fn urlencode(s: &str) -> String {
    s.bytes()
        .map(|b| match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => (b as char).to_string(),
            _ => format!("%{:02X}", b),
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn url_normalization() {
        assert_eq!(normalize_url("localhost:3000"), "http://localhost:3000");
        assert_eq!(normalize_url("https://mc.example.com/"), "https://mc.example.com");
        assert_eq!(normalize_url("  "), "http://localhost:3000");
    }

    #[test]
    fn urlencode_escapes_claim() {
        assert_eq!(urlencode("abc123"), "abc123");
        assert_eq!(urlencode("a/b c"), "a%2Fb%20c");
    }
}
