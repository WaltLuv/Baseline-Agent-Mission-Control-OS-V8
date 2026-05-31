// Prevent a console window from popping up on Windows release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Baseline Flight Deck — Rust entry. Intentionally lean: we don't
// build a parallel UI here; Mission Control remains the source of
// truth. The Rust layer only initialises the Tauri runtime, wires
// the minimal plugin set, and hands control to the webview.

fn main() {
    baseline_flight_deck_lib::run();
}
