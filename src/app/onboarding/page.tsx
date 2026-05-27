"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ThemeBackground } from "@/components/ui/theme-background";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const BUSINESS_TYPES = [
  { id: "pm", name: "Property Manager", icon: "🏢", template: "pm-default" },
  { id: "gc", name: "General Contractor", icon: "🔨", template: "gc-default" },
  { id: "home-services", name: "Home Services", icon: "🔧", template: "hs-default" },
  { id: "ai-agency", name: "AI Agency / Operator", icon: "🤖", template: "ai-default" },
  { id: "real-estate", name: "Real Estate Sales Agent", icon: "🏡", template: "re-default" },
  { id: "mortgage", name: "Mortgage Broker", icon: "💰", template: "mb-default" },
];

const TEMPLATES: Record<string, { agents: string[]; skills: string[]; workflows: string[] }> = {
  "pm-default": {
    agents: ["Triage Agent", "InspectBot", "OwnerComms"],
    skills: ["maintenance-triage", "visionops-inspection", "owner-reporting", "vendor-dispatch"],
    workflows: ["Inspection → Scope → Approval", "Maintenance Intake Pipeline", "Monthly Owner Reporting"],
  },
  "gc-default": {
    agents: ["Bid Estimator", "Project Scheduler", "QC Inspector"],
    skills: ["cost-estimation", "project-scheduling", "quality-inspection", "subcontractor-matching"],
    workflows: ["Estimate → Bid → Award", "Project Progress Tracking", "Punch List Workflow"],
  },
  "hs-default": {
    agents: ["Intake Agent", "Quote Bot", "Dispatcher"],
    skills: ["lead-intake", "estimation", "scheduling", "customer-notifications"],
    workflows: ["Lead → Quote → Book", "Emergency Dispatch", "Job Completion Follow-up"],
  },
  "ai-default": {
    agents: ["Agent Manager", "QA Reviewer", "Cost Tracker"],
    skills: ["agent-orchestration", "qa-gates", "cost-tracking", "security-scan"],
    workflows: ["Agent Deployment Pipeline", "Quality Assurance Review", "Cost Optimization Loop"],
  },
  "re-default": {
    agents: ["Lead Capture Agent", "CMA Analyst", "Showing Coordinator", "Transaction Coordinator"],
    skills: [
      "lead-capture",
      "buyer-seller-intake",
      "cma-report-generator",
      "showing-scheduling",
      "offer-follow-up",
      "transaction-coordination",
      "post-close-nurture",
    ],
    workflows: [
      "New Lead → Qualify → Schedule Tour",
      "Listing Prep → CMA → Pricing Strategy",
      "Offer → Negotiation → Acceptance",
      "Under Contract → Transaction Coordinator Handoff",
      "Post-Close 30 / 60 / 90-Day Nurture",
    ],
  },
  "mb-default": {
    agents: ["Application Intake Agent", "Pre-Qual Scorer", "Doc Collection Bot", "Rate Quote Engine", "Loan Officer Assistant"],
    skills: [
      "application-intake",
      "pre-qualification-scoring",
      "document-collection-request",
      "rate-quote-comparison",
      "underwriting-status-tracker",
      "loan-officer-dashboard",
      "closing-checklist",
    ],
    workflows: [
      "Inbound Inquiry → Application Intake",
      "Pre-Qualification Score → Borrower Tier",
      "Document Collection → Verification",
      "Rate Quote Generation & Comparison",
      "Underwriting Status Updates",
      "Closing Checklist & Funding",
    ],
  },
};

