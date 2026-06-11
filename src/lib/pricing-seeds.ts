/**
 * Pricing seed data - fills pricing_configs with real provider costs and 2.5x markup.
 * Seeds credit_feature_pricing for action-level pricing.
 * Corrects credit_packages to match PDF launch prices.
 */

export const PRICING_CONFIGS_SEED = `
INSERT OR IGNORE INTO pricing_configs (event_type, provider, model, wholesale_cost_cents, retail_cost_cents, credits_required, status, created_at, updated_at)
VALUES
  ('llm_inference', 'openrouter', 'anthropic/claude-opus-4-8', 1500, 3750, 38, 'active', unixepoch(), unixepoch()),
  ('llm_inference', 'openrouter', 'anthropic/claude-sonnet-4-6', 300, 750, 8, 'active', unixepoch(), unixepoch()),
  ('llm_inference', 'openrouter', 'anthropic/claude-haiku-4-5', 80, 200, 3, 'active', unixepoch(), unixepoch()),
  ('llm_inference', 'openrouter', 'openai/gpt-5.5', 250, 625, 7, 'active', unixepoch(), unixepoch()),
  ('llm_inference', 'openrouter', 'google/gemini-3.5-flash', 15, 38, 1, 'active', unixepoch(), unixepoch()),
  ('llm_inference', 'openrouter', 'qwen/qwen-3.7', 20, 50, 1, 'active', unixepoch(), unixepoch()),
  ('tts_generation', 'elevenlabs', 'default', 500, 1250, 13, 'active', unixepoch(), unixepoch()),
  ('voice_transcription', 'groq', 'whisper', 50, 125, 2, 'active', unixepoch(), unixepoch()),
  ('image_generation', 'fal', 'default', 400, 1000, 10, 'active', unixepoch(), unixepoch()),
  ('places_api', 'google', 'places', 400, 1000, 10, 'active', unixepoch(), unixepoch()),
  ('sms_send', 'twilio', 'sms_outbound', 7, 18, 1, 'active', unixepoch(), unixepoch()),
  ('bot_turn', 'telegram', 'default', 3, 8, 1, 'active', unixepoch(), unixepoch()),
  ('rent_estimate', 'rentcast', 'default', 20, 50, 1, 'active', unixepoch(), unixepoch()),
  ('default', 'default', 'default', 500, 1250, 13, 'active', unixepoch(), unixepoch());
`

export const FEATURE_PRICING_DDL = `
CREATE TABLE IF NOT EXISTS credit_feature_pricing (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  feature_name TEXT NOT NULL,
  variant TEXT NOT NULL DEFAULT 'standard',
  credits INTEGER NOT NULL,
  charge_unit TEXT NOT NULL,
  min_charge INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_cfp_feature ON credit_feature_pricing(feature_name);
CREATE INDEX IF NOT EXISTS idx_cfp_variant ON credit_feature_pricing(variant);
CREATE INDEX IF NOT EXISTS idx_cfp_active ON credit_feature_pricing(feature_name, variant, active);
`

export const FEATURE_PRICING_SEED = `
INSERT OR IGNORE INTO credit_feature_pricing (feature_name, variant, credits, charge_unit, min_charge, active, created_at, updated_at)
VALUES
  ('Rent Estimate', 'standard', 8, 'per_property', 8, 1, unixepoch(), unixepoch()),
  ('Appraisal Report', 'standard', 35, 'per_report', 35, 1, unixepoch(), unixepoch()),
  ('Comps Explorer Run', 'standard', 12, 'per_run', 12, 1, unixepoch(), unixepoch()),
  ('Vision SOW Generator', 'standard', 18, 'per_run', 18, 1, unixepoch(), unixepoch()),
  ('Market Swarm Run', 'standard', 40, 'per_run', 40, 1, unixepoch(), unixepoch()),
  ('Vendor Swarm Run', 'standard', 30, 'per_run', 30, 1, unixepoch(), unixepoch()),
  ('Telegram Bot Turn', 'standard', 3, 'per_turn', 3, 1, unixepoch(), unixepoch()),
  ('SMS Send', 'standard', 2, 'per_message', 2, 1, unixepoch(), unixepoch()),
  ('AI Scripts Generator', 'standard', 10, 'per_set', 10, 1, unixepoch(), unixepoch()),
  ('Agent Session', 'standard', 1, 'per_1k_tokens', 5, 1, unixepoch(), unixepoch()),
  ('Image Generation', 'standard', 10, 'per_image', 10, 1, unixepoch(), unixepoch()),
  ('AI Interior Design', 'standard', 16, 'per_room', 16, 1, unixepoch(), unixepoch());
`

export const CREDIT_PACKAGES_SEED = `
DELETE FROM credit_packages WHERE id >= 1;
INSERT INTO credit_packages (id, name, description, price_cents, credits, bonus_credits, status, created_at, updated_at)
VALUES
  (1, 'Starter',    '1,000 credits',                          1000,  1000,    0, 'active', unixepoch(), unixepoch()),
  (2, 'Power',      '2,500 + 250 bonus = 2,750 credits',      2500,  2500,  250, 'active', unixepoch(), unixepoch()),
  (3, 'Pro',        '5,500 + 500 bonus = 6,000 credits',      5000,  5500,  500, 'active', unixepoch(), unixepoch()),
  (4, 'Enterprise', '22,500 + 2,500 bonus = 25,000 credits', 20000, 22500, 2500, 'active', unixepoch(), unixepoch());
`
