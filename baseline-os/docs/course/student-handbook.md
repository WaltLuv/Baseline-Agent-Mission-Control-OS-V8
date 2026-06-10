# Student Handbook — Baseline Automations

> Everything you need before Week 1. Bookmark this.

---

## Welcome

You've enrolled in the only course that ends with you running your own AI operations center on your own machine. Not a chatbot demo. Not a cloud SaaS. An actual OS.

This handbook is your **week-zero setup**. Do this before Week 1's live session.

---

## Hardware checklist

| Requirement | Minimum | Recommended |
|---|---|---|
| Mac / Linux / Win+WSL2 | macOS 14, Ubuntu 22.04, or Win 11 WSL2 | Same |
| RAM | 16 GB | 32 GB (Gemma 4 31B fits in RAM with headroom) |
| Disk | 100 GB free | 200 GB |
| CPU | Apple Silicon M1 or recent x86 | Apple Silicon M2/M3 or Ryzen 7+ |
| Internet | Stable broadband | Same |

**You don't need a GPU.** Local Gemma 4 runs on the Mac Neural Engine / CPU just fine.

---

## Account checklist

Sign up for these *before* Week 1. All have free tiers that cover the course:

| Service | Why | Setup |
|---|---|---|
| **OpenRouter** | All agent chats route here | https://openrouter.ai/keys · top up $20 |
| **Anthropic** (optional) | Direct Claude API | https://console.anthropic.com |
| **Google AI Studio** | Gemini direct, NotebookLM access | https://aistudio.google.com/app/apikey |
| **Notion** | Memory layer 2 | Create integration at https://www.notion.so/profile/integrations |
| **Pinecone** | Memory layer 3 (vector) | https://app.pinecone.io · serverless, free tier |
| **Higgsfield** | Image + video gen | https://higgsfield.ai · basic plan ($0/mo with credits) |
| **ElevenLabs** | TTS for podcast / Audio Overview | https://elevenlabs.io · free tier |
| **GitHub** | For the skill installer | `gh auth login` works |
| **Telegram** (optional) | For ClaudeClaw bridge | @BotFather → /newbot |

You can skip the optional ones until the week they come up.

---

## Software installation (do this once)

### macOS (recommended path)

```bash
# package managers
xcode-select --install                     # if not already
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# essentials
brew install bun                            # JS runtime + package manager
brew install python@3.12                    # for notebooklm-py (needs <3.13)
brew install pipx
brew install ollama                         # local Gemma
brew install gh                             # GitHub CLI
brew install cloudflared                    # for Hermes MCP tunnel
brew install --cask claude                  # Claude Desktop app

# global CLIs
npm install -g @anthropic-ai/claude-code   # claude CLI
npm install -g @openai/codex                # codex CLI
npm install -g @google/gemini-cli           # gemini CLI

# verify
bun --version          # 1.2+
python3.12 --version   # 3.12.x
ollama --version       # 0.5+
gh --version           # 2.50+
claude --version       # 2.1+
```

### Linux

Same idea, swap brew commands:
```bash
curl -fsSL https://bun.sh/install | bash
sudo apt install python3.12 pipx
curl -fsSL https://ollama.com/install.sh | sh
```

### Windows

Use **WSL2 Ubuntu** and follow the Linux instructions inside WSL. Native Windows is supported by Baseline Automations but several skills (notebooklm-py, hermes MCP) need POSIX.

---

## Initial setup (after Week 1 lecture)

```bash
# 1. Clone the repo
git clone https://github.com/WaltLuv/baseline-agent-os.git ~/code/baseline-agent-os
cd ~/code/baseline-agent-os

# 2. Install deps
bun install

# 3. Configure env
cp .env.local.example .env.local
$EDITOR .env.local
# At minimum: OPENROUTER_API_KEY

# 4. Pull skills (230 of them)
bun run scripts/install-skills.ts

# 5. Pull a local Gemma model (skip if you only have 16 GB and will use cloud)
ollama pull gemma4:e4b   # 9.6 GB, fits in 8 GB RAM
# OR
ollama pull gemma4:31b   # 20 GB, fits in 32 GB RAM

# 6. Start
bun run dev
# → http://localhost:8081
```

---

## Daily workflow (during the course)

```bash
# pull latest course updates each week
cd ~/code/baseline-agent-os
git pull origin main

# start the dashboard
bun run dev

# in another tab: refresh skills if any new ones were added upstream
bun run scripts/install-skills.ts

# in a third tab: keep Ollama running for local Gemma
ollama serve   # or just have the Ollama app open
```

---

## Discord etiquette

Channel: `#baseline-agents`

| Channel | Use for |
|---|---|
| `#announcements` | Course updates (instructors only post here) |
| `#general` | Wins, intros, off-topic |
| `#help` | "My X is broken" — paste error first, ask question second |
| `#labs-week-XX` | One channel per week's lab discussion |
| `#capstones` | Show work in progress, get feedback |
| `#alumni` | Past-cohort lounge |

Norms:
- **Show your code** is the default first response. We don't debug from descriptions.
- **Search first.** Most week-1 questions have been answered 10 times. Use search.
- **Solve in public.** When you solve your own problem, post the solution. Future cohorts will thank you.

---

## FAQ

### Do I need to be a developer?

You need to be comfortable in a terminal. You need to be able to read errors and follow stack traces. You don't need to be senior. Plenty of past students were operators (real estate, agency, e-commerce) without formal CS backgrounds.

### Will this work on Windows?

Yes via WSL2. Native Windows is partially supported but you'll hit roadblocks in weeks 9 and 11 (POSIX-only tools). Use WSL.

### Do I need an Apple Silicon Mac?

No. Apple Silicon makes local Gemma 4 31B faster. Intel Macs and x86 Linux work fine — you just may want to use the smaller `gemma4:e4b` model.

### What if I fall behind?

You have a 1-week grace period on every deliverable. After that, you can still complete labs — they're not synchronous in self-paced. In cohort tier, falling 2+ weeks behind risks not having time for the capstone.

### Can I use my work laptop?

If your work allows it. Some weeks require installing local binaries (Ollama, Cloudflared). If you can't install local binaries, you can still complete most weeks but will skip Hermes MCP setup (week 9) and local Gemma (whenever it comes up).

### Will the course be updated?

Yes. The repo is the course. Every push to `main` is a course update. You get them automatically via `git pull`. Lifetime updates are included.

### What if I have a different business than the examples?

The examples lean property ops + YouTube because that's the instructor's world. The architecture is universal. Every lab can be adapted to your domain. Office hours is where we workshop your specific case.

### What if I want to teach this?

After completing the course + capstone, apply to be a TA for the next cohort. Top capstones get featured + author invited.

---

## Refund / withdrawal

- **Self-paced:** 14 days, no questions asked
- **Cohort:** through Week 2 (you've seen 16% of live calls)
- **Workshop:** 72 hours before kickoff
- **Corporate:** per contract

We don't believe in trapping people. If you decide this isn't for you, just say so.

---

## You're ready. See you in Week 1.

Bring:
- Your laptop (charged, ready, dashboard already running)
- One real business decision to feed into the Triad in Week 8
- One real document set to feed into NotebookLM in Week 11
- One real project to ship as your capstone in Week 12

Welcome to the OS.
