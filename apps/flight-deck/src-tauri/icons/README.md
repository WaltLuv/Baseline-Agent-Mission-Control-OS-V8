# Icons

Replace the placeholders below with the Baseline OS mark before shipping. **Do not ship Tauri default icons.**

| File | Purpose | Required size |
| --- | --- | --- |
| `32x32.png` | Linux + Windows | 32 × 32 |
| `128x128.png` | Linux + dock | 128 × 128 |
| `128x128@2x.png` | Retina dock | 256 × 256 |
| `icon.icns` | macOS bundle icon | multi-resolution `.icns` |
| `icon.ico` | Windows installer + window | multi-resolution `.ico` |
| `tray-icon.png` | System tray | 22 × 22 monochrome (template-style for macOS) |

Suggested generation flow:

1. Export the Baseline OS mark as a 1024×1024 transparent PNG.
2. Run `npx @tauri-apps/cli icon ./baseline-mark.png` from `apps/flight-deck/` — Tauri will generate every required size and place them here.
3. Replace `tray-icon.png` with a 22×22 monochrome (template) PNG — this is what macOS expects in the menu bar.

The current placeholders are a 1×1 transparent PNG checked in so the Tauri build does not fail when the icons folder is empty.
