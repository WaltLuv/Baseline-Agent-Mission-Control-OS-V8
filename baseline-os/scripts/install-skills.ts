#!/usr/bin/env bun
/**
 * Skill installer + deduper for Claude OS.
 *
 *   bun run scripts/install-skills.ts
 *
 * What it does:
 *   1. Pulls/clones every configured skill repo into /tmp/agent-os-repos/.
 *   2. Walks each repo looking for SKILL.md files (and skill.yaml, AGENT.md).
 *   3. Copies them into ~/.claude-os/skills/<source>/<skill-path>/SKILL.md.
 *   4. Hashes content; if the same hash already exists under a different
 *      source, marks the new one as a duplicate and skips.
 *   5. Regenerates ~/.claude-os/skills/SKILL_INDEX.json from disk.
 *
 * Private repos: clone fails silently with a clear warning so you can
 *   `gh auth login` once and re-run.
 */

import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, statSync, copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, basename, relative, dirname } from "node:path";

const REPOS_ROOT = "/tmp/agent-os-repos";
const SKILLS_ROOT = join(homedir(), ".claude-os", "skills");
const INDEX_PATH = join(SKILLS_ROOT, "SKILL_INDEX.json");
const DUP_LOG = join(SKILLS_ROOT, "_DUPLICATES.json");

interface SkillRepo {
  name: string;
  url: string;
  // Where the skills live inside the repo (default: top-level + skills/)
  paths?: string[];
}

const REPOS: SkillRepo[] = [
  { name: "slim-charles-agency-knowledge-base", url: "https://github.com/WaltLuv/slim-charles-agency-knowledge-base.git", paths: ["skills"] },
  { name: "slim-charles-config",                url: "https://github.com/WaltLuv/slim-charles-config.git" },
  { name: "CLI-Anything",                       url: "https://github.com/WaltLuv/CLI-Anything.git", paths: ["skills"] },
  { name: "agency-agents",                      url: "https://github.com/WaltLuv/agency-agents.git" },
  { name: "gstack-Y-Combinator-Skills",         url: "https://github.com/WaltLuv/gstack-Y-Combinator-Skills.git" },
  { name: "higgsfield-supercomputer",           url: "https://github.com/WaltLuv/higgsfield-supercomputer.git", paths: [".agents/skills"] },
  { name: "baseline-3d-floor-plans",            url: "https://github.com/WaltLuv/baseline-3d-floor-plans.git" },
  { name: "claudeclaw-os",                      url: "https://github.com/WaltLuv/claudeclaw-os.git", paths: ["skills"] },
  { name: "andrej-karpathy-skills",             url: "https://github.com/forrestchang/andrej-karpathy-skills.git", paths: ["skills"] },
  { name: "gemini-cli",                         url: "https://github.com/WaltLuv/gemini-cli.git" },
  { name: "notebooklm-py",                      url: "https://github.com/teng-lin/notebooklm-py.git" },
];

interface SkillEntry {
  source: string;        // repo name
  name: string;          // skill name (folder-derived)
  path: string;          // path inside SKILLS_ROOT
  hash: string;          // sha256 of SKILL.md content
  desc?: string;
  cat?: string;
  tags?: string[];
}

function sh(cmd: string, opts: { cwd?: string; quiet?: boolean } = {}): string {
  try {
    return execSync(cmd, { cwd: opts.cwd, stdio: opts.quiet ? "pipe" : ["ignore", "pipe", "pipe"] }).toString();
  } catch (e: unknown) {
    const err = e as { stderr?: Buffer; message?: string };
    return `__ERROR__ ${err.stderr?.toString() ?? err.message ?? "unknown"}`;
  }
}

function pullOrClone(repo: SkillRepo): { ok: boolean; note: string } {
  const target = join(REPOS_ROOT, repo.name);
  if (!existsSync(REPOS_ROOT)) mkdirSync(REPOS_ROOT, { recursive: true });
  if (existsSync(join(target, ".git"))) {
    const out = sh(`git -C "${target}" pull --ff-only`, { quiet: true });
    if (out.startsWith("__ERROR__")) return { ok: false, note: `pull failed: ${out.slice(11, 200)}` };
    return { ok: true, note: out.trim().split("\n").slice(-1)[0] ?? "up-to-date" };
  }
  const out = sh(`git clone --depth 1 "${repo.url}" "${target}"`, { quiet: true });
  if (out.startsWith("__ERROR__")) return { ok: false, note: "clone failed (likely private — run `gh auth login`)" };
  return { ok: true, note: "cloned" };
}

