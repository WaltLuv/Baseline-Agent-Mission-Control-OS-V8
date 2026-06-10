/**
 * Mansa Musa V2 surface primitives — Baseline OS ONLY (visual layer).
 *
 * <MansaSurface> — a frosted carbon-glass panel with a gold hairline + Mali-grid
 * backdrop (the "Apple × Palantir × Wakanda" HUD look).
 * <MansaHeader>  — a HUD title bar with a Sankoré crest, gold rule, and a live
 * HUD-cyan signal dot.
 *
 * Decorative wrappers only — they render `children` unchanged and add NO behavior,
 * so adopting them never alters functionality or layout flow.
 */
import type { ReactNode } from "react";
import { mansaSurfaceStyle, MANSA_V2, MANSA_PALETTE } from "@/lib/mansa-musa";
import { SankoreArch, GoldRule } from "@/components/mansa-musa-motif";

export function MansaSurface({
  children,
  tone = MANSA_PALETTE.gold,
  className = "",
  testid,
}: {
  children: ReactNode;
  tone?: string;
  className?: string;
  testid?: string;
}) {
  return (
    <div
      className={`p-4 ${className}`}
      style={mansaSurfaceStyle(tone)}
      data-testid={testid ?? "mansa-surface"}
    >
      {children}
    </div>
  );
}

export function MansaHeader({
  title,
  subtitle,
  tone = MANSA_V2.hudCyan,
}: {
  title: string;
  subtitle?: string;
  tone?: string;
}) {
  return (
    <div className="mb-3" data-testid="mansa-header">
      <div className="flex items-center gap-2">
        <SankoreArch size={22} />
        <span
          className="inline-block h-1.5 w-1.5 animate-pulse rounded-full"
          style={{ background: tone, boxShadow: `0 0 8px ${tone}` }}
        />
        <h1 className="text-lg font-bold tracking-tight" style={{ color: MANSA_PALETTE.parchment }}>
          {title}
        </h1>
      </div>
      {subtitle && (
        <p className="mt-1 text-xs" style={{ color: MANSA_PALETTE.parchmentMute }}>
          {subtitle}
        </p>
      )}
      <GoldRule className="mt-2 h-1.5 w-32 opacity-80" />
    </div>
  );
}
