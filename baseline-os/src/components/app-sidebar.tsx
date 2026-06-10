import { Link, useRouterState } from "@tanstack/react-router";
import {
  ChevronDown,
  Home,
  Sparkles,
  FolderOpen,
  Brain,
  Activity,
  Settings as SettingsIcon,
  Target,
  BookOpen,
  BookMarked,
  BookText,
  Zap,
  LayoutDashboard,
  Globe,
  Wand2,
  Image as ImageIcon,
  Film,
  Terminal,
  Database,
  MessageCircle,
  Layers,
  Network,
  Crown,
  Search,
  Rocket,
  Users as UsersIcon,
  Box,
  Diamond,
  Code2,
  Cpu,
  StickyNote,
  Play,
} from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import baselineLogo from "@/assets/baseline-logo.svg";

const AVATAR_STORAGE_KEY = "claude-os.avatar.v1";
const OPERATOR_NAME_KEY = "claude-os.operator-name.v1";

function readStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

// Sidebar identity block — avatar + name. Reads both from localStorage and
// listens for cross-tab + same-tab updates (the wizard fires synthetic
// StorageEvents on save so this block updates as the user types their name).
function SidebarIdentity() {
  const [avatar, setAvatar] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    setAvatar(readStorage(AVATAR_STORAGE_KEY));
    setName(readStorage(OPERATOR_NAME_KEY));
    const onStorage = (e: StorageEvent) => {
      if (e.key === AVATAR_STORAGE_KEY || e.key === null) {
        setAvatar(readStorage(AVATAR_STORAGE_KEY));
      }
      if (e.key === OPERATOR_NAME_KEY || e.key === null) {
        setName(readStorage(OPERATOR_NAME_KEY));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Initials for the placeholder avatar if no photo is set.
  const initials = (() => {
    const trimmed = (name ?? "").trim();
    if (!trimmed) return "OP";
    const parts = trimmed.split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "OP";
  })();

  const displayName = name?.trim() || "Operator";

  return (
    <div className="flex items-center gap-3">
      {avatar ? (
        <img
          src={avatar}
          alt={displayName}
          className="h-9 w-9 rounded-full object-cover ring-1"
          style={{ outline: "1px solid rgba(217, 119, 87, 0.45)", outlineOffset: 1 }}
        />
      ) : (
        <div
          aria-hidden
          className="h-9 w-9 rounded-full ring-1 ring-border flex items-center justify-center text-[11px] font-semibold tracking-wider"
          style={{
            background:
              "linear-gradient(135deg, rgba(217, 119, 87, 0.28), rgba(167, 139, 250, 0.22))",
            color: "rgba(255, 255, 255, 0.92)",
            boxShadow: "inset 0 0 0 1px rgba(255, 255, 255, 0.06)",
          }}
        >
          {initials}
        </div>
      )}
      <div className="flex flex-col leading-tight min-w-0">
        <span className="text-[12.5px] font-semibold tracking-tight truncate">{displayName}</span>
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
          local
        </span>
      </div>
    </div>
  );
}

// Primary = core operator surfaces (home + orchestration/workforce).
const primary = [
  { to: "/", label: "Home", icon: Home },
  { to: "/activity", label: "Activity", icon: Activity },
  { to: "/replay", label: "Workforce Replay", icon: Play },
  { to: "/kanban", label: "Kanban", icon: LayoutDashboard },
  { to: "/kanban-gallery", label: "Self-Driving Kanban", icon: LayoutDashboard },
  { to: "/mission-control", label: "Mission Control", icon: Rocket },
  { to: "/flight-deck", label: "Flight Deck", icon: Cpu },
  { to: "/runtime-registry", label: "Runtime Registry", icon: Layers },
  { to: "/approvals", label: "Approvals", icon: SettingsIcon },
  { to: "/personas", label: "Employee Personas", icon: UsersIcon },
  { to: "/org-chart", label: "AI Org Chart", icon: Network },
  { to: "/production-unlock", label: "Production Unlock", icon: Rocket },
];

// Personal = ONLY Goals, Journal, Notes (per Walt's nav rule). Everything that
// used to live here was utilitarian, not personal — moved to Tools / Primary.
const personal = [
  { to: "/goals", label: "Goals", icon: Target },
  { to: "/journal", label: "Journal", icon: BookOpen },
  { to: "/notes", label: "Notes", icon: StickyNote },
];

// Tools = utilities, knowledge stores, skills, and creative/runtime utilities.
const tools = [
  { to: "/skills", label: "Skills", icon: Sparkles },
  { to: "/imported-skills", label: "Imported Skills", icon: Sparkles },
  { to: "/documents", label: "Documents", icon: FolderOpen },
  { to: "/library", label: "Library", icon: BookMarked },
  { to: "/memory", label: "Memory", icon: Brain },
  { to: "/graphify", label: "Graphify", icon: Network },
  { to: "/notion", label: "Notion", icon: Database },
  { to: "/pinecone", label: "Pinecone", icon: Database },
  { to: "/seo", label: "SEO", icon: Globe },
  { to: "/notebook", label: "Notebook", icon: BookText },
  { to: "/prompts", label: "Prompts", icon: Zap },
  { to: "/search-chats", label: "Search Chats", icon: Search },
  { to: "/guide", label: "Guide", icon: BookMarked },
  { to: "/studio", label: "Studio", icon: Wand2 },
  { to: "/higgsfield", label: "Higgsfield", icon: ImageIcon },
  { to: "/hyperedit", label: "HyperEdit", icon: Film },
  { to: "/video-studio", label: "Video Studio", icon: Film },
  { to: "/cli", label: "CLI-Anything", icon: Terminal },
  { to: "/understand", label: "Understand", icon: BookOpen },
  { to: "/wacrm", label: "WACRM", icon: MessageCircle },
  { to: "/maestro", label: "Maestro", icon: Network },
  { to: "/browser", label: "Browser-Use", icon: Globe },
  { to: "/triad", label: "Triad Council", icon: Crown },
  { to: "/hermes-mcp-loop", label: "Hermes MCP Loop", icon: Crown },
];

// Agents section — uniform row format matching Operator / Personal / Tools.
// Icon + label only, no oversized brand tiles. Tone color tints the icon
// on hover/active so the agent identity still reads.
const agents = [
  { to: "/agents/slim-charles", label: "Slim Charles", icon: Sparkles, tone: "#38BDF8" },
  { to: "/agents/hermes", label: "Hermes Agent", icon: Crown, tone: "#FFD21E" },
  { to: "/agents/openclaw", label: "OpenClaw", icon: Box, tone: "#EF4444" },
  { to: "/agents/gemini", label: "Gemini Flash", icon: Diamond, tone: "#4F8EF7" },
  { to: "/agents/free-claude", label: "Coding Agent", icon: Terminal, tone: "#10B981" },
  { to: "/agents/antigravity", label: "Antigravity", icon: Rocket, tone: "#3B82F6" },
  { to: "/agents/ruflo", label: "Ruflo", icon: Network, tone: "#6366F1" },
  { to: "/agents/hermes-mcp", label: "Hermes MCP", icon: Cpu, tone: "#06B6D4" },
  { to: "/agents/codex", label: "Codex AI", icon: Code2, tone: "#22c55e" },
  { to: "/claudeclaw", label: "Claude Code", icon: Wand2, tone: "#D97757" },
  { to: "/agents/notebooklm", label: "NotebookLM", icon: BookText, tone: "#A78BFA" },
];

const SIDEBAR_COLLAPSE_KEY = "baseline-os.sidebar.collapsed.v1";

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));

  // Collapsible sections (parity with Mission Control) — persisted to localStorage.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try {
      const s = JSON.parse(window.localStorage.getItem(SIDEBAR_COLLAPSE_KEY) || "{}");
      if (s && typeof s === "object") setCollapsed(s);
    } catch {
      /* default expanded */
    }
  }, []);
  const toggleSection = (key: string) =>
    setCollapsed((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSE_KEY, JSON.stringify(next));
      } catch {
        /* quota */
      }
      return next;
    });

  type NavItem = { to: string; label: string; icon: typeof Home; tone?: string };
  const NavLink = ({ item }: { item: NavItem }) => {
    const active = isActive(item.to);
    return (
      <Link
        to={item.to}
        className={cn(
          "relative flex items-center gap-3 rounded-md px-2.5 py-2 text-[13px] transition-colors",
          active
            ? "text-foreground font-medium bg-accent/80"
            : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
        )}
      >
        {active && (
          <span
            aria-hidden
            className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r-full"
            style={{
              background: "linear-gradient(180deg, #C9A227, #E6C35C)",
              boxShadow: "0 0 8px rgba(201,162,39,0.55)",
            }}
          />
        )}
        <item.icon className="h-4 w-4 shrink-0" style={{ color: active ? item.tone : undefined }} />
        {item.label}
      </Link>
    );
  };
  const Section = ({ k, label, items }: { k: string; label: string; items: NavItem[] }) => {
    const isCollapsed = !!collapsed[k];
    return (
      <div data-testid={`sidebar-section-${k}`}>
        <button
          onClick={() => toggleSection(k)}
          aria-expanded={!isCollapsed}
          data-testid={`sidebar-section-toggle-${k}`}
          className="mt-3 flex w-full items-center justify-between px-2.5 pb-1 text-[9px] uppercase tracking-[0.2em] text-muted-foreground/70 hover:text-foreground"
        >
          <span>{label}</span>
          <ChevronDown
            className={cn("h-3 w-3 transition-transform", isCollapsed && "-rotate-90")}
          />
        </button>
        {!isCollapsed && (
          <div className="space-y-0.5">
            {items.map((item) => (
              <NavLink key={item.to} item={item} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-border bg-sidebar sticky top-0 h-screen self-start overflow-y-auto">
      {/* Brand mark — Claude logo with a soft orange halo so it reads as
          the primary identity and not just another tile. */}
      <div className="flex h-14 items-center gap-2.5 px-5">
        <div
          className="relative flex h-9 w-9 items-center justify-center rounded-xl overflow-hidden shrink-0"
          style={{
            boxShadow:
              "inset 0 1px 0 rgba(255, 255, 255, 0.18), 0 6px 18px -8px rgba(251, 191, 36, 0.55)",
          }}
        >
          <img src={baselineLogo} alt="Baseline" className="h-9 w-9 object-contain" />
        </div>
        <div className="flex flex-col leading-tight min-w-0">
          <span className="text-[12.5px] font-semibold tracking-tight">Baseline Automations</span>
          <span className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/70">
            Operator
          </span>
        </div>
      </div>

      <nav className="flex-1 px-3 pt-1 space-y-0.5">
        <Section k="operator" label="Operator" items={primary as NavItem[]} />
        <Section k="personal" label="Personal" items={personal as NavItem[]} />
        <Section k="tools" label="Tools" items={tools as NavItem[]} />
        <Section k="agents" label="Agents" items={agents as NavItem[]} />
      </nav>

      <div className="px-3 pb-3 space-y-1">
        <div className="h-px bg-border mb-2" />
        <Link
          to="/settings/api-keys"
          data-testid="sidebar-api-keys"
          className={cn(
            "flex items-center gap-3 rounded-md px-2.5 py-2 text-[13px] transition-colors",
            isActive("/settings/api-keys") || isActive("/admin")
              ? "bg-accent text-foreground font-medium"
              : "text-muted-foreground/70 hover:text-foreground hover:bg-accent/50",
          )}
        >
          <SettingsIcon className="h-4 w-4 shrink-0" />
          API Keys
        </Link>
        <Link
          to="/settings"
          className={cn(
            "flex items-center gap-3 rounded-md px-2.5 py-2 text-[13px] transition-colors",
            isActive("/settings") && !isActive("/settings/api-keys")
              ? "bg-accent text-foreground font-medium"
              : "text-muted-foreground/70 hover:text-foreground hover:bg-accent/50",
          )}
        >
          <SettingsIcon className="h-4 w-4 shrink-0" />
          Settings
        </Link>
      </div>

      <div className="border-t border-border px-4 py-3">
        <SidebarIdentity />
      </div>
    </aside>
  );
}
