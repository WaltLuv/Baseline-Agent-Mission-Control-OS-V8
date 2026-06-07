# Backlog — Creative / Video Studio (post Phase-3)

> Captured 2026-06-06 during Phase 3 (Production Vertical Completion). Per Walt:
> build these **after** production vertical completion unless there's a clean,
> low-risk integration during the same pass. Truth-first: mirror only what each
> CLI/API actually supports; show setup-needed / `unsupported_by_cli` otherwise;
> never fake capability, renders, or connected state.

## 1. Claude Code Studio / Video Editing Team (Baseline OS `/agents/claude-code` → Specialized Agents)
- Rename **MiniMax Studio → Claude Code Studio** (MiniMax becomes one provider, not the whole thing).
- New "Video Editing Team" section under Specialized Agents with 8 personas:
  Ava Director (Creative Director), Miles Cutter (Video Editor), Nia Frames
  (HyperFrames Specialist), Theo Motion (Remotion Engineer), Zara Avatar
  (HeyGen/Avatar), Leo Sound (Voice/Audio), Iris Visuals (Image/B-roll),
  Quinn Publish (Distribution/SEO).
- Core workflows: script→storyboard→shot list→visual prompts→images→clips→
  edit→VO timing→captions→thumbnails→shorts→YouTube metadata→publish checklist→
  Remotion render→avatar gen→proof/export manifest.
- Studio surfaces: project brief, script, storyboard, visual prompt pack, asset
  list, render queue, tool status, connected providers, missing-setup states,
  proof/export manifest, publish checklist.
- Approval policy (LOW/MEDIUM/HIGH/BLOCKED) per Walt's spec; blocked =
  deepfake-without-consent, copyrighted misuse, impersonation, publish-without-
  approval, over-budget spend, likeness-without-authorization.

## 2. Higgsfield CLI / Supercomputer-style control center (Baseline OS `/higgsfield` + Mission Control provider)
- CLI adapter: detect / version / auth status / list capabilities / run job /
  job status / fetch artifact / dry-run — each returns `unsupported_by_cli` if
  the real CLI lacks it. No invented behavior.
- Control-center UI sections: Create, Projects, Models/Tools, Render Queue,
  Assets, Proof, Setup. Honest tool state (Connected / Missing credentials /
  CLI missing / Setup required / Error / Ready).
- Mission Control: Higgsfield as runtime card + creative provider in Claude Code
  Studio + credential provider + marketplace dependency + setup-needed on video
  workflows; cloud job tracking, proof ingestion, cost/credit estimate,
  approval gate for paid renders (2.5x markup, threshold approval).
- Truth rule: do NOT claim "everything Higgsfield Supercomputer can do" — mirror
  CLI/API only; unsupported features show "Not available through current CLI/API".

## 3. Creative provider matrix (Baseline OS + Mission Control)
HyperFrames, Higgsfield, Remotion, HeyGen, MiniMax, ElevenLabs, OpenAI/image,
Gemini image/video (if configured), Runway (if configured), Pika (if configured).
Every card: honest Connected / Missing-credentials / CLI-missing / Setup-required
/ Error / Ready state via Credentials Manager + runtime probes. No fake ready.

## 4. HyperFrames render pipeline (from Walt's prompts)
- Clone/analyze HeyGen Hyperframes open-source repo; confirm ffmpeg (✓ ffmpeg
  8.0.1 already installed locally) before building HTML→MP4 rendering.
- Audio→text: utility that extracts audio from an .mp4 and uses OpenAI Whisper
  for word-level timestamps → JSON (gate on OPENAI key present).
- `/make-a-video` skill SOP: transcribe → interview (aesthetic / facecam vs
  overlays vs full-motion / CTA) → generate a timestamp-mapped editing plan →
  pause for approval before writing render code.

## Gating (all of the above)
Email-verified user, credentials present, CLI present, sufficient credits (MC
mode), and approval for paid/over-threshold renders — same engine as the rest of
the platform. Tests required per Walt's per-feature test lists. ffmpeg confirmed
present (8.0.1).
