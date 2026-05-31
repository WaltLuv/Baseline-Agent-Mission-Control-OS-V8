//! Baseline Flight Deck — library entry.
//!
//! Tauri 2 expects both `src/main.rs` (desktop entry) and a library crate
//! (mobile / non-desktop entry). We keep them in sync by exposing the
//! identical builder configuration here so cross-platform builds resolve.
//!
//! The Rust layer is intentionally lean — Mission Control (rendered via
//! the embedded webview) remains the single source of truth.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .run(tauri::generate_context!())
        .expect("error while running Baseline Flight Deck");
}
