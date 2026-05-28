/**
 * Customer-facing labels for skill slugs. Used in any component that
 * renders skills outside the DB path (e.g. demo-mode aggregation in
 * `<SkillsActiveInventory>`). Keep in sync with the override list inside
 * `lib/baseline-os/trace-derivation.ts` — single source of truth lives
 * there for server-rendered cases; this client-safe mirror avoids
 * importing the SQLite-backed module into client bundles.
 */
const OVERRIDES: Record<string, string> = {
  'document-chase': 'Missing Document Outreach',
  'sms-outbound': 'SMS Reminders',
  'email-followup': 'Email Follow-ups',
  reconciliation: 'Bookkeeping Reconciliation',
  'partner-escalation': 'Partner Escalation',
  'bank-feed-sync': 'Bank Feed Sync',
  'category-mapping': 'Transaction Categorisation',
  'client-survey': 'Client NPS Survey',
  'intake-form': 'Client Intake',
  'conflict-search': 'Conflict-of-Interest Check',
  'document-summary': 'Document Summarisation',
  'matter-tagging': 'Matter Tagging',
  'matter-update-email': 'Client Status Updates',
  scheduling: 'Scheduling',
  'advertising-rules': 'Compliance Watch',
  'fee-agreement-review': 'Fee-Agreement Review',
  'priority-triage': 'Maintenance Triage',
  'photo-evidence': 'Photo Evidence Capture',
  'tenant-comms': 'Tenant Communications',
  'vendor-routing': 'Vendor Routing',
  'cost-validation': 'Cost Validation',
  'statement-generation': 'Owner Statement Generation',
  'photo-attach': 'Photo Attachment',
  'tour-scheduling': 'Tour Scheduling',
  'application-review': 'Application Review',
}

export function customerSkillLabel(slug: string): string {
  if (OVERRIDES[slug]) return OVERRIDES[slug]
  return slug
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
