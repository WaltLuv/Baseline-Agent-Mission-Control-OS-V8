# Baseline OS → Mission Control — Feature Parity Matrix

> Source: src/lib/parity/surfaces.ts. Every Baseline OS page/tab has an MC route — working, cloud-equivalent, or honest setup/connect state. Never missing, never 404, never fake-ready. Every surface is a visible MC nav tab.

| Baseline OS Feature | Baseline OS Route | Mission Control Route | Status | Fix Applied | Notes |
|---|---|---|---|---|---|
| Dashboard | `/` | `/app` | ✅ Live | Working MC panel/route | Workforce |
| Activate / Workforces | `/app/activate` | `/app/activate` | ✅ Live | Working MC panel/route | Workforce |
| Workforce Templates | `/workforce-os` | `/app/workforce` | ✅ Live | Working MC panel/route | Workforce |
| Tasks | `/kanban` | `/app/tasks` | ✅ Live | Working MC panel/route | Workforce |
| Orchestration | `/maestro` | `/app/orchestration` | ✅ Live | Working MC panel/route | Workforce |
| Approvals | `/approvals` | `/app/approvals` | ✅ Live | Working MC panel/route | Workforce |
| Activity | `/activity` | `/app/activity` | ✅ Live | Working MC panel/route | Workforce |
| ROI / Value | `/` | `/app/value` | ✅ Live | Working MC panel/route | Workforce |
| Goals | `/goals` | `/app/goals` | ✅ Live | Working MC panel/route | Workforce |
| Kanban / Dispatcher | `/kanban` | `/app/tasks` | ✅ Live | Working MC panel/route | Workforce |
| Daily Brief | `/` | `/briefing` | ✅ Live | Working MC panel/route | Workforce |
| Executive Briefing | `/` | `/briefing` | ✅ Live | Working MC panel/route | Workforce |
| Proofs / Handoff | `/agents/claude-code-studio` | `/app/proofs` | ⚙️ Setup needed | Honest surface + setup path | Workforce |
| Agents | `/personas` | `/app/agents` | ✅ Live | Working MC panel/route | Agents & Runtimes |
| Personas | `/personas` | `/app/personas` | ✅ Live | Working MC panel/route | Agents & Runtimes |
| Runtimes | `/runtime-registry` | `/app/runtimes` | ✅ Live | Working MC panel/route | Agents & Runtimes |
| Claude Code | `/agents/claude-code` | `/app/claude-code` | ✅ Live | Working MC panel/route | Agents & Runtimes |
| Codex | `/agents/codex` | `/app/codex` | 🔌 Connect runtime | Honest surface + pair-runtime path | Agents & Runtimes |
| OpenClaw | `/agents/openclaw` | `/app/openclaw` | 🔌 Connect runtime | Honest surface + pair-runtime path | Agents & Runtimes |
| Hermes | `/agents/hermes` | `/app/hermes` | 🔌 Connect runtime | Honest surface + pair-runtime path | Agents & Runtimes |
| Hermes VPS | `/agents/hermes` | `/app/runtimes` | 🔌 Connect runtime | Honest surface + pair-runtime path | Agents & Runtimes |
| Oh My Pi (OMP) | `/agents/pi-runtime` | `/app/oh-my-pi` | 🔌 Connect runtime | Honest surface + pair-runtime path | Agents & Runtimes |
| Antigravity | `/agents/antigravity` | `/app/antigravity` | 🔌 Connect runtime | Honest surface + pair-runtime path | Agents & Runtimes |
| Gemini | `/agents/gemini` | `/app/gemini` | ⚙️ Setup needed | Honest surface + setup path | Agents & Runtimes |
| Free Claude Code | `/agents/free-claude` | `/app/free-claude` | 🖥️ Connect Baseline OS | Honest surface + connect-Baseline-OS path | Agents & Runtimes |
| Browser Use | `/browser` | `/app/browser-use` | 🖥️ Connect Baseline OS | Honest surface + connect-Baseline-OS path | Agents & Runtimes |
| Ruflo | `/agents/ruflo` | `/app/ruflo` | 🖥️ Connect Baseline OS | Honest surface + connect-Baseline-OS path | Agents & Runtimes |
| Hermes Manage | `/agents/hermes/control` | `/app/hermes-manage` | 🔌 Connect runtime | Honest surface + pair-runtime path | Agents & Runtimes |
| Slim Voice Agent | `/agents/hermes` | `/app/slim-voice` | 🖥️ Connect Baseline OS | Honest surface + connect-Baseline-OS path | Agents & Runtimes |
| Claude Code Studio | `/agents/claude-code-studio` | `/app/creative` | ✅ Live | Working MC panel/route | Creative |
| Higgsfield | `/higgsfield` | `/app/higgsfield` | ✅ Live | Working MC panel/route | Creative |
| HyperFrames | `/hyperframes` | `/app/hyperframes` | ✅ Live | Working MC panel/route | Creative |
| Creative Provider Matrix | `/agents/claude-code-studio` | `/app/provider-matrix` | ✅ Live | Working MC panel/route | Creative |
| MiniMax | `/minimax` | `/app/minimax` | ⚙️ Setup needed | Honest surface + setup path | Creative |
| Video / Creative Studio | `/video-studio` | `/app/creative` | ✅ Live | Working MC panel/route | Creative |
| Asset Library | `/agents/claude-code-studio` | `/app/asset-library` | ✅ Live | Working MC panel/route | Creative |
| Knowledge OS | `/memory` | `/app/knowledge-os` | ✅ Live | Working MC panel/route | Knowledge |
| Memory | `/memory` | `/app/memory` | ✅ Live | Working MC panel/route | Knowledge |
| NotebookLM | `/agents/notebooklm` | `/app/notebooklm` | ✅ Live | Working MC panel/route | Knowledge |
| Obsidian | `/memory` | `/app/obsidian` | 🖥️ Connect Baseline OS | Honest surface + connect-Baseline-OS path | Knowledge |
| Notion | `/notion` | `/app/notion` | ⚙️ Setup needed | Honest surface + setup path | Knowledge |
| Pinecone | `/pinecone` | `/app/pinecone` | ⚙️ Setup needed | Honest surface + setup path | Knowledge |
| PI Agent | `/agents/pi-runtime` | `/app/pi-agent` | ✅ Live | Working MC panel/route | Knowledge |
| Documents | `/documents` | `/app/documents` | ✅ Live | Working MC panel/route | Knowledge |
| Library | `/library` | `/app/library` | ✅ Live | Working MC panel/route | Knowledge |
| Skills | `/skills` | `/app/skills` | ✅ Live | Working MC panel/route | Platform |
| Marketplace | `/skills` | `/marketplace` | ✅ Live | Working MC panel/route | Platform |
| Billing / Credits | `/settings` | `/app/billing` | ✅ Live | Working MC panel/route | Platform |
| Credentials / API Keys | `/settings/api-keys` | `/app/credentials` | ✅ Live | Working MC panel/route | Platform |
| Flight Deck | `/flight-deck` | `/flight-deck` | ✅ Live | Working MC panel/route | Platform |
| SEO | `/seo` | `/app/seo` | ✅ Live | Working MC panel/route | Platform |
| Settings / Admin | `/settings` | `/app/settings` | ✅ Live | Working MC panel/route | Platform |
| Admin / Super Admin | `/admin` | `/app/super-admin` | ✅ Live | Working MC panel/route | Platform |
| Help / Docs | `/guide` | `/help` | ✅ Live | Working MC panel/route | Platform |

**Totals:** 54 surfaces · 37 live · 17 honest-state · **0 missing**.
