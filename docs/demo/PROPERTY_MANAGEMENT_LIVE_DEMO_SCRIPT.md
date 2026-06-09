# Property Management — Live Demo Script (15 min)

**Goal:** a property manager understands the value in **< 5 minutes**, sees proof by 10, pricing by 15.
**Pre-call setup (2 min):** seeded admin account · log in · open **Maintenance** → click **✨ Demo Mode — seed data** (populates 4 work orders, 1 pending owner approval, 2 decisions, dry-run comms log, 4 replays). Optionally add Twilio/email creds to flip dry-run → live.

| Time | Beat | What you click / say |
|---|---|---|
| 0:00 | **1. Problem** | "Maintenance tickets, vendor coordination, owner approvals, leasing follow-up — all manual, all on you." |
| 1:30 | **2. Install workforce** | `/app/activate?template=property-management` → installs your AI staff in seconds. |
| 3:00 | **3. Org chart** | `/app/org-chart` → Tenant Relations · Maintenance Dispatcher · Vendor Coordinator · Owner Relations · Inspections. "That's your team, already org'd." |
| 4:00 | **4. Create maintenance request** | `/app/maintenance` → type "Water leaking under the sink in 4B" → **Run**. |
| 5:00 | **5. AI triage** | Show triage: plumbing · urgency · vendor matched · cost estimate. |
| 6:00 | **6. Vendor match** | "It picked AquaFix Plumbing and drafted the dispatch." |
| 7:00 | **7. Owner approval** | Estimate over threshold → **owner approval required**. Open `/app/approvals`. |
| 8:30 | **8. Dispatch / dry-run** | Approve → vendor dispatched (**live** if comms connected, else **dry-run** — show the exact message that would send). "Nothing happens behind your back — spend waits for the owner." |
| 10:00 | **9. Proof package** | Work order + vendor + cost + owner-approval + comms log. "Every action has a receipt." |
| 11:00 | **10. Replay** | `/app/replay` → replay the mission like a screen recording: trigger → triage → vendor → approval → dispatch. |
| 12:00 | **11. Agent Activity** | On the Maintenance page → live agents/tools/files/approvals. "No ghosts." |
| 13:00 | **12. Billing / credits** | `/app/billing` → transparent credit ledger, cost per action. |
| 14:00 | **13. Flight Deck / runtime** | `/flight-deck` → runtime health / control tower. |
| 14:30 | **14. Close** | "Installed in minutes. Approvals keep you in control. Replay + proof keep you covered. You see every cost." |

## Dry-run vs live
- **No creds:** comms log shows `dry_run` with the exact payload + the missing credential. The demo is fully functional — proof + replay are real.
- **With Twilio + email creds:** the comms checklist shows `live`; dispatch actually sends. Add creds on `/app/comms`.

## Fallback if anything is empty
Re-click **Demo Mode — seed data** to repopulate (idempotent). All four scenarios (pending approval, auto-dispatch, approved→dispatch, denied→blocked) reappear.
