export const COOKIE_NAME = 'auth_session'
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

// Computes expected session token = HMAC-SHA256(AUTH_SECRET, AUTH_PASSWORD)
// Changing either env var invalidates all existing sessions.
export async function computeExpectedToken(): Promise<string> {
  const secret = process.env.AUTH_SECRET ?? 'dev-secret-change-me'
  const password = process.env.AUTH_PASSWORD ?? 'password'
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(password))
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}