function parseFrontmatter(text: string): { name?: string; description?: string; category?: string; tags?: string[] } {
  if (!text.startsWith("---")) return {};
  const end = text.indexOf("\n---", 4);
  if (end < 0) return {};
  const yaml = text.slice(4, end);
  const out: Record<string, unknown> = {};
  for (const line of yaml.split("\n")) {
    const m = line.match(/^(\w+):\s*(.+)$/);
    if (!m) continue;
    const [, k, v] = m;
    const val = v.trim().replace(/^["']|["']$/g, "");
    if (k === "tags" && val.startsWith("[")) {
      try { out[k] = JSON.parse(val); } catch { out[k] = val.split(",").map((s) => s.trim()); }
    } else {
      out[k] = val;
    }
  }
  return out as { name?: string; description?: string; category?: string; tags?: string[] };
}

function walk(dir: string, files: string[] = []): string[] {
  if (!existsSync(dir)) return files;
  for (const ent of readdirSync(dir)) {
    if (ent.startsWith(".") && ent !== ".agents") continue;
    const full = join(dir, ent);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) walk(full, files);
    else if (/^SKILL\.md$/i.test(ent)) files.push(full);
  }
  return files;
}

async function main() {
  console.log("Skill installer — starting");
  console.log(`  Repos root:  ${REPOS_ROOT}`);
  console.log(`  Skills root: ${SKILLS_ROOT}\n`);

  if (!existsSync(SKILLS_ROOT)) mkdirSync(SKILLS_ROOT, { recursive: true });

  // 1. Pull each repo
  const repoResults: { name: string; ok: boolean; note: string }[] = [];
  for (const repo of REPOS) {
    process.stdout.write(`[pull] ${repo.name.padEnd(40, " ")} `);
    const r = pullOrClone(repo);
    repoResults.push({ name: repo.name, ...r });
    console.log(r.ok ? `✓ ${r.note}` : `✗ ${r.note}`);
  }

  // 2. Walk + ingest
  const seen = new Map<string, SkillEntry>(); // hash → entry (first wins)
  const duplicates: { hash: string; kept: string; skipped: string }[] = [];
  const allEntries: SkillEntry[] = [];

  for (const repo of REPOS) {
    const repoDir = join(REPOS_ROOT, repo.name);
    if (!existsSync(repoDir)) continue;
    const searchPaths = repo.paths?.map((p) => join(repoDir, p)) ?? [repoDir];

    let count = 0;
    for (const sp of searchPaths) {
      if (!existsSync(sp)) continue;
      const files = walk(sp);
      for (const file of files) {
        const content = readFileSync(file, "utf8");
        const hash = createHash("sha256").update(content).digest("hex").slice(0, 16);
        const skillFolder = dirname(file);
        const skillName = basename(skillFolder).toLowerCase().replace(/[^a-z0-9_-]/g, "-");
        const rel = relative(repoDir, skillFolder);

        if (seen.has(hash)) {
          duplicates.push({ hash, kept: seen.get(hash)!.path, skipped: `${repo.name}/${rel}/SKILL.md` });
          continue;
        }

        // Copy into ~/.claude-os/skills/<repo>/<rel>/SKILL.md
        const destFolder = join(SKILLS_ROOT, repo.name, rel);
        const destFile = join(destFolder, "SKILL.md");
        try {
          mkdirSync(destFolder, { recursive: true });
          copyFileSync(file, destFile);
        } catch (e) {
          console.warn(`  ! copy failed for ${file}: ${e}`);
          continue;
        }

        const fm = parseFrontmatter(content);
        const entry: SkillEntry = {
          source: repo.name,
          name: skillName,
          path: relative(SKILLS_ROOT, destFile),
          hash,
          desc: fm.description,
          cat: fm.category,
          tags: fm.tags,
        };
        seen.set(hash, entry);
        allEntries.push(entry);
        count++;
      }
    }
    console.log(`[scan] ${repo.name.padEnd(40, " ")} ${count} new skills`);
  }

  // 3. Write index + dup log
  allEntries.sort((a, b) => a.name.localeCompare(b.name));
  writeFileSync(INDEX_PATH, JSON.stringify({ total: allEntries.length, generatedAt: new Date().toISOString(), skills: allEntries }, null, 2));
  writeFileSync(DUP_LOG,    JSON.stringify({ count: duplicates.length, duplicates }, null, 2));

  console.log("\n── Summary ──────────────────────────────");
  console.log(`Total skills installed: ${allEntries.length}`);
  console.log(`Duplicates skipped:     ${duplicates.length}`);
  console.log(`Repos pulled OK:        ${repoResults.filter((r) => r.ok).length}/${repoResults.length}`);
  console.log(`Failed (likely auth):   ${repoResults.filter((r) => !r.ok).map((r) => r.name).join(", ") || "(none)"}`);
  console.log(`\nIndex written → ${INDEX_PATH}`);
  console.log(`Dup log → ${DUP_LOG}`);

  if (repoResults.some((r) => !r.ok)) {
    console.log(`\n⚠  To pull private repos, run once:  gh auth login   (then re-run this script)`);
  }
}

main();
