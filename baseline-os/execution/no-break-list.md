# Do-Not-Break List — Operator Standing Orders

> Quick-reference extract from `architecture/cycle-2026-06-backlog-of-7.md` §3.
> If a planned change risks breaking any line below, **pause and confirm** before shipping.

---

## Truth standard
- [ ] No fake connected states.
- [ ] No fake tool execution.
- [ ] No fake agents / skills / data.
- [ ] Every "needs setup" surface shows the actual setup command, not a placeholder.
- [ ] No real customer data in any demo.

## Contracts that must keep working
- [ ] Mission Control sync
- [ ] Daily Brief producer (`mc daily-brief`, `/api/daily-brief`)
- [ ] ROI producer (`mc roi`, `/api/roi`)
- [ ] Runtime Registry
- [ ] Tool Registry
- [ ] Approval Engine (4-tier LOW/MEDIUM/HIGH/BLOCKED)
- [ ] Workforce Router
- [ ] CLI Registry (`mc help` listing + every existing subcommand)
- [ ] Property Management Workforce installer (`/api/workforces` shape)

## Banned concepts
- [ ] No Aion UI anywhere.
- [ ] No `/agentic-os` page anywhere.
- [ ] No re-introduction of the "Mission Control App" Aion concept.

## Ownership boundary
- **Baseline OS owns:** runtime execution, CLI execution, router logic, tool
  registry execution, approval engine logic, Daily Brief producer, ROI
  producer, shared memory logic, agent skill access, local runtime commands.
- **Mission Control owns:** UI pages, customer-facing control surfaces,
  dashboards, proof displays, approval views, task views, skill views, document
  views, runtime views, embedded/linked tools, production launcher views.

A change in the wrong repo is a violation even if it works.
