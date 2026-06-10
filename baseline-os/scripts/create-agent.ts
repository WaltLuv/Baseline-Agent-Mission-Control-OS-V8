#!/usr/bin/env bun
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

type AgentSpec = {
  id: string;
  name: string;
  job: string;
  description: string;
  channels: string[];
  outcomes: string[];
  skills: string[];
  tools: string[];
  tone: string;
  summon: string[];
};

const SPECS: Record<string, AgentSpec> = {
  receptionist: {
    id: "receptionist",
    name: "Receptionist",
    job: "Front desk · Intake · Scheduling · Caller triage · First response",
    description: "Owns first touch across inbound messages: captures context, answers routine questions, schedules next steps, and routes the work to the right Baseline specialist.",
    channels: ["Telegram intake", "Lead capture", "Scheduling", "Caller triage", "Customer first response"],
    outcomes: ["greet and qualify inbound contacts", "capture complete contact details", "answer routine questions", "schedule next steps", "route qualified work to Dispatcher"],
    skills: ["telegram-gateway", "day5-voiceops-receptionist", "day5-voiceops-receptionist-script", "productivity/google-workspace", "note-taking/obsidian"],
    tools: ["browser", "file", "kanban", "memory", "shell", "terminal", "web"],
    tone: "warm, concise, organized, intake-first, escalation-aware",
    summon: ["Receptionist", "front desk", "intake this", "new lead", "triage this"],
  },
  dispatcher: {
    id: "dispatcher",
    name: "Dispatcher",
    job: "Dispatch desk · Work orders · Vendor routing · Follow-through",
    description: "Converts intake into assigned work: creates tasks, routes issues to the correct owner or vendor, tracks status, and keeps the operator informed until the loop is closed.",
    channels: ["Work orders", "Vendor routing", "Task assignment", "Status follow-up", "Escalations"],
    outcomes: ["turn intake into concrete tasks", "assign each item to the right owner", "track due dates and blockers", "send concise status updates", "escalate stalled work"],
    skills: ["devops/kanban-worker", "devops/kanban-orchestrator", "day6-workorder-flow-script", "productivity/google-workspace", "note-taking/obsidian"],
    tools: ["browser", "file", "kanban", "memory", "shell", "terminal", "web"],
    tone: "direct, checklist-driven, calm under load, ownership-focused",
    summon: ["Dispatcher", "dispatch this", "route this", "make a work order", "track this"],
  },
  "account-manager": {
    id: "account-manager",
    name: "Account Manager",
    job: "Account desk · Client updates · Renewals · Relationship follow-up",
    description: "Owns the client relationship after intake: keeps accounts warm, prepares updates, follows up on commitments, and protects retention and expansion opportunities.",
    channels: ["Client updates", "Renewals", "Follow-up cadences", "Owner relations", "Expansion opportunities"],
    outcomes: ["summarize account status", "draft client-ready updates", "track promises and next steps", "surface renewal and upsell risks", "coordinate with CFO and Compliance Officer"],
    skills: ["sales/revenue-operations", "productivity/google-workspace", "apple/imessage", "note-taking/obsidian", "telegram-gateway"],
    tools: ["browser", "file", "kanban", "memory", "shell", "terminal", "web"],
    tone: "commercial, relationship-aware, crisp, accountable",
    summon: ["Account Manager", "account manager", "client follow-up", "renewal risk", "account update"],
  },
  "compliance-officer": {
    id: "compliance-officer",
    name: "Compliance Officer",
    job: "Compliance desk · Policy checks · Risk review · Documentation",
    description: "Reviews proposed actions, messages, workflows, and records for policy, legal, contractual, and operational risk before execution.",
    channels: ["Policy checks", "Risk review", "Documentation", "Approvals", "Audit trail"],
    outcomes: ["flag policy and contractual risk", "separate facts from assumptions", "prepare approval notes", "maintain audit-ready records", "recommend safer execution paths"],
    skills: ["research/llm-wiki", "research/blogwatcher", "productivity/ocr-and-documents", "note-taking/obsidian", "mandatory-execution-approval"],
    tools: ["browser", "file", "kanban", "memory", "shell", "terminal", "web"],
    tone: "precise, conservative, evidence-first, approval-aware",
    summon: ["Compliance Officer", "compliance", "risk check", "review this", "approval note"],
  },
  cfo: {
    id: "cfo",
    name: "CFO",
    job: "Finance desk · Pricing · Cash flow · Billing · Forecasts",
    description: "Owns financial judgment for Baseline: pricing, cash flow, billing follow-up, margin checks, forecasts, and revenue operations decisions.",
    channels: ["Pricing", "Cash flow", "Billing", "Forecasts", "Revenue operations", "Margin checks"],
    outcomes: ["review pricing and margin", "prepare billing and collections actions", "forecast cash impact", "spot revenue leaks", "recommend the next financial decision"],
    skills: ["sales/revenue-operations", "repair-cost-guide-pricing", "spec-kit", "productivity/google-workspace", "note-taking/obsidian"],
    tools: ["browser", "file", "kanban", "memory", "shell", "terminal", "web"],
    tone: "numbers-first, blunt, practical, decision-oriented",
    summon: ["CFO", "finance", "pricing check", "cash flow", "billing review"],
  },
};

