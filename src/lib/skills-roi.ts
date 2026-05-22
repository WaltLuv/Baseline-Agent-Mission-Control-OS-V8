/**
 * Skills ROI Calculator — Measures return-on-investment for Mission Control skills.
 *
 * Each skill invocation is assumed to save ~15 minutes of human labor.
 * Labor is valued at $60/hr. AI cost is creditsUsed * $0.01 per credit.
 *
 * ROI formula: (laborValueSaved - aiCostCents) / aiCostCents * 100
 *
 * Graceful degradation: if usage_events or credit_ledger tables are missing,
 * returns zeroed metrics rather than throwing.
 */

import { getDatabase } from '@/lib/db'

export interface SkillROI {
  skillName: string
  invocations: number
  estimatedMinutesSaved: number
  laborValueSaved: number
  creditsUsed: number
  aiCostCents: number
  netSavings: number
  roiPercent: number
}

const MINUTES_PER_INVOCATION = 15
const HOURLY_RATE_USD = 60
const CREDIT_COST_USD = 0.01

/**
 * Calculate ROI for a single skill by its name.
 * Queries usage_events for invocations and credit_ledger for credits consumed.
 */
export function getSkillROI(skillName: string): SkillROI {
  const db = getDatabase()

  // Check if required tables exist
  const usageEventsExists = checkTableExists(db, 'usage_events')
  const creditLedgerExists = checkTableExists(db, 'credit_ledger')

  let invocations = 0
  let creditsUsed = 0

  // Count invocations from usage_events where event_type matches the skill
  if (usageEventsExists) {
    // Check if skill_name column exists, otherwise fall back to metadata_json search
    const colInfo = db.prepare(`PRAGMA table_info(usage_events)`).all() as Array<{ name: string }>
    const hasSkillName = colInfo.some((c) => c.name === 'skill_name')
    const hasEventType = colInfo.some((c) => c.name === 'event_type')

    if (hasSkillName) {
      const row = db.prepare(
        `SELECT COUNT(*) as count FROM usage_events WHERE skill_name = ?`
      ).get(skillName) as { count: number }
      invocations = row?.count ?? 0
    } else if (hasEventType) {
      // Fallback: try matching event_type
      const row = db.prepare(
        `SELECT COUNT(*) as count FROM usage_events WHERE event_type LIKE ?`
      ).get(`%${skillName}%`) as { count: number }
      invocations = row?.count ?? 0
    }
  }

  // Sum credits used from credit_ledger
  if (creditLedgerExists && invocations > 0) {
    const colInfo = db.prepare(`PRAGMA table_info(credit_ledger)`).all() as Array<{ name: string }>
    const hasSourceType = colInfo.some((c) => c.name === 'source_type')
    const hasSourceId = colInfo.some((c) => c.name === 'source_id')
    const hasDescription = colInfo.some((c) => c.name === 'description')

    if (hasSourceType) {
      // Try matching by source_type containing the skill name
      const row = db.prepare(
        `SELECT COALESCE(SUM(ABS(amount)), 0) as total FROM credit_ledger WHERE source_type LIKE ? AND type = 'usage'`
      ).get(`%${skillName}%`) as { total: number }
      creditsUsed = row?.total ?? 0
    }

    // If no credits found via source_type, try description match
    if (creditsUsed === 0 && hasDescription) {
      const row = db.prepare(
        `SELECT COALESCE(SUM(ABS(amount)), 0) as total FROM credit_ledger WHERE description LIKE ? AND type = 'usage'`
      ).get(`%${skillName}%`) as { total: number }
      creditsUsed = row?.total ?? 0
    }
  }

  const estimatedMinutesSaved = invocations * MINUTES_PER_INVOCATION
  const laborValueSaved = (estimatedMinutesSaved / 60) * HOURLY_RATE_USD
  const aiCostCents = creditsUsed * (CREDIT_COST_USD * 100) // convert to cents
  const netSavings = laborValueSaved - (aiCostCents / 100)
  const roiPercent = aiCostCents > 0 ? ((laborValueSaved - aiCostCents / 100) / (aiCostCents / 100)) * 100 : 0

  return {
    skillName,
    invocations,
    estimatedMinutesSaved,
    laborValueSaved,
    creditsUsed,
    aiCostCents,
    netSavings,
    roiPercent,
  }
}

/**
 * Calculate ROI for all skills tracked in usage_events.
 * Returns an array of SkillROI sorted by roiPercent descending.
 */
export function getAllSkillROIs(): SkillROI[] {
  const db = getDatabase()

  const usageEventsExists = checkTableExists(db, 'usage_events')
  if (!usageEventsExists) return []

  const colInfo = db.prepare(`PRAGMA table_info(usage_events)`).all() as Array<{ name: string }>
  const hasSkillName = colInfo.some((c) => c.name === 'skill_name')
  const hasEventType = colInfo.some((c) => c.name === 'event_type')

  if (!hasSkillName && !hasEventType) return []

  // Get distinct skills
  const column = hasSkillName ? 'skill_name' : 'event_type'
  let skillNames: string[] = []

  if (hasSkillName) {
    const rows = db.prepare(
      `SELECT DISTINCT skill_name as name FROM usage_events WHERE skill_name IS NOT NULL AND skill_name != ''`
    ).all() as Array<{ name: string }>
    skillNames = rows.map((r) => r.name)
  } else if (hasEventType) {
    const rows = db.prepare(
      `SELECT DISTINCT event_type as name FROM usage_events WHERE event_type IS NOT NULL AND event_type != ''`
    ).all() as Array<{ name: string }>
    skillNames = rows.map((r) => r.name)
  }

  return skillNames
    .map((name) => getSkillROI(name))
    .filter((r) => r.invocations > 0)
    .sort((a, b) => b.roiPercent - a.roiPercent)
}

function checkTableExists(db: ReturnType<typeof getDatabase>, tableName: string): boolean {
  try {
    const row = db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name=?`
    ).get(tableName)
    return !!row
  } catch {
    return false
  }
}
