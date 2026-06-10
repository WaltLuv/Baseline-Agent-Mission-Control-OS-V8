/**
 * Sidebar nav structure (bun test) — Personal must contain ONLY Goals, Journal,
 * Notes; everything else lives in Tools/Primary. /notes route must exist.
 */
import { test, expect, describe } from "bun:test";
import { readFileSync } from "node:fs";

const nav = readFileSync("src/components/app-sidebar.tsx", "utf8");

// Extract the `const personal = [ ... ];` block.
function block(name: string): string {
  const m = nav.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`));
  return m ? m[1] : "";
}

describe("sidebar nav reorganization", () => {
  test("Personal section contains ONLY Goals, Journal, Notes", () => {
    const personal = block("personal");
    const routes = [...personal.matchAll(/to:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(routes.sort()).toEqual(["/goals", "/journal", "/notes"]);
  });

  test("misplaced utilities moved into Tools", () => {
    const tools = block("tools");
    for (const r of [
      "/documents",
      "/library",
      "/memory",
      "/notion",
      "/pinecone",
      "/seo",
      "/notebook",
      "/prompts",
      "/skills",
    ]) {
      expect(tools, `tools missing ${r}`).toContain(`"${r}"`);
    }
  });

  test("operator surfaces moved into Primary", () => {
    const primary = block("primary");
    for (const r of [
      "/kanban",
      "/mission-control",
      "/flight-deck",
      "/runtime-registry",
      "/approvals",
      "/personas",
      "/org-chart",
    ]) {
      expect(primary, `primary missing ${r}`).toContain(`"${r}"`);
    }
  });

  test("/notes route exists and is durable (persistence-backed)", () => {
    const notes = readFileSync("src/routes/notes.tsx", "utf8");
    expect(notes).toContain('createFileRoute("/notes")');
    expect(notes).toContain("durableSet");
    expect(notes).toContain("notes-textarea");
  });
});
