#!/usr/bin/env node
/**
 * Print /app/.env in a `KEY=value\0` (NUL-separated) format that can be
 * read by the bash start script. NUL separation avoids issues with values
 * that contain newlines, spaces, or shell metacharacters.
 *
 * Usage (in bash):
 *   while IFS= read -r -d '' line; do export "$line"; done \
 *     < <(/app/.node22/bin/node /app/scripts/load-env.cjs)
 */
const fs = require('fs');
const path = require('path');

const envPath = process.argv[2] || '/app/.env';
let text;
try {
  text = fs.readFileSync(envPath, 'utf8');
} catch (err) {
  // Missing .env is fine — emit nothing.
  process.exit(0);
}

for (const raw of text.split(/\r?\n/)) {
  const line = raw.trim();
  if (!line || line.startsWith('#')) continue;
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (!m) continue;
  let v = m[2];
  // Strip wrapping single or double quotes if both present.
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  process.stdout.write(`${m[1]}=${v}\0`);
}
