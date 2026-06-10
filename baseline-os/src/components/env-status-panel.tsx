/**
 * EnvStatusPanel — Live grid of API key + integration credential status.
 *
 * Reads /__env_status. Never displays raw key values — only presence + masked preview.
 */

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, RefreshCw, KeyRound } from "lucide-react";

interface EnvKey {
  name: string;
  group: string;
  present: boolean;
  preview?: string;
}

interface Props {
  tone: string;
  /** Filter to specific groups (e.g. ["core","higgsfield"]). Default: all. */
  groups?: string[];
  compact?: boolean;
}

const GROUP_LABEL: Record<string, string> = {
  core: "Core routing",
  providers: "Direct providers",
  media: "Image & voice",
  higgsfield: "Higgsfield MCP",
  voice: "ElevenLabs voices",
  integrations: "Integrations",
  twilio: "Twilio",
  channels: "Channels",
};

export function EnvStatusPanel({ tone, groups, compact }: Props) {
  const [keys, setKeys] = useState<EnvKey[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/__env_status");
      const j = await r.json() as { keys: EnvKey[] };
      setKeys(j.keys || []);
    } catch { setKeys([]); }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  if (!keys) return <div className="text-[11px]" style={{ color: "var(--fg-dim)" }}>Loading credential status…</div>;

  const filtered = groups ? keys.filter((k) => groups.includes(k.group)) : keys;

  const byGroup = new Map<string, EnvKey[]>();
  for (const k of filtered) {
    const arr = byGroup.get(k.group) ?? [];
    arr.push(k);
    byGroup.set(k.group, arr);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <KeyRound size={13} style={{ color: tone }} />
          <h3 className="text-[10.5px] font-semibold uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>
            Credentials
          </h3>
          <span className="text-[10px]" style={{ color: "var(--fg-dimmer)" }}>
            {filtered.filter((k) => k.present).length}/{filtered.length} present
          </span>
        </div>
        <button onClick={load} className="p-1.5 rounded-md transition" style={{ background: "rgba(243,235,218,0.04)", border: "1px solid var(--panel-border)", color: "var(--fg-dim)" }} title="Refresh">
          <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {Array.from(byGroup.entries()).map(([group, list]) => (
        <div key={group}>
          <div className="text-[9px] uppercase tracking-[0.18em] mb-1.5" style={{ color: "var(--cream-mute)" }}>
            {GROUP_LABEL[group] ?? group}
          </div>
          <div className={compact ? "grid grid-cols-2 gap-1.5" : "grid grid-cols-1 gap-1.5"}>
            {list.map((k) => (
              <div
                key={k.name}
                className="flex items-center gap-2 px-2 py-1.5 rounded transition"
                style={{
                  background: k.present ? `${tone}08` : "rgba(0,0,0,0.25)",
                  border: `1px solid ${k.present ? `${tone}22` : "rgba(239,68,68,0.18)"}`,
                }}
              >
                {k.present
                  ? <CheckCircle2 size={11} style={{ color: "#10B981" }} className="shrink-0" />
                  : <XCircle size={11} style={{ color: "#ef4444", opacity: 0.55 }} className="shrink-0" />}
                <span className="flex-1 text-[10.5px] font-mono truncate" style={{ color: k.present ? "var(--fg)" : "var(--fg-dimmer)" }}>
                  {k.name}
                </span>
                {k.preview && (
                  <span className="text-[9.5px] font-mono" style={{ color: tone }} title="Masked preview">{k.preview}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
