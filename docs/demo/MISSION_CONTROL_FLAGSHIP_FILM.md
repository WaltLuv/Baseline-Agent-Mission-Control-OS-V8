# Mission Control — Flagship Cinematic Film · Production Package

**Proof ID:** `cre_mc_flagship_v1` · **Date:** 2026-06-09 · Built via Baseline OS Creative OS.
**Status:** pre-production COMPLETE + Tier-2 in-browser cinematic LIVE. Final rendered film = **blocked on 2 inputs** (honest): (a) a video-generation/render provider credential, (b) the original source video + narration/soundtrack track (never supplied). No fake render is committed.

## Preserve (do NOT change)
Narration · messaging · story structure · Real Estate Execution Platform positioning · Mission Control as flagship.

## Visual target
Mansa Musa V2 × Palantir Foundry × Iron Man HUD × Andor control room × Wakanda tech × Apple launch film. NOT generic particles/gradients/mood-ring.

## Storyboard — 4 acts (rebuilt around the narration)
- **ACT I · BOOT** — dark command center; Graphify network floats up; AI-workforce nodes ignite; "Mission Control online" boot sequence.
- **ACT II · OPERATIONS** — 3D holographic property portfolio; maintenance tickets flow → AI triage → vendor match → owner-approval gate → dispatch → proof.
- **ACT III · MARKET SWARM** — 100 agents scanning a county grid; distressed-property swarm; lead scoring; market-intelligence overlays.
- **ACT IV · CONTROL TOWER** — Flight Deck telemetry, Graphify neural brain, Workforce Replay, Proof engine, Agent Activity, Knowledge OS — the supervisor layer.

## Shot list (per act)
1. Slow push-in on the dark HUD; volumetric teal/violet light; nodes power on (boot readout). 0–8s.
2. Camera orbits a holographic property portfolio; chips flow Maintenance→Triage→Vendor→Owner Approval→Dispatch→Proof; approval gate pulses gold. 8–22s.
3. Top-down county grid; 100 agent dots sweep + light up; lead scores rise; "distressed" cluster highlights. 22–34s.
4. Pull back to the control tower: Flight Deck panels, Graphify network, replay scrubber, proof seals; tagline lock-up. 34–45s.

## Asset requirements
Source hero video + narration VO + soundtrack (REQUIRED, not yet provided) · brand palette (Mansa V2 gold / HUD cyan / regal violet) · UI captures of Flight Deck/Graphify/Replay/Maintenance/Approvals · property-portfolio 3D model or matte · county-map plate.

## Render plan (Tier-1, when unblocked)
1. Ingest source video + VO + music → Universal Asset Library.
2. Scene-split to the 4 acts; lock timing to narration beats.
3. Per-act generate/compose: provider render (img2vid/text2vid) → composite UI overlays + HUD motion graphics → volumetric light, parallax, lens.
4. Color + sound design (impacts/whooshes, narration dominant).
5. Export 4K master + 1080p fallback + 10–20s loop + poster frame → `public/marketing/mission-control-hero.{mp4,webm}` + poster.

## Provider chain (priority; honest setup-needed)
`text/img → video`: Runway → Kling → Higgsfield → Veo → MiniMax (first credentialed wins).
`voice` (if re-VO needed): ElevenLabs. `compose/export`: HyperFrames / local ffmpeg.
**Current:** none credentialed → Tier-1 render = setup-needed. Add a key and the export drops into the `<video>` slot automatically.

## Tier-2 (LIVE NOW) — `src/components/marketing/mission-control-hero.tsx`
A keynote-paced, 4-act in-browser cinematic sequence (boot → operations → swarm → control tower) with act title cards, the actual systems visualized, opening frame, poster, and the `<video>` drop-in. This is the production fallback until the Tier-1 film renders.

## Proof + lineage
proof id `cre_mc_flagship_v1`; opening frame in Baseline OS UAL (`mission-control-hero-source.jpg`); lineage: source image → storyboard → shot list → Tier-2 composition → MC homepage; Tier-1 render appends on provider connect.

## To finish the rendered film
1. Provide the original Mission Control hero **video file** + narration + soundtrack. 2. Add one render-provider key (Runway/Kling/Higgsfield/Veo/MiniMax). Then Creative OS executes the render plan → 4K master replaces the Tier-2 sequence automatically.