function argValue(name: string): string | undefined {
  const flag = `--${name}`;
  const i = process.argv.indexOf(flag);
  if (i >= 0) return process.argv[i + 1];
  const eq = process.argv.find((a) => a.startsWith(`${flag}=`));
  if (eq) return eq.slice(flag.length + 1);
  const envName = `npm_config_${name.replace(/-/g, "_")}`;
  const envValue = process.env[envName];
  return envValue && envValue !== "true" ? envValue : undefined;
}

function yamlString(value: string): string {
  return JSON.stringify(value);
}

function yamlList(values: string[]): string {
  return values.map((v) => `- ${yamlString(v)}`).join("\n");
}

function claudeMd(spec: AgentSpec): string {
  return `# ${spec.name}

You are ${spec.name}, the ${spec.job}.

## Mission
${spec.description}

## Scope
${spec.channels.map((c) => `- ${c}`).join("\n")}

## Operating Rules
- Lead with the action taken or the next decision needed.
- Use the shared SQLite/Hermes state, shared skills library, and Maestro bus before creating parallel records.
- Read relevant memory before re-discovering context.
- Use kanban for work that needs follow-through beyond the current message.
- Use Maestro when another specialist owns the next step.
- Do not expose private tokens, credentials, or internal logs in replies.

## Expected Outputs
${spec.outcomes.map((o) => `- ${o}`).join("\n")}

## Shared Surfaces
- SQLite/Hermes store: ~/.hermes/state.db and ~/.hermes/kanban.db
- Skills: ~/.claude-os/skills and ~/.hermes/skills
- Maestro bus: ~/.claude-os/maestro/messages.jsonl and /__agent_message
- Persona YAML: ~/.hermes/pantheon/personas/${spec.id}.yaml

## Voice
${spec.tone}
`;
}

function personaYaml(spec: AgentSpec): string {
  const system = `${claudeMd(spec)}

When operating from Telegram, treat the chat as a command surface. Confirm what changed, what is blocked, and the next owner. Keep replies short unless Walt asks for the full brief.`;

  return `id: ${spec.id}
name: ${yamlString(spec.name)}
job: ${yamlString(spec.job)}
description: ${yamlString(spec.description)}
avatar: assets/${spec.id}.png
model:
  provider: anthropic
  name: claude-sonnet-4.5
behavior:
  tone: ${yamlString(spec.tone)}
  system_prompt: ${yamlString(system)}
skills:
${yamlList(spec.skills)}
tools:
${yamlList(spec.tools)}
summon_phrases:
${yamlList(spec.summon)}
`;
}

