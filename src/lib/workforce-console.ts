/**
 * Interactive Workforce OS Console — directive model.
 *
 * Powers the landing-page simulation: pick a directive, watch Baseline dispatch
 * the right workforce (agent map), step through a believable orchestration log,
 * hit a human gate, and produce a proof summary + a real CTA route.
 *
 * TRUTH-FIRST: this is a SIMULATION/DEMO. It does not execute real work, create
 * customer data, or claim live agents ran. The data model is shaped so these
 * simulations can later become real workflows (the "future bridge" fields:
 * directiveId, verticalId, agentMap, steps, humanGates, toolEvents,
 * proofSummary, ctaRoute, templateSlug).
 */

export type DirectiveGroup = "general" | "industry" | "ops";

export interface ConsoleDirective {
  directiveId: string;
  group: DirectiveGroup;
  label: string;
  description: string;
  /** Vertical id for industry directives (maps to a workforce template). */
  verticalId: string | null;
  /** Workforce template slug installed by the CTA, when applicable. */
  templateSlug: string | null;
  /** Ordered agent map shown in the Agent Map panel. */
  agentMap: string[];
  /** Believable orchestration log lines (the simulation). */
  steps: string[];
  /** Human-in-the-loop gates surfaced during the run. */
  humanGates: string[];
  /** Tool/credit events for the token estimate strip. */
  toolEvents: string[];
  /** One-line proof/output summary. */
  proofSummary: string;
  /** Real in-app route the post-run CTA links to (must exist). */
  ctaRoute: string;
  ctaLabel: string;
}

