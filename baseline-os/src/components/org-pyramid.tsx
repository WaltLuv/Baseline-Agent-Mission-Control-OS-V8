/**
 * OrgPyramid — the workforce hierarchy as a regal, top-down pyramid.
 *
 * African-royalty-INSPIRED visual language (gold leaf on Saharan night, Mali
 * indigo, parchment) drawn from the Baseline OS Mansa design system — imagery
 * and palette only, no literal naming in the rendered UI. Each agent shows a
 * portrait, name, role, department, and approval authority; reporting lines are
 * drawn parent → child so "who reports to whom" reads at a glance. The apex
 * wears a crown. Built for marvel.
 *
 * Baseline-OS-only (this component imports the Mansa system, which never ships
 * to Mission Control).
 */
import { MANSA_PALETTE } from "@/lib/mansa-musa";
import { MaliGeometry } from "@/components/mansa-musa-motif";
import { OperatorCrest } from "@/components/graphify-awareness";

import pHermes from "@/assets/hermes-art/01-hermes-messenger.png";
import pOracle from "@/assets/hermes-art/02-oracle-delphi.png";
import pAthena from "@/assets/hermes-art/03-athena-owl.png";
import pScribe from "@/assets/hermes-art/04-scribe-scrolls.png";
import pOrpheus from "@/assets/hermes-art/05-orpheus-lyre.png";
import pMaggie from "@/assets/hermes-art/06-maggie-walker.png";
import pAlchemist from "@/assets/hermes-art/07-alchemist-workshop.png";
import pRogers from "@/assets/hermes-art/08-rogers-hobson.png";
import pMapmaker from "@/assets/hermes-art/09-mapmaker.png";
import pRobert from "@/assets/hermes-art/10-robert-smith.png";
import pWalter from "@/assets/hermes-art/11-walter-thornton.png";

export interface PyramidNode {
  id: string;
  name: string;
  role: string;
  department: string;
  approval: string;
  status: string;
  reports: PyramidNode[];
}

const G = MANSA_PALETTE;

// Correct, persona-matched portraits. Priority:
//   1) exact persona id → its own portrait (maggie-walker, rogers-hobson, …),
//   2) role/identity keyword → the matching thematic portrait,
//   3) deterministic hash over the full pantheon — so EVERY persona shows a real
//      portrait (matching the Hermes page's avatar convention), never initials.
const ALL_PORTRAITS = [pHermes, pOracle, pAthena, pScribe, pOrpheus, pMaggie, pAlchemist, pRogers, pMapmaker, pRobert, pWalter];

// Persona id (from the Hermes pantheon) → its dedicated portrait.
const PORTRAIT_BY_ID: Record<string, string> = {
  "maggie-walker": pMaggie,
  "rogers-hobson": pRogers,
  "robert-smith": pRobert,
  "walter-thornton": pWalter,
  "lester-freamon": pOracle, // intelligence · research · pattern recognition
};

// Role/identity keyword → thematic portrait (for personas without a dedicated one).
const PORTRAIT_RULES: Array<[RegExp, string]> = [
  [/operator|ceo|orchestrat|surrogate|principal|founder/i, pWalter],
  [/research|intelligence|pattern|analyst|audit|foresight/i, pOracle],
  [/strateg|invest|capital|numbers|territory|market|expansion/i, pAthena],
  [/compliance|policy|risk|legal|counsel|integrity|defense|negotiat/i, pRogers],
  [/content|creative|production|campaign|brand|marketing|design|video|music|voice/i, pOrpheus],
  [/scribe|archiv|writer|scroll|document|knowledge/i, pScribe],
  [/courier|comms|communicat|dispatch|reception|intake|messeng|collections|chase/i, pHermes],
  [/systems|quality|integrat|mcp|engineer|contractor|ops|operation/i, pAlchemist],
  [/map|navigat|plan|growth|partnership|territory|division|field|inspection/i, pMapmaker],
];

function hashIdx(s: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % mod;
}

function portraitFor(node: PyramidNode): string {
  if (PORTRAIT_BY_ID[node.id]) return PORTRAIT_BY_ID[node.id];
  const hay = `${node.name} ${node.role}`;
  for (const [re, img] of PORTRAIT_RULES) if (re.test(hay)) return img;
  // Deterministic real portrait (stable per persona) — never an empty crest.
  return ALL_PORTRAITS[hashIdx(node.id || node.name, ALL_PORTRAITS.length)];
}

function Avatar({ node, size }: { node: PyramidNode; size: number }) {
  const src = portraitFor(node);
  if (src) {
    return (
      <img
        src={src}
        alt={node.name}
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ width: size, height: size, border: `2px solid ${G.gold}`, boxShadow: `0 0 14px ${G.gold}55` }}
      />
    );
  }
  return <OperatorCrest name={node.name} size={size} />;
}

