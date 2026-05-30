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

  // Google Identity Services origins. GSI needs to:
  //   - load its client script from accounts.google.com (script-src)
  //   - load its prompt stylesheet from accounts.google.com/gsi/style (style-src-elem)
  //   - render its credential-picker iframe from accounts.google.com (frame-src)
  //   - call its credential-status API from accounts.google.com (connect-src)
  //   - load Google account avatars (img-src)
  // Without any of these, GSI either fails silently or logs:
  //   "[GSI_LOGGER]: Check credential status returns invalid response"
  const googleScript = googleEnabled ? ' https://accounts.google.com https://apis.google.com' : ''
  const googleStyle = googleEnabled ? ' https://accounts.google.com' : ''
  const googleFrame = googleEnabled ? ' https://accounts.google.com https://content.googleapis.com' : ''
  const googleConnect = googleEnabled ? ' https://accounts.google.com https://oauth2.googleapis.com' : ''
  const googleImg = googleEnabled ? ' https://*.googleusercontent.com https://lh3.googleusercontent.com' : ''

  return [
    `default-src 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
    `frame-ancestors 'none'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' blob:${devOnly}${googleScript}`,
    `style-src 'self' 'unsafe-inline'${googleStyle}`,
    `style-src-elem 'self' 'unsafe-inline'${googleStyle}`,
    `style-src-attr 'unsafe-inline'`,
    `connect-src 'self' ws: wss: http://127.0.0.1:* http://localhost:* https://cdn.jsdelivr.net${googleConnect}`,
    `img-src 'self' data: blob:${googleImg}`,
    `font-src 'self' data:`,
    `frame-src 'self'${googleFrame}`,
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