export const CONSOLE_DIRECTIVES: ConsoleDirective[] = [
  // ── General builder directives (kept from the original console) ─────
  {
    directiveId: "software-release",
    group: "general",
    label: "Software Release (Code Audit & Deploy)",
    description: "Scan code for vulnerabilities, patch, run tests, and request deployment authorization.",
    verticalId: null,
    templateSlug: null,
    agentMap: ["Security", "Lead", "QA", "DevOps"],
    steps: [
      "Parsed directive: code audit & deploy",
      "Security scanned repository for vulnerabilities",
      "Lead patched 3 flagged issues",
      "QA ran the test suite (green)",
      "Created deployment authorization checkpoint",
      "Logged proof package",
    ],
    humanGates: ["Operator approval before deploy to production"],
    toolEvents: ["gh:scan", "tests:run", "git:commit"],
    proofSummary: "Audit report + patch diff + test run + deploy authorization request.",
    ctaRoute: "/app/orchestration",
    ctaLabel: "Open Orchestration",
  },
  {
    directiveId: "saas-launch",
    group: "general",
    label: "SaaS Launch Campaign",
    description: "Competitor analysis, launch copy, mock visuals, and scheduled social blasts.",
    verticalId: "ai-product-launch",
    templateSlug: "ai-product-launch",
    agentMap: ["Research", "Copy", "Design", "Growth"],
    steps: [
      "Parsed directive: SaaS launch campaign",
      "Research compiled competitor analysis",
      "Copy drafted launch announcement set",
      "Design generated mock launch visuals",
      "Created client approval checkpoint",
      "Logged proof package",
    ],
    humanGates: ["Approval before scheduling social blasts"],
    toolEvents: ["research:crawl", "image:gen", "schedule:queue"],
    proofSummary: "Competitor brief + launch copy + visual mocks + schedule plan.",
    ctaRoute: "/app/activate?template=ai-product-launch",
    ctaLabel: "Install AI Product Launch Team",
  },
  {
    directiveId: "market-intel",
    group: "general",
    label: "Competitor Market Intel",
    description: "Crawl web endpoints, build a strategic SWOT report, and notify stakeholders.",
    verticalId: null,
    templateSlug: null,
    agentMap: ["Crawler", "Analyst", "Reporter"],
    steps: [
      "Parsed directive: competitor market intel",
      "Crawler fetched target endpoints",
      "Analyst assembled SWOT report",
      "Drafted stakeholder briefing",
      "Logged proof package",
    ],
    humanGates: ["Review before stakeholder notification"],
    toolEvents: ["web:crawl", "doc:assemble"],
    proofSummary: "SWOT report + source list + stakeholder brief.",
    ctaRoute: "/marketplace",
    ctaLabel: "Browse Market-Intel Skills",
  },

  // ── Industry workforce directives ──────────────────────────────────
  {
    directiveId: "pm-maintenance",
    group: "industry",
    label: "Property Management: Maintenance Intake → Vendor Dispatch → Owner Approval",
    description: "Triage a maintenance request, match a vendor, and gate spend on owner approval.",
    verticalId: "property-management",
    templateSlug: "property-management",
    agentMap: ["Tenant Relations", "Maintenance Dispatcher", "Vendor Coordinator", "Owner Relations", "Inspections"],
    steps: [
      "Received tenant maintenance request",
      "Classified urgency as medium",
      "Matched property and lease context",
      "Checked vendor availability",
      "Drafted vendor dispatch message",
      "Created owner approval checkpoint",
      "Logged proof package",
      "Queued follow-up task",
    ],
    humanGates: ["Owner approval before spend"],
    toolEvents: ["vendor:lookup", "email:draft"],
    proofSummary: "Work order + vendor ETA + owner approval request + follow-up task.",
    ctaRoute: "/app/activate?template=property-management",
    ctaLabel: "Install Property Management Workforce",
  },
  {
    directiveId: "re-new-lead",
    group: "industry",
    label: "Real Estate: New Lead → CMA Prep → Follow-Up Plan",
    description: "Capture a seller lead, prep a CMA, and assign a follow-up cadence.",
    verticalId: "real-estate",
    templateSlug: "real-estate",
    agentMap: ["Deal Intake", "Lead Follow-Up", "Listing Prep", "Transaction Coordinator", "Investor Deal Analyst"],
    steps: [
      "Captured new seller lead",
      "Pulled property context",
      "Drafted CMA prep checklist",
      "Assigned follow-up coordinator",
      "Created offer-readiness task",
      "Logged proof package",
    ],
    humanGates: ["Agent approval before client follow-up"],
    toolEvents: ["mls:comps", "crm:create"],
    proofSummary: "CMA checklist + comp set + follow-up plan + offer-readiness task.",
    ctaRoute: "/app/activate?template=real-estate",
    ctaLabel: "Install Real Estate Workforce",
  },
  {
    directiveId: "cpa-intake",
    group: "industry",
    label: "CPA: Client Document Intake → Missing Docs Follow-Up → Deadline Tracker",
    description: "Build an intake checklist, chase missing documents, and track the deadline.",
    verticalId: "cpa",
    templateSlug: "cpa",
    agentMap: ["Client Intake", "Document Collection", "Tax Workflow", "Advisory Prep", "Deadline Monitor"],
    steps: [
      "Created client intake checklist",
      "Detected missing W-2 and 1099",
      "Drafted missing document email",
      "Added deadline monitor",
      "Created partner review checkpoint",
      "Logged proof package",
    ],
    humanGates: ["Partner approval before tax/advisory message"],
    toolEvents: ["checklist:gen", "email:draft"],
    proofSummary: "Intake checklist + missing-docs request + deadline tracker.",
    ctaRoute: "/app/activate?template=cpa",
    ctaLabel: "Install CPA Workforce",
  },
  {
    directiveId: "mktg-campaign",
    group: "industry",
    label: "Marketing Agency: Campaign Brief → Content Calendar → Client Approval Queue",
    description: "Parse a brief, build a content calendar, and route deliverables for client approval.",
    verticalId: "marketing-agency",
    templateSlug: "marketing-agency",
    agentMap: ["Client Intake Strategist", "Campaign Planner", "Content Calendar Manager", "SEO Analyst", "Reporting Coordinator"],
    steps: [
      "Parsed campaign brief",
      "Generated content calendar outline",
      "Drafted SEO keyword cluster",
      "Created client approval checkpoint",
      "Logged proof package",
    ],
    humanGates: ["Client approval before publishing"],
    toolEvents: ["seo:keywords", "calendar:build"],
    proofSummary: "Campaign brief + content calendar + keyword cluster + approval queue.",
    ctaRoute: "/app/activate?template=marketing-agency",
    ctaLabel: "Install Marketing Agency Workforce",
  },
  {
    directiveId: "hs-service",
    group: "industry",
    label: "Home Services: Service Request → Technician Dispatch → Review Request",
    description: "Triage a service request, dispatch a technician, and queue a review request.",
    verticalId: "home-services",
    templateSlug: "home-services",
    agentMap: ["Service Intake", "Technician Scheduler", "Estimate Follow-Up", "Review Coordinator", "Warranty Follow-Up"],
    steps: [
      "Received service request",
      "Classified urgency",
      "Matched technician availability",
      "Drafted appointment confirmation",
      "Created customer approval checkpoint",
      "Queued review request follow-up",
      "Logged proof package",
    ],
    humanGates: ["Customer approval before estimate acceptance"],
    toolEvents: ["dispatch:route", "sms:confirm"],
    proofSummary: "Service ticket + technician dispatch + appointment + review request.",
    ctaRoute: "/app/activate?template=home-services",
    ctaLabel: "Install Home Services Workforce",
  },
  {
    directiveId: "gc-bid",
    group: "industry",
    label: "General Contractor: Bid Intake → Estimate Prep → Subcontractor Follow-Up → Change Order Gate",
    description: "Intake a bid, prep an estimate, chase subcontractor bids, and gate change orders on approval.",
    verticalId: "general-contractor",
    templateSlug: "general-contractor",
    agentMap: ["Bid Intake Coordinator", "Estimating Assistant", "Subcontractor Coordinator", "Project Schedule Manager", "Change Order Tracker", "Client Update Specialist"],
    steps: [
      "Received new bid request",
      "Parsed scope and trade requirements",
      "Created estimating checklist",
      "Identified missing scope details",
      "Drafted subcontractor bid requests",
      "Added material quote tracker",
      "Created schedule placeholder",
      "Triggered human approval gate for change order / client-facing estimate",
      "Logged proof package",
    ],
    humanGates: ["Owner/PM approval before sending estimate, change order, or subcontractor commitment"],
    toolEvents: ["estimate:checklist", "sub:bid-request", "schedule:placeholder"],
    proofSummary: "Estimate checklist + subcontractor bid requests + material quote tracker + schedule placeholder.",
    ctaRoute: "/app/activate?template=general-contractor",
    ctaLabel: "Install General Contractor Workforce",
  },

  // ── Ops simulation directives (VisionOps / VoiceOps / PropControl / Swarm) ─
  {
    directiveId: "visionops",
    group: "ops",
    label: "VisionOps: Field Media → AI Inspection → Owner-Ready Proof",
    description: "Review uploaded photos/videos, identify field issues, generate inspection notes, and package visual proof for review.",
    verticalId: null,
    templateSlug: null,
    agentMap: ["Vision Intake", "Image Analyst", "Inspection Writer", "Proof Packager", "Approval Coordinator"],
    steps: [
      "Received field media upload",
      "Classified media type and property context",
      "Detected visible maintenance/inspection issues",
      "Drafted inspection notes",
      "Created visual proof package",
      "Routed exceptions for human review",
      "Logged proof package",
    ],
    humanGates: ["Manager approval before owner/client-facing inspection report is sent"],
    toolEvents: ["vision:classify", "vision:detect", "proof:package"],
    proofSummary: "Inspection notes + annotated media + visual proof package for owner review.",
    ctaRoute: "/app/orchestration",
    ctaLabel: "Open Orchestration",
  },
  {
    directiveId: "voiceops",
    group: "ops",
    label: "VoiceOps: Inbound Call → Intent Detection → Dispatch/Escalation",
    description: "Simulate an AI voice intake call that identifies intent, verifies context, and routes maintenance, leasing, support, or emergency requests.",
    verticalId: null,
    templateSlug: null,
    agentMap: ["Voice Intake", "Intent Detector", "Identity Verifier", "Emergency Router", "Dispatcher"],
    steps: [
      "Received inbound call",
      "Detected caller intent",
      "Verified caller/property context",
      "Classified urgency",
      "Created maintenance/support/leasing task",
      "Escalated emergency path if needed",
      "Logged proof package",
    ],
    humanGates: ["Human approval before emergency transfer, external dispatch, or customer-facing follow-up"],
    toolEvents: ["voice:transcribe", "intent:classify", "task:create"],
    proofSummary: "Call transcript + detected intent + routed task + escalation decision log.",
    ctaRoute: "/app/orchestration",
    ctaLabel: "Open Orchestration",
  },
  {
    directiveId: "propcontrol",
    group: "ops",
    label: "PropControl: Maintenance Signal → Work Order → Owner Approval",
    description: "Convert a property issue into a tracked work order, assign the right operator/vendor, and gate owner approval before spend.",
    verticalId: "property-management",
    templateSlug: "property-management",
    agentMap: ["Property Context", "Work Order Manager", "Vendor Matcher", "Owner Approval", "Follow-Up Tracker"],
    steps: [
      "Captured property issue",
      "Matched property/unit context",
      "Created work order draft",
      "Suggested vendor assignment",
      "Estimated approval threshold",
      "Routed owner approval checkpoint",
      "Queued follow-up reminder",
      "Logged proof package",
    ],
    humanGates: ["Owner approval before spend/vendor dispatch above threshold"],
    toolEvents: ["workorder:create", "vendor:match", "threshold:estimate"],
    proofSummary: "Work order + vendor match + owner approval request + follow-up reminder.",
    ctaRoute: "/app/activate?template=property-management",
    ctaLabel: "Install Property Management Workforce",
  },
  {
    directiveId: "market-swarm",
    group: "ops",
    label: "PropControl Market Swarm: 100 Kimi Agents → Distressed Property Leads",
    description: "Coordinate a 100-agent property research swarm of Kimi 2.5 scout agents to search for distressed properties, motivated sellers, off-market leads, or any property lead type the user requests.",
    verticalId: "property-management",
    templateSlug: "property-management",
    agentMap: ["Swarm Commander", "Kimi Scout Agents", "Lead Verifier", "Property Research Analyst", "Deal Scoring Analyst", "CRM Export Coordinator"],
    steps: [
      "Received property lead directive",
      "Split target market into micro-search zones",
      "Dispatched 100 Kimi 2.5 scout agents",
      "Queried public/property lead sources for distressed properties, motivated sellers, and off-market leads",
      "Deduped candidate leads",
      "Scored distress/motivation indicators (lead scoring)",
      "Flagged highest-probability opportunities",
      "Prepared CRM/export packet",
      "Routed approval before outreach",
      "Logged proof package",
    ],
    humanGates: ["Human approval before outreach, skip tracing, paid data spend, CRM export, or contacting property owners"],
    toolEvents: ["swarm:dispatch:100", "leads:dedupe", "leads:score", "crm:export"],
    proofSummary: "Deduped + scored distressed/motivated-seller/off-market lead set + CRM export packet (approval-gated before outreach/spend).",
    ctaRoute: "/app/orchestration",
    ctaLabel: "Open Orchestration",
  },
];

export function getDirective(id: string): ConsoleDirective | undefined {
  return CONSOLE_DIRECTIVES.find((d) => d.directiveId === id);
}

export function directivesByGroup(group: DirectiveGroup): ConsoleDirective[] {
  return CONSOLE_DIRECTIVES.filter((d) => d.group === group);
}

/** The 11 installable industries (hero "choose your workforce"). */
export interface IndustryTile {
  slug: string;
  label: string;
}
export const INDUSTRIES: IndustryTile[] = [
  { slug: "property-management", label: "Property Management" },
  { slug: "insurance", label: "Insurance" },
  { slug: "real-estate", label: "Real Estate" },
  { slug: "mortgage", label: "Mortgage" },
  { slug: "cpa", label: "CPA Firms" },
  { slug: "law-firm", label: "Law Firms" },
  { slug: "general-contractor", label: "General Contractors" },
  { slug: "home-services", label: "Home Services" },
  { slug: "marketing-agency", label: "Marketing Agencies" },
  { slug: "ai-agency", label: "AI Agencies" },
  { slug: "ai-product-launch", label: "AI Product Launch" },
];
