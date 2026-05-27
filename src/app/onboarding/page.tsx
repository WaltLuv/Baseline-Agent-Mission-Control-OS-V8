"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ThemeBackground } from "@/components/ui/theme-background";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BUSINESS_TEMPLATES, getBusinessTemplate } from "@/lib/business-templates";

export default function OnboardingWizardClient() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [workspaceName, setWorkspaceName] = useState("");
  const [businessTypeId, setBusinessTypeId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [provisionedEmployees, setProvisionedEmployees] = useState<string[]>([])
  const [done, setDone] = useState(false);

  const template = getBusinessTemplate(businessTypeId) || BUSINESS_TEMPLATES[0];

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: workspaceName,
          business_type: businessTypeId,
          template: template.id,
        }),
      });
      // Cinematic provisioning: stagger employee + skill creation so the
      // operator visibly sees their workforce coming online.
      for (let i = 0; i < template.aiEmployees.length; i++) {
        const name = template.aiEmployees[i]
        await fetch("/api/agents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, status: "active", capacity: 3 }),
        });
        setProvisionedEmployees((prev) => [...prev, name])
        await new Promise((r) => setTimeout(r, 350))
      }
      // Install skills.
      for (const name of template.skills) {
        await fetch("/api/skills", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, installed: true }),
        });
      }
      // Seed the starter ("first 5-minute") task. This is the "wow moment" task.
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: template.starterTaskTitle,
          description: template.starterTaskDescription,
          status: "inbox",
          priority: "high",
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
    const dollarEquiv = Math.round(template.estimatedHoursSavedPerMonth * 35);
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <ThemeBackground />
        <div className="relative z-10 mx-auto max-w-2xl rounded-2xl border border-border/50 bg-card/50 p-8 text-center backdrop-blur-sm">
          <div className="text-5xl mb-4">🚀</div>
          <h2 className="text-2xl font-bold text-foreground">Your AI Workforce is Ready</h2>
          <p className="mt-2 text-muted-foreground">
            Workspace <strong className="text-foreground">{workspaceName}</strong> just hired{" "}
            {template.aiEmployees.length} AI employees with {template.skills.length} skills installed.
          </p>

          <div className="mt-6 grid grid-cols-3 gap-3" data-testid="onboarding-wow-stats">
            <div className="rounded-lg border border-border/40 bg-muted/40 p-3">
              <div className="text-2xl font-bold text-primary">{template.estimatedHoursSavedPerMonth}h</div>
              <div className="text-xs text-muted-foreground">estimated time saved / month</div>
            </div>
            <div className="rounded-lg border border-border/40 bg-muted/40 p-3">
              <div className="text-2xl font-bold text-primary">~${dollarEquiv.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">labor-equivalent / month</div>
            </div>
            <div className="rounded-lg border border-border/40 bg-muted/40 p-3">
              <div className="text-2xl font-bold text-primary">{template.aiEmployees.length}</div>
              <div className="text-xs text-muted-foreground">AI employees on staff</div>
            </div>
          </div>

          <div className="mt-6 rounded-lg border border-primary/30 bg-primary/5 p-4 text-left">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              First 5-Minute Task (already queued)
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">{template.starterTaskTitle}</p>
            <p className="mt-1 text-xs text-muted-foreground">{template.starterTaskDescription}</p>
          </div>

          {template.complianceNote && (
            <p
              className="mt-4 rounded-md border border-border/40 bg-muted/30 p-3 text-left text-xs text-muted-foreground"
              data-testid="onboarding-compliance-note"
            >
              <strong className="text-foreground">Compliance note:</strong> {template.complianceNote}
            </p>
          )}

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <Button
              className="flex-1"
              data-testid="onboarding-open-dashboard"
              onClick={() => router.push("/")}
            >
              Open Mission Control →
            </Button>
            <Button
              className="flex-1"
              variant="outline"
              data-testid="onboarding-add-fuel"
              onClick={() => router.push("/app/billing")}
            >
              Add Credit Fuel
            </Button>
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
              <div
                key={s}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors",
                  s <= step ? "bg-primary" : "bg-muted",
                )}
              />
            ))}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Step {step} of 3</p>
        </div>

        {step === 1 && (
          <div data-testid="onboarding-step-1">
            <h2 className="text-lg font-semibold text-foreground">What is your workspace name?</h2>
            <input
              type="text"
              data-testid="onboarding-workspace-name"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              placeholder="e.g. Acme Property Management"
              className="mt-4 w-full rounded-lg border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <div className="mt-6 flex justify-end">
              <Button
                data-testid="onboarding-step-1-continue"
                disabled={!workspaceName.trim()}
                onClick={() => setStep(2)}
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div data-testid="onboarding-step-2">
            <h2 className="text-lg font-semibold text-foreground">
              What type of business are you?
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              We&apos;ll hire the right AI employees and install the right skills automatically.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {BUSINESS_TEMPLATES.map((b) => (
                <button
                  key={b.id}
                  data-testid={`onboarding-template-${b.id}`}
                  onClick={() => setBusinessTypeId(b.id)}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-4 text-left transition-colors",
                    businessTypeId === b.id
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-border/50 bg-card/30 hover:bg-card/50",
                  )}
                >
                  <span className="text-2xl">{b.icon}</span>
                  <div>
                    <div className="text-sm font-medium text-foreground">{b.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{b.tagline}</div>
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-6 flex justify-between">
              <Button variant="ghost" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button
                data-testid="onboarding-step-2-continue"
                disabled={!businessTypeId}
                onClick={() => setStep(3)}
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div data-testid="onboarding-step-3">
            <h2 className="text-lg font-semibold text-foreground">Review & Launch</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Here&apos;s your new AI workforce. Nothing happens until you launch.
            </p>

            <div
              className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-4"
              data-testid="onboarding-roi-banner"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                What this gives you
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">{template.roiMessage}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Estimated{" "}
                <span className="font-semibold text-foreground">
                  {template.estimatedHoursSavedPerMonth} hours / month
                </span>{" "}
                freed up across your team.
              </p>
            </div>

            <div className="mt-4 rounded-lg border border-border/50 bg-card/30 p-4 space-y-3">
              <div>
                <span className="text-xs font-medium text-muted-foreground uppercase">Workspace</span>
                <p className="text-sm text-foreground">{workspaceName}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-muted-foreground uppercase">Business Type</span>
                <p className="text-sm text-foreground">{template.name}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-muted-foreground uppercase">AI Employees</span>
                <p className="text-sm text-foreground">{template.aiEmployees.join(", ")}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-muted-foreground uppercase">Skills</span>
                <p className="text-sm text-foreground">{template.skills.join(", ")}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-muted-foreground uppercase">Workflows</span>
                <p className="text-sm text-foreground">{template.workflows.join(" · ")}</p>
              </div>
              <div className="rounded border border-primary/20 bg-primary/5 p-2">
                <span className="text-xs font-medium text-primary uppercase">First 5-Minute Task</span>
                <p className="text-sm text-foreground">{template.starterTaskTitle}</p>
              </div>
              {template.complianceNote && (
                <div
                  className="rounded border border-border/40 bg-muted/30 p-2"
                  data-testid="onboarding-step-3-compliance"
                >
                  <span className="text-xs font-medium text-muted-foreground uppercase">
                    Compliance
                  </span>
                  <p className="text-xs text-muted-foreground">{template.complianceNote}</p>
                </div>
              )}
            </div>
            {isSubmitting && (
              <div
                className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-4"
                data-testid="onboarding-provisioning"
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Activating your AI workforce…
                </p>
                <ul className="mt-2 space-y-1.5">
                  {template.aiEmployees.map((name) => {
                    const ready = provisionedEmployees.includes(name)
                    return (
                      <li
                        key={name}
                        className="flex items-center gap-2 text-sm text-foreground/90"
                      >
                        <span
                          className={
                            ready
                              ? 'text-emerald-400'
                              : 'inline-block animate-pulse text-muted-foreground'
                          }
                        >
                          {ready ? '✓' : '○'}
                        </span>
                        <span className={ready ? 'text-foreground' : 'text-muted-foreground'}>
                          {name}
                          {ready ? ' joined the team' : ' is coming online…'}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
            <div className="mt-6 flex justify-between">
              <Button variant="ghost" onClick={() => setStep(2)} disabled={isSubmitting}>
                Back
              </Button>
              <Button
                data-testid="onboarding-launch"
                disabled={isSubmitting}
                onClick={handleSubmit}
              >
                {isSubmitting ? "Activating workforce…" : "Launch AI Workforce 🚀"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
