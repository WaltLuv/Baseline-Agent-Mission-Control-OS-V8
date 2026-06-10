/**
 * Interactive Workforce OS Console — directive model (Baseline OS).
 *
 * Mirrors the Mission Control directive model so both apps carry the same 13
 * console directives (3 general builder + 6 industry workforce + 4 ops). The
 * 3 general directives are hand-authored sims in the landing component; the
 * other 10 are generated from this model.
 *
 * TRUTH-FIRST: these are SIMULATIONS/DEMOS. No live work runs. The fields
 * (directiveId, verticalId, agentMap, steps, humanGates, proofSummary,
 * ctaRoute, templateSlug) are shaped so a sim can later become a real workflow.
 */
export type DirectiveGroup = "general" | "industry" | "ops";

export interface ConsoleDirective {
  directiveId: string;
  group: DirectiveGroup;
  label: string;
  description: string;
  verticalId: string | null;
  templateSlug: string | null;
  agentMap: string[];
  steps: string[];
  humanGates: string[];
  proofSummary: string;
  ctaRoute: string;
  ctaLabel: string;
}

export const CONSOLE_DIRECTIVES: ConsoleDirective[] = [
  // ── General builder directives (hand-authored sims in the landing page) ─
  {
    directiveId: "software-release",
    group: "general",
    label: "Software Release (Code Audit & Deploy)",
    description:
      "Scan code for vulnerabilities, patch, run tests, and request deployment authorization.",
    verticalId: null,
    templateSlug: null,
    agentMap: ["Security", "Lead", "QA", "DevOps"],
    steps: [
      "Parsed directive",
      "Scanned for vulnerabilities",
      "Patched issues",
      "Ran tests",
      "Logged proof package",
    ],
    humanGates: ["Operator approval before deploy to production"],
    proofSummary: "Audit report + patch diff + test run + deploy authorization request.",
    ctaRoute: "/maestro",
    ctaLabel: "Open Orchestration",
  },
  {
    directiveId: "saas-launch",
    group: "general",
    label: "SaaS Launch Campaign",
    description: "Competitor analysis, launch copy, mock visuals, and scheduled social blasts.",
    verticalId: null,
    templateSlug: null,
    agentMap: ["Research", "Copy", "Design", "Growth"],
    steps: [
      "Parsed directive",
      "Compiled competitor analysis",
      "Drafted launch copy",
      "Generated mock visuals",
      "Logged proof package",
    ],
    humanGates: ["Approval before scheduling social blasts"],
    proofSummary: "Competitor brief + launch copy + visual mocks + schedule plan.",
    ctaRoute: "/workforce-os",
    ctaLabel: "Explore Workforce OS",
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
      "Parsed directive",
      "Crawled endpoints",
      "Assembled SWOT report",
      "Logged proof package",
    ],
    humanGates: ["Review before stakeholder notification"],
    proofSummary: "SWOT report + source list + stakeholder brief.",
    ctaRoute: "/skills",
    ctaLabel: "Browse Skills",
  },

  // ── Industry workforce directives ──────────────────────────────────
  {
    directiveId: "pm-maintenance",
    group: "industry",
    label: "Property Management: Maintenance Intake → Vendor Dispatch → Owner Approval",
    description: "Triage a maintenance request, match a vendor, and gate spend on owner approval.",
    verticalId: "property-management",
    templateSlug: "property-management",
    agentMap: [
      "Tenant Relations",
      "Maintenance Dispatcher",
      "Vendor Coordinator",
      "Owner Relations",
      "Inspections",
    ],
    steps: [
      "Received tenant maintenance request",
      "Classified urgency",
      "Matched property/lease context",
      "Checked vendor availability",
      "Drafted vendor dispatch",
      "Created owner approval checkpoint",
      "Logged proof package",
    ],
    humanGates: ["Owner approval before spend"],
    proofSummary: "Work order + vendor ETA + owner approval request + follow-up task.",
    ctaRoute: "/personas",
    ctaLabel: "Open Org Chart",
  },
  {
    directiveId: "re-new-lead",
    group: "industry",
    label: "Real Estate: New Lead → CMA Prep → Follow-Up Plan",
    description: "Capture a seller lead, prep a CMA, and assign a follow-up cadence.",
    verticalId: "real-estate",
    templateSlug: "real-estate",
    agentMap: [
      "Deal Intake",
      "Lead Follow-Up",
      "Listing Prep",
      "Transaction Coordinator",
      "Investor Deal Analyst",
    ],
    steps: [
      "Captured new seller lead",
      "Pulled property context",
      "Drafted CMA prep checklist",
      "Assigned follow-up coordinator",
      "Created offer-readiness task",
      "Logged proof package",
    ],
    humanGates: ["Agent approval before client follow-up"],
    proofSummary: "CMA checklist + comp set + follow-up plan + offer-readiness task.",
    ctaRoute: "/personas",
    ctaLabel: "Open Org Chart",
  },
  {
    directiveId: "cpa-intake",
    group: "industry",
    label: "CPA: Client Document Intake → Missing Docs Follow-Up → Deadline Tracker",
    description: "Build an intake checklist, chase missing documents, and track the deadline.",
    verticalId: "cpa",
    templateSlug: "cpa",
    agentMap: [
      "Client Intake",
      "Document Collection",
      "Tax Workflow",
      "Advisory Prep",
      "Deadline Monitor",
    ],
    steps: [
      "Created client intake checklist",
      "Detected missing W-2 and 1099",
      "Drafted missing document email",
      "Added deadline monitor",
      "Created partner review checkpoint",
      "Logged proof package",
    ],
    humanGates: ["Partner approval before tax/advisory message"],
    proofSummary: "Intake checklist + missing-docs request + deadline tracker.",
    ctaRoute: "/personas",
    ctaLabel: "Open Org Chart",
  },
  {
    directiveId: "mktg-campaign",
    group: "industry",
    label: "Marketing Agency: Campaign Brief → Content Calendar → Client Approval Queue",
    description:
      "Parse a brief, build a content calendar, and route deliverables for client approval.",
    verticalId: "marketing-agency",
    templateSlug: "marketing-agency",
    agentMap: [
      "Client Intake Strategist",
      "Campaign Planner",
      "Content Calendar Manager",
      "SEO Analyst",
      "Reporting Coordinator",
    ],
    steps: [
      "Parsed campaign brief",
      "Generated content calendar outline",
      "Drafted SEO keyword cluster",
      "Created client approval checkpoint",
      "Logged proof package",
    ],
    humanGates: ["Client approval before publishing"],
    proofSummary: "Campaign brief + content calendar + keyword cluster + approval queue.",
    ctaRoute: "/seo",
    ctaLabel: "Open SEO",
  },
  {
    directiveId: "hs-service",
    group: "industry",
    label: "Home Services: Service Request → Technician Dispatch → Review Request",
    description: "Triage a service request, dispatch a technician, and queue a review request.",
    verticalId: "home-services",
    templateSlug: "home-services",
    agentMap: [
      "Service Intake",
      "Technician Scheduler",
      "Estimate Follow-Up",
      "Review Coordinator",
      "Warranty Follow-Up",
    ],
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
    proofSummary: "Service ticket + technician dispatch + appointment + review request.",
    ctaRoute: "/personas",
    ctaLabel: "Open Org Chart",
  },
  {
    directiveId: "gc-bid",
    group: "industry",
    label:
      "General Contractor: Bid Intake → Estimate Prep → Subcontractor Follow-Up → Change Order Gate",
    description:
      "Intake a bid, prep an estimate, chase subcontractor bids, and gate change orders on approval.",
    verticalId: "general-contractor",
    templateSlug: "general-contractor",
    agentMap: [
      "Bid Intake Coordinator",
      "Estimating Assistant",
      "Subcontractor Coordinator",
      "Project Schedule Manager",
      "Change Order Tracker",
      "Client Update Specialist",
    ],
    steps: [
      "Received new bid request",
      "Parsed scope and trades",
      "Created estimating checklist",
      "Drafted subcontractor bid requests",
      "Added material quote tracker",
      "Triggered change-order approval gate",
      "Logged proof package",
    ],
    humanGates: [
      "Owner/PM approval before sending estimate, change order, or subcontractor commitment",
    ],
    proofSummary:
      "Estimate checklist + subcontractor bid requests + material quote tracker + schedule placeholder.",
    ctaRoute: "/personas",
    ctaLabel: "Open Org Chart",
  },

  // ── Ops simulation directives (VisionOps / VoiceOps / PropControl / Swarm) ─
  {
    directiveId: "visionops",
    group: "ops",
    label: "VisionOps: Field Media → AI Inspection → Owner-Ready Proof",
    description:
      "Review uploaded photos/videos, identify field issues, generate inspection notes, and package visual proof for review.",
    verticalId: null,
    templateSlug: null,
    agentMap: [
      "Vision Intake",
      "Image Analyst",
      "Inspection Writer",
      "Proof Packager",
      "Approval Coordinator",
    ],
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
    proofSummary: "Inspection notes + annotated media + visual proof package for owner review.",
    ctaRoute: "/documents",
    ctaLabel: "Open Asset Library",
  },
  {
    directiveId: "voiceops",
    group: "ops",
    label: "VoiceOps: Inbound Call → Intent Detection → Dispatch/Escalation",
    description:
      "Simulate an AI voice intake call that identifies intent, verifies context, and routes maintenance, leasing, support, or emergency requests.",
    verticalId: null,
    templateSlug: null,
    agentMap: [
      "Voice Intake",
      "Intent Detector",
      "Identity Verifier",
      "Emergency Router",
      "Dispatcher",
    ],
    steps: [
      "Received inbound call",
      "Detected caller intent",
      "Verified caller/property context",
      "Classified urgency",
      "Created maintenance/support/leasing task",
      "Escalated emergency path if needed",
      "Logged proof package",
    ],
    humanGates: [
      "Human approval before emergency transfer, external dispatch, or customer-facing follow-up",
    ],
    proofSummary: "Call transcript + detected intent + routed task + escalation decision log.",
    ctaRoute: "/maestro",
    ctaLabel: "Open Orchestration",
  },
  {
    directiveId: "propcontrol",
    group: "ops",
    label: "PropControl: Maintenance Signal → Work Order → Owner Approval",
    description:
      "Convert a property issue into a tracked work order, assign the right operator/vendor, and gate owner approval before spend.",
    verticalId: "property-management",
    templateSlug: "property-management",
    agentMap: [
      "Property Context",
      "Work Order Manager",
      "Vendor Matcher",
      "Owner Approval",
      "Follow-Up Tracker",
    ],
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
    proofSummary: "Work order + vendor match + owner approval request + follow-up reminder.",
    ctaRoute: "/personas",
    ctaLabel: "Open Org Chart",
  },
  {
    directiveId: "market-swarm",
    group: "ops",
    label: "PropControl Market Swarm: 100 Kimi Agents → Distressed Property Leads",
    description:
      "Coordinate a 100-agent property research swarm of Kimi 2.5 scout agents to search for distressed properties, motivated sellers, off-market leads, or any property lead type the user requests.",
    verticalId: "property-management",
    templateSlug: "property-management",
    agentMap: [
      "Swarm Commander",
      "Kimi Scout Agents",
      "Lead Verifier",
      "Property Research Analyst",
      "Deal Scoring Analyst",
      "CRM Export Coordinator",
    ],
    steps: [
      "Received property lead directive",
      "Split target market into micro-search zones",
      "Dispatched 100 Kimi 2.5 scout agents",
      "Queried sources for distressed properties, motivated sellers, and off-market leads",
      "Deduped candidate leads",
      "Scored distress/motivation indicators (lead scoring)",
      "Flagged highest-probability opportunities",
      "Prepared CRM/export packet",
      "Routed approval before outreach",
      "Logged proof package",
    ],
    humanGates: [
      "Human approval before outreach, skip tracing, paid data spend, CRM export, or contacting property owners",
    ],
    proofSummary:
      "Deduped + scored distressed/motivated-seller/off-market lead set + CRM export packet (approval-gated before outreach/spend).",
    ctaRoute: "/maestro",
    ctaLabel: "Open Orchestration",
  },
];

export function getDirective(id: string): ConsoleDirective | undefined {
  return CONSOLE_DIRECTIVES.find((d) => d.directiveId === id);
}

export function directivesByGroup(group: DirectiveGroup): ConsoleDirective[] {
  return CONSOLE_DIRECTIVES.filter((d) => d.group === group);
}
