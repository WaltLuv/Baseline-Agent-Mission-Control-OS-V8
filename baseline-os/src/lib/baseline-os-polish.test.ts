/**
 * Baseline OS refinement pass — collapsible sidebar + Mansa V2 home + Graphify
 * visibility + System Map.
 */
import { test, expect, describe } from "bun:test";
import { readFileSync } from "node:fs";

describe("Collapsible sidebar (parity with Mission Control)", () => {
  const s = readFileSync("src/components/app-sidebar.tsx", "utf8");
  test("sections collapse/expand + persist", () => {
    expect(s).toContain("SIDEBAR_COLLAPSE_KEY");
    expect(s).toContain("toggleSection");
    expect(s).toContain("localStorage.setItem");
    expect(s).toContain("aria-expanded");
    expect(s).toContain("data-testid={`sidebar-section-${k}`}");
  });
  test("all four sections present + still route via NavLink", () => {
    for (const k of ["operator", "personal", "tools", "agents"]) expect(s).toContain(`k="${k}"`);
    expect(s).toContain("const NavLink");
  });
});

describe("Mansa V2 home + Graphify visibility + System Map", () => {
  const map = readFileSync("src/components/baseline-system-map.tsx", "utf8");
  const home = readFileSync("src/routes/index.tsx", "utf8");
  test("home renders the system-map block", () => {
    expect(home).toContain("<BaselineSystemMap />");
  });
  test("regal visual language (glass surfaces + geometry + gold palette) — inspired, not named", () => {
    expect(map).toContain("MansaSurface");
    expect(map).toContain("MaliGeometry"); // visual motif (imagery, not text)
    expect(map).toContain("MANSA_V2");
    // No literal empire/place WORDS in the visible hero text.
    expect(map).not.toContain("The Mansa Command Center");
    expect(map).not.toContain("Timbuktu");
    expect(map).not.toContain("Sankoré knowledge");
    expect(map).toContain("Baseline OS · Command Center");
  });
  test("Graphify brain card prominent + open/query CTAs + live node count", () => {
    expect(map).toContain('testid="home-graphify-card"'); // MansaSurface renders data-testid={testid}
    expect(map).toContain('data-testid="home-graphify-open"');
    expect(map).toContain("/__graphify");
    expect(map).toContain("Structural Brain");
  });
  test("System Map lists the major installed features", () => {
    expect(map).toContain('testid="home-system-map"'); // MansaSurface renders data-testid={testid}
    for (const f of [
      "Graphify",
      "Knowledge OS",
      "Hermes",
      "Maestro",
      "Agent Factory",
      "Video Studio",
      "Flight Deck",
      "Slim Charles",
      "Workforce Replay",
    ]) {
      expect(map, `system map missing ${f}`).toContain(f);
    }
  });
});

import { test as hxTest, expect as hxExpect, describe as hxDescribe } from "bun:test";
import { readFileSync as hxRead } from "node:fs";

hxDescribe("Hermes persona naming — no Greek, no literal empire/place words", () => {
  const h = hxRead("src/routes/agents.hermes.tsx", "utf8");
  hxTest("Greek persona display names removed", () => {
    for (const g of [
      'title: "Oracle"',
      'title: "Athena"',
      'title: "Messenger"',
      'title: "Orpheus"',
      'name: "Oracle"',
      'name: "Athena"',
      '"Install Pantheon"',
    ]) {
      hxExpect(h, `still shows Greek: ${g}`).not.toContain(g);
    }
  });
  hxTest("role-based names (no Mansa/Timbuktu/Sankoré/Djenné/empire WORDS in display text)", () => {
    for (const m of ['title: "Archivist"', 'title: "Architect"', 'title: "Courier"', 'title: "Composer"', '"Assemble the Team"']) {
      hxExpect(h, `missing ${m}`).toContain(m);
    }
    for (const banned of ['title: "Sankoré', 'title: "Djenné', 'title: "Griot', '"Assemble the Empire"']) {
      hxExpect(h, `still shows place-named text: ${banned}`).not.toContain(banned);
    }
  });
});

import { test as gxT, expect as gxE, describe as gxD } from "bun:test";
import { readFileSync as gxR } from "node:fs";

gxD("Graphify Everywhere — structural brain on every key surface", () => {
  const comp = gxR("src/components/graphify-awareness.tsx", "utf8");
  gxT("awareness component shows connected/nodes/edges/last-sync/structural-context", () => {
    for (const s of [
      "brain connected",
      "nodes",
      "edges",
      "last sync",
      "structural context active",
      "/__graphify",
    ]) {
      gxE(comp, `awareness missing ${s}`).toContain(s);
    }
    gxE(comp).toContain("OperatorCrest"); // no-fake-art identity mark
  });
  gxT("placed on Hermes, PI Agent, Knowledge OS, Agent Factory, Maestro, Flight Deck", () => {
    const files = {
      Hermes: "src/routes/agents.hermes.tsx",
      "PI Agent": "src/routes/agents.ruflo.tsx",
      "Knowledge OS": "src/routes/memory.tsx",
      "Agent Factory": "src/routes/personas.tsx",
      Maestro: "src/components/maestro-panel.tsx",
      "Flight Deck": "src/routes/flight-deck.tsx",
    };
    for (const [label, path] of Object.entries(files)) {
      gxE(gxR(path, "utf8"), `${label} missing GraphifyAwareness`).toContain("<GraphifyAwareness");
    }
  });
});

