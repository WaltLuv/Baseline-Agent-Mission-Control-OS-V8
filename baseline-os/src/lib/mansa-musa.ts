/**
 * Mansa Musa design system — Baseline OS ONLY (Walt's personal customization).
 *
 * A VISUAL layer inspired by the West African Golden Age — Mansa Musa, the Mali
 * Empire, Timbuktu & the Sankoré university, manuscript illumination, and African
 * geometry — modernized as luxury technology, NOT a historical recreation.
 *
 * IMPORTANT: this is design tokens + motifs only. It changes NO functionality,
 * NO workflows, NO layouts — purely palette, accents, and ornamental motifs.
 * It must NEVER ship to Baseline Mission Control (customer/cloud product).
 */

/** Core palette — gold leaf, Saharan night, manuscript parchment, indigo trade-cloth. */
export const MANSA_PALETTE = {
  gold: "#C9A227", // Mansa's gold — primary accent
  goldBright: "#E6C35C", // illuminated highlight
  goldDeep: "#8C6D1F", // engraved shadow
  night: "#0B0A12", // Saharan night (base background)
  indigo: "#2B2A4A", // Mali indigo trade cloth
  parchment: "#E8DCC0", // Timbuktu manuscript parchment
  parchmentMute: "#B9AD8E",
  terracotta: "#A85638", // Djenné mud-brick / clay
  ink: "#1A140C", // manuscript ink
} as const;

/** Motif vocabulary — geometric + manuscript patterns used as ornament. */
export const MANSA_MOTIFS = [
  "gold-rule", // illuminated divider rule
  "mali-grid", // Mali/Adinkra-style geometric grid
  "sankore-arch", // Sankoré mosque arch
  "knowledge-network", // manuscript "knowledge network" node web
] as const;
export type MansaMotif = (typeof MANSA_MOTIFS)[number];

/** A small, documented theme object surfaces can opt into for gold accents. */
export const MANSA_MUSA = {
  name: "Mansa Musa",
  scope: "baseline-os-only" as const,
  palette: MANSA_PALETTE,
  motifs: MANSA_MOTIFS,
  /** Gradient strings for accent treatments (gold leaf on night). */
  gradients: {
    goldLeaf: `linear-gradient(90deg, ${MANSA_PALETTE.goldDeep}, ${MANSA_PALETTE.gold} 45%, ${MANSA_PALETTE.goldBright})`,
    nightToIndigo: `linear-gradient(135deg, ${MANSA_PALETTE.night}, ${MANSA_PALETTE.indigo})`,
  },
  /** CSS custom properties to register globally (additive — names are namespaced). */
  cssVars: {
    "--mm-gold": MANSA_PALETTE.gold,
    "--mm-gold-bright": MANSA_PALETTE.goldBright,
    "--mm-gold-deep": MANSA_PALETTE.goldDeep,
    "--mm-night": MANSA_PALETTE.night,
    "--mm-indigo": MANSA_PALETTE.indigo,
    "--mm-parchment": MANSA_PALETTE.parchment,
    "--mm-terracotta": MANSA_PALETTE.terracotta,
  },
} as const;

/** Build the inline CSS-vars style object (for a root wrapper). */
export function mansaCssVars(): Record<string, string> {
  return { ...MANSA_MUSA.cssVars };
}

/**
 * Mansa Musa V2 — "Mansa Musa × Apple × Palantir × Iron Man × Wakanda".
 * Elevated, operational, HUD-grade: holographic gold, carbon glass, HUD cyan,
 * regal violet. Used by the <MansaSurface>/<MansaHeader> primitives so every
 * surface gets the same elite/futuristic treatment — visual layer only.
 */
export const MANSA_V2 = {
  carbon: "#070710", // carbon-black base
  glass: "rgba(18,16,28,0.66)", // frosted glass panel
  glassBorder: "rgba(201,162,39,0.28)", // gold hairline
  hudCyan: "#43E5FF", // HUD readout / live signal
  regalViolet: "#7C5CFF", // royal accent
  goldGlow: "0 0 24px rgba(201,162,39,0.22)",
  /** A faint Mali-geometry grid as a panel backdrop (data-URI SVG, gold lines). */
  gridBackdrop:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Cpath d='M20 0L40 20L20 40L0 20Z' fill='none' stroke='%23C9A227' stroke-opacity='0.06'/%3E%3C/svg%3E\")",
  /** Per-surface accent tones so each HUD keeps an identity within the system. */
  surfaceTone: {
    flightDeck: "#43E5FF",
    graphify: "#43E5FF",
    maestro: "#7C5CFF",
    hermes: "#C9A227",
    gemini: "#E6C35C",
    replay: "#7C5CFF",
    creative: "#E6C35C",
    slim: "#43E5FF",
  } as Record<string, string>,
} as const;

/** Inline style for a Mansa V2 glass surface (panel/card). Visual only. */
export function mansaSurfaceStyle(
  tone: string = MANSA_PALETTE.gold,
): import("react").CSSProperties {
  return {
    background: `${MANSA_V2.gridBackdrop}, ${MANSA_V2.glass}`,
    border: `1px solid ${MANSA_V2.glassBorder}`,
    borderRadius: 16,
    boxShadow: `${MANSA_V2.goldGlow}, inset 0 1px 0 rgba(255,255,255,0.04)`,
    backdropFilter: "blur(8px)",
    ["--mm-tone" as string]: tone,
  };
}
