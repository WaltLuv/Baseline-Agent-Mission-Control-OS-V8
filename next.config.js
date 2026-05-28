const withNextIntl = require('next-intl/plugin')('./src/i18n/request.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: __dirname,
  outputFileTracingExcludes: {
    '/*': ['./.data/**/*'],
  },
  turbopack: {
    root: __dirname,
  },
  // Native modules must be loaded outside the bundler so the .node binding
  // is loaded exactly once with the host Node ABI (fixes "Module did not
  // self-register" in Turbopack dev mode).
  serverExternalPackages: ['better-sqlite3'],
  // Allow the Emergent preview proxy origins during dev so /_next/* assets load.
  allowedDevOrigins: ['*.preview.emergentagent.com', '*.cluster-12.preview.emergentcf.cloud'],
  // Transpile ESM-only packages so they resolve correctly in all environments
  transpilePackages: ['react-markdown', 'remark-gfm'],
  
  // Security headers
  // Content-Security-Policy is set in src/proxy.ts with a per-request nonce.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          ...(process.env.NODE_ENV === 'production' && process.env.MC_DISABLE_HSTS !== '1' || process.env.MC_ENABLE_HSTS === '1' ? [
            { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }
          ] : []),
        ],
      },
    ];
  },
  
};

module.exports = withNextIntl(nextConfig);
