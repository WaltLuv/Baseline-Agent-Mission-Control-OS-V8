# Mission Control Cinematic Hero — Creative OS Proof Package

**Proof ID:** `cre_mc_hero_v1` · **Generated:** 2026-06-09 · **Pipeline:** Baseline OS Creative OS → Mission Control public hero.
**Honesty note:** NO external render (Higgsfield/Runway/Veo/Kling/MiniMax) was run — none are credentialed. This is the **Tier-2 "Cinematic Fallback Mode"**: a production-grade in-browser animated hero. External render is a documented drop-in (Tier-1).

## Provider status
| Provider | Status |
|---|---|
| Higgsfield / Runway / Veo / Kling / MiniMax video | ❌ not credentialed — Tier-1 render = setup-needed |
| In-browser cinematic (CSS/SVG, Tier-2) | ✅ shipped — the live hero |

## Source asset (Universal Asset Library)
- Operator source image → `~/.claude-os/creative/universal-asset-library/mission-control-hero-source.jpg` (Baseline OS) + `public/marketing/mission-control-hero-opening.jpg` (MC). Used as the **opening frame + thumbnail/poster**.

## Storyboard (the PM story, no narration required)
1. **Open** — operator at his property desk (source image), cinematic fade.
2. **Reveal** — fade into the command-center: parallax HUD floor + volumetric glow.
3. **Graphify** — agent nodes ignite with neural links (structural brain).
4. **Workflow** — a ticker flows the pipeline across the floor: Maintenance → Triage → Vendor → Owner Approval → Dispatch → Proof → Replay.
5. **Hold** — headline + CTAs over a dark readability gradient.

## Shot list
- S1 opening frame (image) · 0–3.4s, fade-out reveal.
- S2 backdrop pan (`mc-hero-pan`, 18s loop) — volumetric gradients.
- S3 holographic grid floor (perspective-tilted, masked).
- S4 7 agent nodes (`mc-node-pulse`) + 6 neural links (`mc-link-flow`).
- S5 workflow ticker (`mc-ticker`, 26s loop) — the 7-stage PM pipeline.
- S6 readability gradient + sr-only accessible description.

## Cinematic prompts (for the Tier-1 render when a provider connects)
- "Cinematic property-operations command center, holographic HUD, volumetric teal/violet lighting, Iron-Man/Palantir/Andor control-room aesthetic, slow dolly, particles, dark luxury enterprise, 16:10, no text."
- "Animated workflow: maintenance request → AI triage → vendor match → owner approval gate → dispatch → proof package → replay, glowing nodes + flowing data, premium SaaS launch trailer."

## Animation architecture
- Component: `src/components/marketing/mission-control-hero.tsx` (`<video>` Tier-1 layer with `<source>` mp4/webm + poster, over a live CSS/SVG scene).
- Keyframes: `src/app/globals.css` — `mc-hero-pan / mc-hero-intro / mc-node-pulse / mc-link-flow / mc-ticker`; respects `prefers-reduced-motion`.
- No layout shift (fixed 16:10 stage); autoplay/muted/loop/playsInline; poster + animated fallback; lazy (`preload="none"`).

## Asset paths
- `public/marketing/mission-control-hero-opening.jpg` (opening frame + poster/thumbnail) ✅
- `public/marketing/mission-control-hero-poster.svg` (cinematic SVG poster fallback) ✅
- `public/marketing/mission-control-hero.mp4` / `.webm` (Tier-1 render — drops in when a provider is connected) ⏳ setup-needed

## Lineage
source image → UAL → storyboard → shot list → prompts → in-browser composition (Tier-2) → MC homepage hero. Tier-1 render appends here when credentialed.
