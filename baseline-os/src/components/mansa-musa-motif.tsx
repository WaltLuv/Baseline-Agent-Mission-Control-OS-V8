/**
 * Mansa Musa ornamental motifs — Baseline OS ONLY (visual layer).
 *
 * Pure SVG ornament inspired by Mali-empire geometry, Sankoré architecture, and
 * manuscript illumination. Gold leaf on Saharan night. Decorative only — no
 * interactivity, no layout impact (callers place them as accents).
 */
import { MANSA_PALETTE, type MansaMotif } from "@/lib/mansa-musa";

/** An illuminated gold rule — a manuscript-style divider. */
export function GoldRule({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 8"
      className={className}
      aria-hidden
      data-testid="mm-gold-rule"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="mm-rule" x1="0" y1="0" x2="240" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={MANSA_PALETTE.goldDeep} />
          <stop offset="50%" stopColor={MANSA_PALETTE.goldBright} />
          <stop offset="100%" stopColor={MANSA_PALETTE.goldDeep} />
        </linearGradient>
      </defs>
      <rect x="0" y="3" width="240" height="2" fill="url(#mm-rule)" />
      <path d="M120 0 l4 4 -4 4 -4 -4z" fill={MANSA_PALETTE.goldBright} />
    </svg>
  );
}

/** A Mali/Adinkra-style geometric grid badge — knowledge-network feel. */
export function MaliGeometry({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      className={className}
      aria-hidden
      data-testid="mm-mali-geometry"
    >
      <g fill="none" stroke={MANSA_PALETTE.gold} strokeWidth="1.4">
        {/* nested diamonds — Mali geometric motif */}
        <path d="M20 2 L38 20 L20 38 L2 20 Z" />
        <path d="M20 10 L30 20 L20 30 L10 20 Z" />
        {/* knowledge-network nodes at the cardinal points */}
        <circle cx="20" cy="2" r="1.6" fill={MANSA_PALETTE.goldBright} stroke="none" />
        <circle cx="38" cy="20" r="1.6" fill={MANSA_PALETTE.goldBright} stroke="none" />
        <circle cx="20" cy="38" r="1.6" fill={MANSA_PALETTE.goldBright} stroke="none" />
        <circle cx="2" cy="20" r="1.6" fill={MANSA_PALETTE.goldBright} stroke="none" />
        <circle cx="20" cy="20" r="2" fill={MANSA_PALETTE.gold} stroke="none" />
      </g>
    </svg>
  );
}

/** A Sankoré-arch crown — luxury manuscript header ornament. */
export function SankoreArch({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      className={className}
      aria-hidden
      data-testid="mm-sankore-arch"
    >
      <path
        d="M4 26 V12 C4 5 10 2 14 2 C18 2 24 5 24 12 V26"
        fill="none"
        stroke={MANSA_PALETTE.gold}
        strokeWidth="1.6"
      />
      <path d="M14 2 V0" stroke={MANSA_PALETTE.goldBright} strokeWidth="1.6" />
      <circle cx="14" cy="11" r="2.4" fill={MANSA_PALETTE.goldBright} />
    </svg>
  );
}

/** Dispatch a motif by name (for data-driven placement). */
export function MansaMotifIcon({ motif, className }: { motif: MansaMotif; className?: string }) {
  if (motif === "gold-rule") return <GoldRule className={className} />;
  if (motif === "mali-grid") return <MaliGeometry className={className} />;
  if (motif === "sankore-arch") return <SankoreArch className={className} />;
  // knowledge-network → reuse the geometric grid (node web)
  return <MaliGeometry className={className} />;
}