function envExample(spec: AgentSpec): string {
  const upper = spec.id.toUpperCase().replace(/-/g, "_");
  return `# ${spec.name} Telegram bot bridge
# Create a unique bot token in Telegram via @BotFather.
# Never reuse one Telegram token across multiple specialists.
PERSONA=${spec.id}
TG_TOKEN=\${TELEGRAM_BOT_TOKEN_${upper}}
ALLOWED_CHAT_ID=
DASHBOARD_URL=http://127.0.0.1:8081
`;
}

function launchdPlist(spec: AgentSpec, repoRoot: string, agentDir: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.baseline.agent.${spec.id}</string>
  <key>WorkingDirectory</key>
  <string>${repoRoot}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${join(repoRoot, "scripts", "run-persona-tg-bot.sh")}</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>AGENT_ENV_FILE</key>
    <string>${join(agentDir, ".env")}</string>
  </dict>
  <key>StandardOutPath</key>
  <string>${join(agentDir, "telegram.out.log")}</string>
  <key>StandardErrorPath</key>
  <string>${join(agentDir, "telegram.err.log")}</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
</dict>
</plist>
`;
}

async function readJson(path: string): Promise<any> {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}

async function main() {
  const id = (argValue("id") ?? process.argv.find((a) => SPECS[a]))?.toLowerCase();
  const force = process.argv.includes("--force") || process.env.npm_config_force === "true";

  if (!id || !SPECS[id]) {
    console.error(`Usage: npm run agent:create -- --id <${Object.keys(SPECS).join("|")}>`);
    process.exit(2);
  }

  const spec = SPECS[id];
  const home = homedir();
  const repoRoot = process.cwd();
  const agentDir = join(home, ".claude-os", "agents", spec.id);
  const personaPath = join(home, ".hermes", "pantheon", "personas", `${spec.id}.yaml`);
  const registryPath = join(home, ".claude-os", "agents", "registry.json");

  await mkdir(agentDir, { recursive: true });
  await mkdir(dirname(personaPath), { recursive: true });

  const files = [
    { path: join(agentDir, "CLAUDE.md"), body: claudeMd(spec) },
    { path: join(agentDir, ".env.example"), body: envExample(spec) },
    { path: join(agentDir, `com.baseline.agent.${spec.id}.plist.example`), body: launchdPlist(spec, repoRoot, agentDir) },
    { path: personaPath, body: personaYaml(spec) },
  ];

  for (const file of files) {
    if (existsSync(file.path) && !force) {
      console.log(`kept existing ${file.path}`);
      continue;
    }
    await writeFile(file.path, file.body, "utf8");
    console.log(`wrote ${file.path}`);
  }

  const registry = (await readJson(registryPath)) ?? { agents: [] };
  const agents = Array.isArray(registry.agents) ? registry.agents : [];
  const existingEntry = agents.find((a: any) => a?.id === spec.id);
  const entry = {
    id: spec.id,
    name: spec.name,
    job: spec.job,
    personaPath,
    claudeMdPath: join(agentDir, "CLAUDE.md"),
    telegramBridge: join(repoRoot, "scripts", "persona-tg-bot.ts"),
    maestroId: spec.id,
    createdAt: existingEntry?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const order = Object.keys(SPECS);
  const nextAgents = agents
    .filter((a: any) => a?.id !== spec.id)
    .concat(entry)
    .sort((a: any, b: any) => {
      const ai = order.indexOf(a?.id);
      const bi = order.indexOf(b?.id);
      if (ai === -1 && bi === -1) return String(a?.id ?? "").localeCompare(String(b?.id ?? ""));
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  await writeFile(registryPath, JSON.stringify({ agents: nextAgents }, null, 2) + "\n", "utf8");
  console.log(`registered ${spec.id} in ${registryPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
