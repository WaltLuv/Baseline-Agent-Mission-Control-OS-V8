// Prevent a console window from popping up on Windows release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Baseline Flight Deck — Rust entry. Intentionally lean: we don't
// build a parallel UI here; Mission Control remains the source of
// truth. The Rust layer only initialises the Tauri runtime, wires
// the minimal plugin set, and hands control to the webview.

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .run(tauri::generate_context!())
        .expect("error while running Baseline Flight Deck");
}
