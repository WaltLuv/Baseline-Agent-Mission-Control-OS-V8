# Mission Control User Guide

A complete reference for every surface in the dashboard. Same content is available in-app at **Help → User Guide**.

## A. Mission Control Basics
- **What the dashboard shows.** Overview is your morning page. Top: identity strip and Executive Briefing. Middle: AI Employees and active skills. Bottom: workforce health.
- **How to read the Executive Briefing.** It answers four questions: What happened? What needs me? What did we make? What should we do next?
- **How to use Workforce Health.** A calm signal that tells you whether your workforce is on shift, blocked, or off-shift. Drill in only when something turns yellow.
- **How to use the Activity Feed.** A live but unhurried log of what each employee is doing. Use it to audit, not to micromanage.
- **How to use the Task Board.** Drag work between Inbox, In Progress, Review, and Done.
- **How to use the Approval Queue.** Everything that needs your sign-off lands here.

## B. AI Employees
- **What an AI Employee is.** A named, persistent worker with a role, a set of skills, a memory, and a track record.
- **How to hire one.** Marketplace → choose a role → click Hire.
- **How to read its trace.** Each employee has a trace showing recent work, memory used, and outcomes.
- **What life signals mean.** Green = on shift. Amber = waiting on you or a runtime. Grey = off shift.
- **What trust trajectory means.** A rolling score from approvals, rejections, and outcomes.
- **What "working on" means.** The single most recent active task, in plain English.
- **What escalation means.** When an employee hits a question only you can answer.

## C. Skills
- **What skills are.** Reusable, named capabilities — "Send invoice", "Run payroll".
- **How to install skills.** Skills or Marketplace → Install.
- **How skills attach to employees.** Open an employee → attach skills.
- **How Skill ROI works.** Each skill earns ROI from real outcomes.
- **What active / warning / inactive mean.** Active = used. Warning = installed, no work flowing. Inactive = unused 14+ days.
- **What Proven Capability means.** A skill with more than one approved outcome.

## D. Memory
- **Operator Memory.** Private notes you make as the human in charge.
- **Business Knowledge Base.** Shared knowledge connected from Notion or Obsidian.
- **Knowledge Intelligence.** A deeper memory layer used by employees.
- **Obsidian.** Point Mission Control at your vault. Markdown becomes memory.
- **Notion.** Add an integration token; share pages.
- **Knowledge Intelligence config.** Settings → Integrations — handled server-side.
- **Citations.** Every memory-backed answer shows its source.
- **Privacy.** Operator Memory never leaves your workspace.

## E. Approvals
- **The queue.** New items at top, with what work was done and what memory was used.
- **Approve.** Confirms the output is good. Trust goes up.
- **Reject.** Marks the output as wrong. Trust goes down.
- **Request changes.** Send the work back with a note.
- **Memory rationale.** Tells you which notes or policies the employee used.
- **Effects.** Every approval, change, or rejection updates trust and ROI.

## F. Billing & Workforce Credits
- **What Workforce Credits are.** Pre-purchased credits that cover compute, model calls, and runtime time.
- **How credits are charged.** Each task, skill event, and runtime second draws a small number of credits.
- **How AI employee usage maps to billing.** Each employee has a credit footprint.
- **How skill events affect value / ROI.** Approved outcomes raise ROI; rejections lower it.
- **How to monitor cost.** Billing shows balance, recent draws, and projected runway.

## G. Runtime Connections
- **Hermes.** Native runtime for Python and JavaScript.
- **OpenClaw / Open Code.** Browser and tool runtime.
- **Claude Code.** Reporting layer for repo work.
- **Handshake.** First exchange between a runtime and Mission Control.
- **Heartbeat.** Periodic "I am alive" signal.

## H. Marketplace
- **Hire AI Employees.** Pick a role; add to roster with starter skills.
- **Install skills.** One-click install.
- **Deploy teams.** Pre-built bundles.
- **Attach skills.** Open the employee and attach.
- **Operational assets.** Every install is a real, billable asset.

## I. Security & Trust
- **Workspace isolation.** Memory, employees, skills, and approvals never cross workspaces.
- **Memory privacy.** Connectors honor source permissions. Operator Memory is private.
- **Signed share links.** External shares are signed and time-limited.
- **Audit trail.** Every approval, change, and runtime event is logged.
- **No fake live activity.** Live mode shows only real telemetry.
- **Demo vs Live.** Toggle in the header. Demo is realistic example data.
