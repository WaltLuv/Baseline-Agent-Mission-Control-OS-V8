export function buildMissionControlCsp(input: { nonce: string; googleEnabled: boolean }): string {
  const { nonce, googleEnabled } = input

  // In `next dev` (webpack or turbopack) the framework injects inline
  // bootstrap / HMR scripts that do not carry our request nonce. Because we
  // use `'strict-dynamic'`, ANY blocked bootstrap script breaks the entire
  // script chain — React never hydrates, forms fall back to native submit,
  // and login appears to do nothing. In dev we add `'unsafe-eval'` and
  // `'unsafe-inline'` so the dev runtime can boot. Production builds use
  // the strict nonce + `'strict-dynamic'` policy untouched.
  const devOnly = process.env.NODE_ENV !== 'production' ? ` 'unsafe-eval' 'unsafe-inline'` : ''

  return [
    `default-src 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
    `frame-ancestors 'none'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' blob:${devOnly}${googleEnabled ? ' https://accounts.google.com' : ''}`,
    `style-src 'self' 'unsafe-inline'`,
    `style-src-elem 'self' 'unsafe-inline'`,
    `style-src-attr 'unsafe-inline'`,
    `connect-src 'self' ws: wss: http://127.0.0.1:* http://localhost:* https://cdn.jsdelivr.net`,
    `img-src 'self' data: blob:${googleEnabled ? ' https://*.googleusercontent.com https://lh3.googleusercontent.com' : ''}`,
    `font-src 'self' data:`,
    `frame-src 'self'${googleEnabled ? ' https://accounts.google.com' : ''}`,
    `worker-src 'self' blob:`,
  ].join('; ')
}

export function buildNonceRequestHeaders(input: {
  headers: Headers
  nonce: string
  googleEnabled: boolean
}): Headers {
  const requestHeaders = new Headers(input.headers)
  const csp = buildMissionControlCsp({ nonce: input.nonce, googleEnabled: input.googleEnabled })

  requestHeaders.set('x-nonce', input.nonce)
  requestHeaders.set('Content-Security-Policy', csp)

  return requestHeaders
}
