/**
 * API Key Masking Utility
 * 
 * Masks API keys for safe display in UI components.
 * Shows first 4 and last 4 characters, replacing the middle with ••••.
 */

const SENSITIVE_PATTERNS = ['api_key', 'apikey', 'api-key', 'token', 'secret', 'password']

/**
 * Masks a single API key string.
 * Shows first 4 and last 4 characters, replacing middle with ••••••••
 * Example: "abc1234567xyz" → "abc1••••••••xyz"
 */
export function maskApiKey(key: string): string {
  if (!key || key.length <= 8) {
    return '•'.repeat(Math.max(key.length, 8))
  }
  const first4 = key.substring(0, 4)
  const last4 = key.substring(key.length - 4)
  return `${first4}••••••••${last4}`
}

/**
 * Recursively masks sensitive keys in an object.
 * Keys matching sensitive patterns are masked in-place.
 */
export function maskAllConfigKeys(obj: Record<string, unknown>, depth = 0): Record<string, unknown> {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return obj
  }

  // Prevent infinite recursion
  if (depth > 10) {
    return obj
  }

  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase()
    const isSensitive = SENSITIVE_PATTERNS.some(pattern => lowerKey.includes(pattern))

    if (isSensitive && typeof value === 'string') {
      result[key] = maskApiKey(value)
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result[key] = maskAllConfigKeys(value as Record<string, unknown>, depth + 1)
    } else {
      result[key] = value
    }
  }
  return result
}