export default function OnboardingWizardClient() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [workspaceName, setWorkspaceName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const bt = BUSINESS_TYPES.find((b) => b.id === businessType);
  const templateKey = bt?.template || "pm-default";
  const T = TEMPLATES[templateKey] || TEMPLATES["pm-default"];

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: workspaceName, business_type: businessType, template: templateKey }),
      });
      for (const name of T.agents) {
        await fetch("/api/agents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, status: "active", capacity: 3 }),
        });
      }
      for (const name of T.skills) {
        await fetch("/api/skills", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, installed: true }),
        });
      }
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "First AI Task — Test Run",
          description: `Welcome to Mission Control! Template: ${templateKey}`,
          status: "inbox",
          priority: "medium",
        }),
      });
      setDone(true);
    } catch (e) {
      console.error("Onboarding failed:", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <ThemeBackground />
        <div className="relative z-10 mx-auto max-w-lg rounded-2xl border border-border/50 bg-card/50 p-8 text-center backdrop-blur-sm">
          <div className="text-5xl mb-4">🚀</div>
          <h2 className="text-2xl font-bold text-foreground">Your AI Workforce is Ready</h2>
          <p className="mt-2 text-muted-foreground">Workspace <strong className="text-foreground">{workspaceName}</strong> created with {T.agents.length} agents and {T.skills.length} skills.</p>
          <div className="mt-6 space-y-3 text-left">
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <span className="text-muted-foreground">Agents:</span> <span className="text-foreground">{T.agents.join(", ")}</span>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <span className="text-muted-foreground">Skills:</span> <span className="text-foreground">{T.skills.join(", ")}</span>
            </div>
          </div>
          <div className="mt-6 flex gap-3 justify-center">
            <Button onClick={() => router.push("/app/overview")}>Open Mission Control</Button>
            <Button variant="outline" onClick={() => router.push("/app/tasks")}>View First Task</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <ThemeBackground />
      <div className="relative z-10 mx-auto max-w-2xl px-6 py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Set Up Your AI Workforce</h1>
          <p className="mt-1 text-muted-foreground">Get up and running in under 5 minutes.</p>
          <div className="mt-4 flex gap-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className={cn("h-1 flex-1 rounded-full transition-colors", s <= step ? "bg-primary" : "bg-muted")} />
            ))}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Step {step} of 3</p>
        </div>

        {step === 1 && (
          <div>
            <h2 className="text-lg font-semibold text-foreground">What is your workspace name?</h2>
            <input type="text" value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} placeholder="e.g. Acme Property Management" className="mt-4 w-full rounded-lg border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
            <div className="mt-6 flex justify-end">
              <Button disabled={!workspaceName.trim()} onClick={() => setStep(2)}>Continue</Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="text-lg font-semibold text-foreground">What type of business are you?</h2>
            <p className="mt-1 text-sm text-muted-foreground">We&apos;ll configure default agents, skills, and workflows.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {BUSINESS_TYPES.map((b) => (
                <button key={b.id} onClick={() => setBusinessType(b.id)} className={cn("flex items-center gap-3 rounded-lg border p-4 text-left transition-colors", businessType === b.id ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border/50 bg-card/30 hover:bg-card/50")}>
                  <span className="text-2xl">{b.icon}</span>
                  <span className="text-sm font-medium text-foreground">{b.name}</span>
                </button>
              ))}
            </div>
            <div className="mt-6 flex justify-between">
              <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
              <Button disabled={!businessType} onClick={() => setStep(3)}>Continue</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="text-lg font-semibold text-foreground">Review & Launch</h2>
            <div className="mt-4 rounded-lg border border-border/50 bg-card/30 p-4 space-y-3">
              <div><span className="text-xs font-medium text-muted-foreground uppercase">Workspace</span><p className="text-sm text-foreground">{workspaceName}</p></div>
              <div><span className="text-xs font-medium text-muted-foreground uppercase">Business Type</span><p className="text-sm text-foreground">{bt?.name}</p></div>
              <div><span className="text-xs font-medium text-muted-foreground uppercase">AI Agents</span><p className="text-sm text-foreground">{T.agents.join(", ")}</p></div>
              <div><span className="text-xs font-medium text-muted-foreground uppercase">Skills</span><p className="text-sm text-foreground">{T.skills.join(", ")}</p></div>
            </div>
            <div className="mt-6 flex justify-between">
              <Button variant="ghost" onClick={() => setStep(2)}>Back</Button>
              <Button disabled={isSubmitting} onClick={handleSubmit}>{isSubmitting ? "Setting up..." : "Launch AI Workforce 🚀"}</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
