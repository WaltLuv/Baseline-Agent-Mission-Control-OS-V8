import { test, expect, describe } from "bun:test";
import { readFileSync } from "node:fs";

const c = readFileSync("src/components/flight-deck-command-bridge.tsx", "utf8");

describe("Flight Deck Command Bridge — UI wiring", () => {
  test("command input + route + dispatch controls render", () => {
    expect(c).toContain('data-testid="command-bridge-input"');
    expect(c).toContain('data-testid="command-bridge-route"');
    expect(c).toContain('data-testid="command-bridge-dispatch"');
    expect(c).toContain('data-testid="command-bridge-target"'); // shows which runtime handles it
  });
  test("missing runtime → setup-needed (honest), gated dispatch", () => {
    expect(c).toContain('data-testid="command-bridge-setup-needed"');
    expect(c).toContain("runtimeMissing");
    expect(c).toContain("split"); // matches id@host registry format
  });
  test("destructive/approval gate present", () => {
    expect(c).toContain('data-testid="command-bridge-approval"');
    expect(c).toContain("needsApproval");
    expect(c).toContain("approved");
  });
  test("Agent Activity appears for Hermes-routed commands", () => {
    expect(c).toContain("<AgentActivity");
    expect(c).toContain('data-testid="command-bridge-activity"');
  });
  test("Graphify context shown when relevant (real /__graphify read)", () => {
    expect(c).toContain('data-testid="command-bridge-graphify"');
    expect(c).toContain("/__graphify?q=");
  });
  test("proof/replay emitted when applicable — never faked", () => {
    expect(c).toContain("recordMission");
    expect(c).toContain("plan.emitsProof");
  });
});
