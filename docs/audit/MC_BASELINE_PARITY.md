# Mission Control ↔ Baseline OS — Feature Parity Matrix

> Generated from src/lib/parity/surfaces.ts. Rule: if Baseline OS has a feature, Mission Control has an equivalent route with honest state — never missing, never a 404, never a fake-ready shell.

| Feature | Category | Baseline OS | Mission Control | Status |
|---|---|---|---|---|
| Dashboard | Workforce | / | /app | ✅ Live |
| Activate / Workforces | Workforce | /app/activate | /app/activate | ✅ Live |
| Workforce Templates | Workforce | /workforce-os | /app/workforce | ✅ Live |
| Tasks | Workforce | /kanban | /app/tasks | ✅ Live |
| Orchestration | Workforce | /maestro | /app/orchestration | ✅ Live |
| Approvals | Workforce | /approvals | /app/approvals | ✅ Live |
| Activity | Workforce | /activity | /app/activity | ✅ Live |
| ROI / Value | Workforce | / | /app/value | ✅ Live |
| Goals | Workforce | /goals | /app/goals | ✅ Live |
| Agents | Agents & Runtimes | /personas | /app/agents | ✅ Live |
| Personas | Agents & Runtimes | /personas | /app/personas | ✅ Live |
| Runtimes | Agents & Runtimes | /runtime-registry | /app/runtimes | ✅ Live |
| Claude Code | Agents & Runtimes | /agents/claude-code | /app/claude-code | ✅ Live |
| Codex | Agents & Runtimes | /agents/codex | /app/codex | 🔌 Connect runtime |
| OpenClaw | Agents & Runtimes | /agents/openclaw | /app/openclaw | 🔌 Connect runtime |
| Hermes | Agents & Runtimes | /agents/hermes | /app/hermes | 🔌 Connect runtime |
| Hermes VPS | Agents & Runtimes | /agents/hermes | /app/runtimes | 🔌 Connect runtime |
| Oh My Pi (OMP) | Agents & Runtimes | /agents/pi-runtime | /app/oh-my-pi | 🔌 Connect runtime |
| Antigravity | Agents & Runtimes | /agents/antigravity | /app/antigravity | 🔌 Connect runtime |
| Gemini | Agents & Runtimes | /agents/gemini | /app/gemini | ⚙️ Setup needed |
| Free Claude Code | Agents & Runtimes | /agents/free-claude | /app/free-claude | 🖥️ Connect Baseline OS |
| Browser Use | Agents & Runtimes | /browser | /app/browser-use | 🖥️ Connect Baseline OS |
| Ruflo | Agents & Runtimes | /agents/ruflo | /app/ruflo | 🖥️ Connect Baseline OS |
| Claude Code Studio | Creative | /agents/claude-code-studio | /app/creative | ✅ Live |
| Higgsfield | Creative | /higgsfield | /app/higgsfield | ✅ Live |
| HyperFrames | Creative | /hyperframes | /app/hyperframes | ⚙️ Setup needed |
| MiniMax | Creative | /minimax | /app/minimax | ⚙️ Setup needed |
| Video / Creative Studio | Creative | /video-studio | /app/creative | ✅ Live |
| Asset Library | Creative | /agents/claude-code-studio | /app/asset-library | ⚙️ Setup needed |
| Knowledge OS | Knowledge | /memory | /app/knowledge-os | ⚙️ Setup needed |
| Memory | Knowledge | /memory | /app/memory | ✅ Live |
| NotebookLM | Knowledge | /agents/notebooklm | /app/notebooklm | ⚙️ Setup needed |
| Obsidian | Knowledge | /memory | /app/obsidian | 🖥️ Connect Baseline OS |
| Notion | Knowledge | /notion | /app/notion | ⚙️ Setup needed |
| Pinecone | Knowledge | /pinecone | /app/pinecone | ⚙️ Setup needed |
| PI Agent | Knowledge | /agents/pi-runtime | /app/pi-agent | ⚙️ Setup needed |
| Documents | Knowledge | /documents | /app/documents | ✅ Live |
| Library | Knowledge | /library | /app/library | ✅ Live |
| Skills | Platform | /skills | /app/skills | ✅ Live |
| Marketplace | Platform | /skills | /marketplace | ✅ Live |
| Billing / Credits | Platform | /settings | /app/billing | ✅ Live |
| Credentials / API Keys | Platform | /settings/api-keys | /app/credentials | ✅ Live |
| Flight Deck | Platform | /flight-deck | /flight-deck | ✅ Live |
| SEO | Platform | /seo | /app/seo | ✅ Live |
| Settings / Admin | Platform | /settings | /app/settings | ✅ Live |

**Totals:** 45 surfaces · 26 live · 19 honest-state (setup/pairing/connect) · 0 missing.
