/**
 * Flight Deck pairing — desktop-side copy + wiring assertions (bun test).
 *
 * The Rust handshake/keychain logic is unit-tested in src-tauri (cargo test).
 * Here we assert the customer-facing UI: Baseline Automations positioning,
 * pairing flow elements, heartbeat/unpair/revoked handling, and that tokens
 * are never written to plaintext config from the frontend.
 */
import { test, expect, describe } from "bun:test";
import { readFileSync } from "node:fs";

const ui = (f: string) => readFileSync(`${import.meta.dir}/../../src-tauri/ui/${f}`, "utf8");
const rs = (f: string) => readFileSync(`${import.meta.dir}/../../src-tauri/src/${f}`, "utf8");
const html = ui("index.html");
const appjs = ui("app.js");
const pairing = rs("pairing.rs");

describe("Flight Deck — Baseline Automations positioning", () => {
  test("uses Baseline Automations ecosystem copy", () => {
    expect(html).toContain("Baseline Automations ecosystem");
    expect(appjs).toContain("Baseline Automations ecosystem");
  });
  test("PropControl-only ecosystem copy removed", () => {
    expect(html).not.toContain("PropControl ecosystem");
    expect(appjs).not.toContain("PropControl ecosystem");
  });
  test("no personal/Walt-only framing", () => {
    expect(html.toLowerCase()).not.toContain("walt");
    expect(html.toLowerCase()).not.toContain("this is your cockpit");
  });
});

describe("Flight Deck — pairing UI wiring", () => {
  test("pairing code is displayed", () => {
    expect(html).toContain('id="pairing-code"');
    expect(html).toContain('id="pairing-code-box"');
  });
  test("Mission Control URL input + start present", () => {
    expect(html).toContain('id="mc-url"');
    expect(html).toContain('id="start-btn"');
  });
  test("pairing URL opens Mission Control", () => {
    expect(appjs).toContain('id === "open-mc-btn"');
    expect(appjs).toContain("open_local_url");
  });
  test("calls real pairing commands (start/poll/heartbeat/unpair)", () => {
    for (const cmd of ["pairing_start", "pairing_poll", "device_heartbeat", "unpair", "get_pairing_state"]) {
      expect(appjs).toContain(cmd);
    }
  });
  test("heartbeat loop runs and renders paired state", () => {
    expect(appjs).toContain("heartbeatTick");
    expect(appjs).toContain("device_heartbeat");
  });
  test("handles revoked/expired by prompting to pair again", () => {
    expect(appjs).toContain("Device revoked — pair again");
    expect(appjs).toContain("Pairing expired — pair again");
  });
  test("unpair clears via the unpair command (no manual token writes)", () => {
    expect(appjs).toContain('id === "unpair-btn"');
    expect(appjs).toContain('invoke("unpair")');
  });
  test("permissions render as chips", () => {
    expect(html).toContain('id="pairing-perms"');
    expect(appjs).toContain('class="perm"');
  });
});

describe("Flight Deck — secure token storage (Rust)", () => {
  test("device + claim tokens are stored in the OS keychain, not config", () => {
    expect(pairing).toContain("KEYCHAIN_SERVICE");
    expect(pairing).toContain("kc_set(KC_DEVICE_TOKEN");
    expect(pairing).toContain("kc_set(KC_CLAIM_TOKEN");
  });
  test("frontend never writes a token to plaintext config", () => {
    // No write_safe_config call carrying a token/secret key from the UI.
    expect(appjs).not.toMatch(/write_safe_config[^)]*token/i);
  });
  test("revoked/expired heartbeat deletes the local token", () => {
    expect(pairing).toContain("kc_delete(KC_DEVICE_TOKEN)");
    expect(pairing).toContain('"revoked"');
    expect(pairing).toContain('"expired"');
  });
});
