// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};
use tauri_plugin_store::StoreExt;

/// Default Mission Control URLs. The desktop shell never hardcodes secrets;
/// it only points at a URL the user (or the operator's IT) explicitly chose.
const DEFAULT_PRODUCTION_URL: &str = "https://app.baselineos.com";
const DEFAULT_LOCALHOST_URL: &str = "http://localhost:3000";

#[derive(Debug, Clone, Serialize, Deserialize)]
struct FlightDeckSettings {
    environment: String, // "production" | "staging" | "localhost" | "custom"
    mission_control_url: String,
    remember_last_workspace: bool,
}

impl Default for FlightDeckSettings {
    fn default() -> Self {
        Self {
            environment: "production".to_string(),
            mission_control_url: DEFAULT_PRODUCTION_URL.to_string(),
            remember_last_workspace: true,
        }
    }
}

#[tauri::command]
fn get_settings(app: tauri::AppHandle) -> Result<FlightDeckSettings, String> {
    let store = app
        .store("flight-deck-settings.json")
        .map_err(|e| e.to_string())?;
    let env = store
        .get("environment")
        .and_then(|v| v.as_str().map(String::from))
        .unwrap_or_else(|| "production".to_string());
    let url = store
        .get("mission_control_url")
        .and_then(|v| v.as_str().map(String::from))
        .unwrap_or_else(|| DEFAULT_PRODUCTION_URL.to_string());
    let remember = store
        .get("remember_last_workspace")
        .and_then(|v| v.as_bool())
        .unwrap_or(true);
    Ok(FlightDeckSettings {
        environment: env,
        mission_control_url: url,
        remember_last_workspace: remember,
    })
}

#[tauri::command]
fn set_settings(app: tauri::AppHandle, settings: FlightDeckSettings) -> Result<(), String> {
    let store = app
        .store("flight-deck-settings.json")
        .map_err(|e| e.to_string())?;
    store.set("environment", settings.environment.clone());
    store.set("mission_control_url", settings.mission_control_url.clone());
    store.set("remember_last_workspace", settings.remember_last_workspace);
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn default_urls() -> serde_json::Value {
    serde_json::json!({
        "production": DEFAULT_PRODUCTION_URL,
        "localhost": DEFAULT_LOCALHOST_URL,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![get_settings, set_settings, default_urls])
        .setup(|app| {
            // Build a calm system tray: Open Mission Control, Check connection, Quit.
            let open_i = MenuItem::with_id(app, "open", "Open Mission Control", true, None::<&str>)?;
            let check_i = MenuItem::with_id(app, "check", "Check connection", true, None::<&str>)?;
            let sep_i = MenuItem::with_id(app, "sep", "—", false, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit Baseline Flight Deck", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open_i, &check_i, &sep_i, &quit_i])?;
            let _tray = TrayIconBuilder::with_id("flight-deck-tray")
                .tooltip("Baseline Flight Deck")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "check" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.eval("window.location.reload()");
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Baseline Flight Deck");
}