function AgentCard({
  node,
  isApex,
  selected,
  onSelect,
}: {
  node: PyramidNode;
  isApex: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const gated = node.approval && node.approval !== "auto";
  const offline = node.status && node.status !== "active";
  return (
    <button
      type="button"
      onClick={() => onSelect(node.id)}
      data-testid={`pyramid-node-${node.id}`}
      data-apex={isApex ? "true" : undefined}
      className="org-card"
      style={{
        borderColor: selected ? G.goldBright : `${G.gold}40`,
        background: isApex
          ? `linear-gradient(160deg, ${G.indigo}, ${G.night})`
          : "linear-gradient(160deg, rgba(43,42,74,0.55), rgba(11,10,18,0.85))",
        boxShadow: isApex ? `0 8px 30px ${G.gold}33` : selected ? `0 0 0 2px ${G.goldBright}66` : "none",
      }}
    >
      {isApex && (
        <span className="org-crown" title="Apex authority" style={{ color: G.goldBright }}>
          ♛
        </span>
      )}
      <Avatar node={node} size={isApex ? 64 : 48} />
      <div className="org-card-name" style={{ color: G.parchment }}>
        {node.name}
      </div>
      <div className="org-card-role" style={{ color: G.parchmentMute }}>
        {node.role || "—"}
      </div>
      <div className="org-card-badges">
        <span className="org-badge" style={{ background: `${G.indigo}`, color: G.parchment, borderColor: `${G.gold}40` }}>
          {node.department || "Unassigned"}
        </span>
        {gated && (
          <span className="org-badge" style={{ background: `${G.terracotta}33`, color: "#f0b9a4", borderColor: `${G.terracotta}66` }}>
            ⚷ {node.approval}
          </span>
        )}
        <span
          className="org-dot"
          title={offline ? node.status : "active"}
          style={{ background: offline ? "#6b6480" : "#34d399", boxShadow: offline ? "none" : "0 0 8px #34d399" }}
        />
      </div>
      {node.reports.length > 0 && (
        <div className="org-reports-count" style={{ color: G.goldBright }}>
          {node.reports.length} report{node.reports.length > 1 ? "s" : ""}
        </div>
      )}
    </button>
  );
}

function Subtree({
  node,
  depth,
  selectedId,
  onSelect,
}: {
  node: PyramidNode;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <li>
      <AgentCard node={node} isApex={depth === 0} selected={selectedId === node.id} onSelect={onSelect} />
      {node.reports.length > 0 && (
        <ul>
          {node.reports.map((r) => (
            <Subtree key={r.id} node={r} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function OrgPyramid({
  nodes,
  selectedId,
  onSelect,
}: {
  nodes: PyramidNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="org-pyramid-wrap" data-testid="org-pyramid">
      <style>{ORG_PYRAMID_CSS}</style>
      {/* Regal geometric watermark */}
      <div className="org-pyramid-motif" aria-hidden>
        <MaliGeometry size={120} />
      </div>
      <div className="org-pyramid-scroll">
        <ul className="org-tree">
          {nodes.map((n) => (
            <Subtree key={n.id} node={n} depth={0} selectedId={selectedId} onSelect={onSelect} />
          ))}
        </ul>
      </div>
    </div>
  );
}

// CSS org-tree: each <ul> is a tier; gold connectors are drawn with borders so
// the layout naturally forms a pyramid (apex on top, widening downward).
const GOLD = MANSA_PALETTE.gold;
const ORG_PYRAMID_CSS = `
.org-pyramid-wrap { position: relative; border-radius: 18px; overflow: hidden;
  background:
    radial-gradient(1000px 420px at 50% -8%, ${MANSA_PALETTE.gold}1f, transparent 60%),
    linear-gradient(180deg, ${MANSA_PALETTE.indigo}66, ${MANSA_PALETTE.night});
  border: 1px solid ${MANSA_PALETTE.gold}33; padding: 28px 16px 36px; }
.org-pyramid-motif { position: absolute; top: 10px; right: 16px; opacity: 0.10; pointer-events: none; }
.org-pyramid-scroll { overflow-x: auto; padding-bottom: 8px; }
.org-tree, .org-tree ul { display: flex; justify-content: center; list-style: none; margin: 0; padding: 0; position: relative; }
.org-tree ul { padding-top: 26px; }
.org-tree li { position: relative; padding: 26px 10px 0; text-align: center; }
/* down-line from each node */
.org-tree li::before { content: ""; position: absolute; top: 0; left: 50%; width: 0; height: 26px;
  border-left: 2px solid ${GOLD}55; }
/* horizontal connector across siblings */
.org-tree li::after { content: ""; position: absolute; top: 0; right: 50%; width: 50%; height: 26px;
  border-top: 2px solid ${GOLD}55; }
.org-tree li:last-child::after { display: none; }
.org-tree li:first-child::before { display: none; }
.org-tree li:only-child::after, .org-tree li:only-child::before { display: none; }
.org-tree > li { padding-top: 0; }
.org-tree > li::before, .org-tree > li::after { display: none; }
/* re-add the down-stub for siblings on the left edge */
.org-tree li:first-child::after { border-top: 2px solid ${GOLD}55; }
.org-tree li::after.is-edge { display: block; }
.org-card { position: relative; display: inline-flex; flex-direction: column; align-items: center; gap: 6px;
  min-width: 150px; max-width: 180px; padding: 14px 12px 12px; border-radius: 14px; cursor: pointer;
  border: 1px solid; transition: transform .12s ease, box-shadow .12s ease; }
.org-card:hover { transform: translateY(-2px); }
.org-crown { position: absolute; top: -14px; left: 50%; transform: translateX(-50%); font-size: 20px; }
.org-card-name { font-size: 13px; font-weight: 700; line-height: 1.2; }
.org-card-role { font-size: 11px; line-height: 1.25; min-height: 14px; }
.org-card-badges { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; justify-content: center; margin-top: 2px; }
.org-badge { font-size: 9px; padding: 2px 6px; border-radius: 999px; border: 1px solid; white-space: nowrap; }
.org-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.org-reports-count { font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 3px; }
`;