import { test as fdT, expect as fdE, describe as fdD } from "bun:test";
import { readFileSync as fdR } from "node:fs";

fdD("Flight Deck Executive Bridge (#4)", () => {
  const fd = fdR("src/routes/flight-deck.tsx", "utf8");
  fdT(
    "real-telemetry bridge: Graphify brain / workforce / runtimes / replay / proof / approvals / cost",
    () => {
      fdE(fd).toContain('data-testid="flight-deck-bridge"');
      for (const t of [
        "Graphify Brain",
        "Workforce",
        "Runtimes",
        "Replay",
        "Proof",
        "Approvals",
        "Cost",
      ]) {
        fdE(fd, `bridge missing ${t}`).toContain(t);
      }
      fdE(fd).toContain("/__graphify"); // real brain data
      fdE(fd).toContain("listReplays()"); // real replay data
      fdE(fd).toContain("<GraphifyAwareness"); // brain awareness in header
    },
  );
});

import { test as idT, expect as idE, describe as idD } from "bun:test";
import { readFileSync as idR } from "node:fs";

idD("Agent Identity System + Avatar Cleanup (#2/#3)", () => {
  const aa = idR("src/components/agent-activity.tsx", "utf8");
  idT("shared AgentActivity renders the operator identity header + OperatorCrest avatar", () => {
    idE(aa).toContain('data-testid="agent-identity-header"');
    idE(aa).toContain("<OperatorCrest");
    idE(aa).toContain('from "@/components/graphify-awareness"');
  });
  idT("OperatorCrest is initials-based, no fake generated art", () => {
    const gc = idR("src/components/graphify-awareness.tsx", "utf8");
    idE(gc).toContain("export function OperatorCrest");
    idE(gc).not.toMatch(/generateAvatar|dall-?e|midjourney|stable-?diffusion|\.png/i);
  });
  idT("no visible Greek OR literal place-named strings remain", () => {
    const slim = idR("src/routes/agents.slim-charles.tsx", "utf8");
    idE(slim).not.toContain("Oracle Control System");
    idE(slim).toContain("Operator Control System");
  });
});

import { test as rT, expect as rE, describe as rD } from "bun:test";
import { readFileSync as rR } from "node:fs";

rD("Identity rollout COMPLETE — every custom agent page unified", () => {
  rT("AgentIdentityHeader exists (crest + status + graphify, drop-in)", () => {
    const gc = rR("src/components/graphify-awareness.tsx", "utf8");
    rE(gc).toContain("export function AgentIdentityHeader");
    rE(gc).toContain("<OperatorCrest");
    rE(gc).toContain("<GraphifyAwareness");
  });
  rT("all 5 remaining custom pages now render the shared identity header", () => {
    for (const f of [
      "agents.openclaw",
      "agents.claude-code",
      "agents.notebooklm",
      "agents.hermes-mcp",
      "agents.pi-runtime",
    ]) {
      rE(rR(`src/routes/${f}.tsx`, "utf8"), `${f} missing identity header`).toContain(
        "<AgentIdentityHeader",
      );
    }
  });
  rT("Slim Charles stays custom (NOT forced into generic header) + de-Greeked", () => {
    const slim = rR("src/routes/agents.slim-charles.tsx", "utf8");
    rE(slim).not.toContain("<AgentIdentityHeader");
    rE(slim).not.toContain("Oracle Control System");
  });
});

import { test as fT, expect as fE, describe as fD } from "bun:test";
import { readFileSync as fR, readdirSync as fLs } from "node:fs";

fD("Identity rollout — FULL coverage (every custom agent page except Slim)", () => {
  fT("all 8 custom agent pages carry the shared identity treatment", () => {
    for (const f of [
      "agents.openclaw",
      "agents.claude-code",
      "agents.notebooklm",
      "agents.hermes-mcp",
      "agents.pi-runtime",
      "agents.antigravity",
      "agents.free-claude",
      "agents.claude-code-studio",
    ]) {
      fE(fR(`src/routes/${f}.tsx`, "utf8"), `${f} missing identity header`).toContain(
        "<AgentIdentityHeader",
      );
    }
  });
  fT("ZERO agent pages lack identity treatment except Slim Charles", () => {
    const missing = fLs("src/routes")
      .filter(
        (f) => /^agents\..+\.tsx$/.test(f) && !/\.(studio|control|goal|workspace)\.tsx$/.test(f),
      )
      .filter((f) => {
        const s = fR(`src/routes/${f}`, "utf8");
        return !/<AgentActivity|<AgentIdentityHeader/.test(s);
      });
    fE(missing, `unexpected pages without identity: ${missing.join(", ")}`).toEqual([
      "agents.slim-charles.tsx",
    ]);
  });
});
