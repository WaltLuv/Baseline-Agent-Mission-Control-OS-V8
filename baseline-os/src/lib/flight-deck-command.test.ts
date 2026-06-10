import { test, expect, describe } from "bun:test";
import { routeCommand, isDestructive } from "./flight-deck-command";

describe("Flight Deck command bridge — routing", () => {
  test("Graphify locate routes to graphify with a query (read)", () => {
    const r = routeCommand("Open Graphify and locate auth files");
    expect(r.system).toBe("graphify");
    expect(r.usesGraphify).toBe(true);
    expect(r.graphifyQuery).toContain("auth");
    expect(r.kind).toBe("read");
    expect(r.needsApproval).toBe(false);
  });
  test("check connected runtimes → runtime-registry (read, safe)", () => {
    const r = routeCommand("Check connected runtimes");
    expect(r.system).toBe("runtime-registry");
    expect(r.needsApproval).toBe(false);
  });
  test("ask Hermes to review → hermes agent, emits proof, requires hermes runtime", () => {
    const r = routeCommand("Ask Hermes to review today's work");
    expect(r.system).toBe("hermes");
    expect(r.kind).toBe("agent");
    expect(r.emitsProof).toBe(true);
    expect(r.requiresRuntime).toBe("hermes");
  });
  test("Customer Zero smoke → execute, gated, emits proof", () => {
    const r = routeCommand("Run Customer Zero smoke");
    expect(r.system).toBe("customer-zero");
    expect(r.needsApproval).toBe(true);
    expect(r.emitsProof).toBe(true);
  });
  test("proof package → proof-replay, emits proof, gated", () => {
    const r = routeCommand("Create a maintenance workflow proof package");
    expect(r.system).toBe("proof-replay");
    expect(r.emitsProof).toBe(true);
    expect(r.needsApproval).toBe(true);
  });
  test("Mission Control demo → cross-app, gated", () => {
    const r = routeCommand("Run the property management demo");
    expect(r.system).toBe("mission-control");
    expect(r.needsApproval).toBe(true);
  });
});

describe("Flight Deck command bridge — safety gate", () => {
  test("destructive verbs require approval even on a read system", () => {
    expect(isDestructive("deploy to production")).toBe(true);
    expect(isDestructive("send SMS to all tenants")).toBe(true);
    expect(routeCommand("Hermes, delete the old work orders").needsApproval).toBe(true);
    expect(routeCommand("Graphify, then deploy to prod").needsApproval).toBe(true);
  });
  test("safe read command does NOT require approval", () => {
    expect(routeCommand("locate the auth files").needsApproval).toBe(false);
    expect(routeCommand("check connected runtimes").needsApproval).toBe(false);
  });
  test("unknown command routes to unknown without faking a target", () => {
    const r = routeCommand("xyzzy nonsense");
    expect(r.system).toBe("unknown");
  });
});
