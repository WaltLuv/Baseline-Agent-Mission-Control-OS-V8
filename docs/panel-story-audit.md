# Panel Story Audit — Mission Control v3

> Standard: every customer-facing panel must answer three questions for a non-technical business owner in the first 10 seconds:
> 1. **What am I looking at?** → Plain-English title + subtitle.
> 2. **Why does it matter to me?** → Story sentence, in business terms (time saved, money saved, risk reduced, faster response, better visibility, better accountability).
> 3. **What should I do next?** → A recommended action.

Use `@/components/panels/_story-header.tsx` (exports `PanelStoryHeader` and `PanelEmptyState`).

## Status legend
- ✅ Story header + empty state landed in this pass.
- 📝 Audit recorded; copy/wireframe ready; implementation deferred.
- ⛔ Internal/dev-only panel; no customer-facing story header needed.

## Audit

| # | Panel | Status | Story | Customer value | Next action | Notes |
|---|-------|--------|-------|----------------|-------------|-------|
| 1 | billing-panel | ✅ | "Track Workforce Credits, work completed, and labor value saved." | Visibility + money | Top Up / Enable Auto-Reload | Fuel meter + health score + margin + usage timeline + autoreload + explainer + test-mode banner. |
| 2 | activity-feed-panel | ✅ | "Live stream of every action your AI workforce takes." | Visibility + trust | Filter to attention items | Story header added. |
| 3 | agent-squad-panel | ✅ | "Your AI workforce — every employee, their role, and current workload." | Workforce mgmt | Hire more AI employees | Story header added. |
| 4 | cost-tracker-panel | ✅ | "Cost vs labor value saved, by AI employee and by workflow." | ROI clarity | Open Billing | Story header added. |
| 5 | security-audit-panel | ✅ | "Security posture and recent AI actions flagged for review." | Safety + accountability | Investigate flagged item | Story header added. |
| 6 | audit-trail-panel | 📝 | "Who did what and why — every AI action with evidence." | Trust + compliance | Export weekly audit | Pattern same as security-audit. |
| 7 | exec-approval-panel | 📝 | "AI actions waiting on your approval before they go live." | Accountability | Approve / Reject | Surface ROI/risk per item. |
| 8 | activity-feed-panel | (see #2) | — | — | — | — |
| 9 | tasks / kanban | 📝 | "Work flowing through your AI workforce." | Visibility | Drag stuck task → Done | Apply on kanban-board wrapper. |
| 10 | agent-comms-panel | 📝 | "Conversations between AI employees and people." | Visibility | Open thread | — |
| 11 | agent-detail-tabs | 📝 | "Performance, history, and skills for one AI employee." | Mgmt | Adjust capacity | — |
| 12 | agent-history-panel | 📝 | "Everything one AI employee has done, with credit cost." | Audit | Replay session | — |
| 13 | alert-rules-panel | 📝 | "Tell us when to interrupt you — by event, severity, channel." | Accountability | Add rule | — |
| 14 | channels-panel | 📝 | "Where your AI workforce talks: Slack, SMS, email, webhooks." | Reach | Connect channel | — |
| 15 | chat-page-panel | 📝 | "Conversational interface to your AI workforce." | Speed | Send instruction | — |
| 16 | cron-management-panel | 📝 | "Scheduled work — what runs, when, and last status." | Reliability | Pause job | — |
| 17 | daily-optimization-panel | 📝 | "Today's optimization recommendations: cheaper models, better routes." | Cost | Apply optimization | — |
| 18 | debug-panel | ⛔ | Internal dev | — | — | No story header. |
| 19 | documents-panel | 📝 | "Files your AI workforce can read and reference." | Knowledge | Upload doc | — |
| 20 | gateway-config-panel | ⛔ | Internal | — | — | — |
| 21 | gateway-control-panel | ⛔ | Internal | — | — | — |
| 22 | github-sync-panel | 📝 | "Two-way sync between your dev backlog and AI tasks." | Throughput | Connect repo | — |
| 23 | integrations-panel | 📝 | "What your AI workforce is plugged into." | Reach | Add integration | — |
| 24 | local-agents-doc-panel | ⛔ | Internal | — | — | — |
| 25 | log-viewer-panel | ⛔ | Internal | — | — | — |
| 26 | memory-browser-panel | 📝 | "What your AI workforce knows about your business." | Knowledge | Add fact | "Business Knowledge" copy. |
| 27 | memory-graph | 📝 | "How your business knowledge connects." | Visibility | Open node | — |
| 28 | multi-gateway-panel | ⛔ | Internal | — | — | — |
| 29 | nodes-panel | ⛔ | Internal | — | — | — |
| 30 | notifications-panel | 📝 | "Heads-up alerts from your AI workforce." | Speed | Snooze / Acknowledge | — |
| 31 | office-panel | 📝 | "Live floor view of who's working on what." | Visibility | Reassign | — |
| 32 | orchestration-bar | 📝 | "Workflow management — chains of AI actions." | Speed | Add workflow | "Workflow Management" copy. |
| 33 | pipeline-tab | (see #32) | — | — | — | — |
| 34 | scanner-panel | 📝 | "Security scan of every skill before it runs." | Safety | Approve / Quarantine | — |
| 35 | session-details-panel | 📝 | "One conversation — what the AI did, what it cost, and why." | Trust | Open replay | — |
| 36 | settings-panel | ⛔ | Configuration | — | — | — |
| 37 | skills-panel | 📝 | "Capabilities installed for your AI workforce." | Reach | Install skill | "Capabilities" copy. |
| 38 | skills-roi-card | (sub-component) | — | — | — | Already business-framed. |
| 39 | standup-panel | 📝 | "Yesterday / today / blockers — auto-generated from AI workforce activity." | Speed | Share | — |
| 40 | super-admin-panel | ⛔ | Multi-tenant ops | — | — | — |

## Implementation plan

This pass landed the standard + headers on the **highest-traffic five panels** (billing, activity, agent-squad, cost-tracker, security-audit). The remaining panels each get the same pattern in the next pass — the work is mechanical and bounded.
