import { getDatabase } from '../src/lib/db'
import { PRICING_CONFIGS_SEED, FEATURE_PRICING_DDL, FEATURE_PRICING_SEED, CREDIT_PACKAGES_SEED } from '../src/lib/pricing-seeds'

/**
 * Seeds all billing-related data: pricing configs, feature pricing, credit packages.
 * Run this after running migrations.
 * Usage: pnpm tsx scripts/seed-billing-data.ts
 */

const db = getDatabase()

console.log('Seeding billing data...')

console.log('  -> pricing_configs...')
db.exec(PRICING_CONFIGS_SEED)
console.log('    Done. ' + (db.prepare('SELECT COUNT(*) as c FROM pricing_configs').get() as any).c + ' rows')

console.log('  -> credit_feature_pricing...')
db.exec(FEATURE_PRICING_DDL)
db.exec(FEATURE_PRICING_SEED)
console.log('    Done. ' + (db.prepare('SELECT COUNT(*) as c FROM credit_feature_pricing').get() as any).c + ' rows')

console.log('  -> credit_packages...')
db.exec(CREDIT_PACKAGES_SEED)
console.log('    Done. ' + (db.prepare('SELECT COUNT(*) as c FROM credit_packages').get() as any).c + ' rows')

// Add missing columns to usage_events
const cols = db.prepare('PRAGMA table_info(usage_events)').all() as Array<{name: string}>
const colNames = cols.map(c => c.name)

function addColIfNeeded(table: string, col: string, def: string) {
  if (!colNames.includes(col)) {
    console.log('  -> Adding ' + col + ' to ' + table + '...')
    db.exec('ALTER TABLE ' + table + ' ADD COLUMN ' + col + ' ' + def)
  } else {
    console.log('  -> ' + col + ' already exists in ' + table)
  }
}

addColIfNeeded('usage_events', 'input_tokens', 'INTEGER NOT NULL DEFAULT 0')
addColIfNeeded('usage_events', 'output_tokens', 'INTEGER NOT NULL DEFAULT 0')
addColIfNeeded('usage_events', 'markup_multiplier', 'REAL NOT NULL DEFAULT 2.5')

console.log('\nAll billing data seeded successfully.')
db.close()
