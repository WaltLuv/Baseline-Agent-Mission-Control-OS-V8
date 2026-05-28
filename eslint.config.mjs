import next from 'eslint-config-next'

const config = [
  ...next,
  {
    ignores: [
      '.data/**',
      'ops/**',
      'test-results/**',
      'playwright-report/**',
      '.tmp/**',
      '.playwright-mcp/**',
    ],
  },
  // The React 19/ESLint ecosystem is still settling. These rules are valuable,
  // but they currently trigger a lot of false positives in this codebase.
  // Keep them off until we do a dedicated refactor pass.
  {
    rules: {
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/immutability': 'off',
      // React-19 compiler advisory: when a useCallback / useMemo can't be
      // migrated to the compiler's auto-memo pass it complains, even when
      // the code is fully correct. We trust our manual memoization.
      'react-hooks/preserve-manual-memoization': 'off',
    },
  },
]

export default config
