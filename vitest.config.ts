import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig(async () => {
  // `vite-tsconfig-paths` is ESM-only; loading it via dynamic import avoids
  // Vite's config bundler trying to `require()` it.
  const { default: tsconfigPaths } = await import('vite-tsconfig-paths')

  return {
    plugins: [react(), tsconfigPaths()],
    test: {
      environment: 'jsdom',
      globals: true,
      // Run tests inside worker threads instead of forked child processes so
      // they share the parent Vitest's Node ABI. This avoids a recurring
      // "Module did not self-register" / NODE_MODULE_VERSION mismatch when
      // the test files load native modules (better-sqlite3) — the system
      // /usr/bin/node may be a different major version than the Node we
      // build the binding against. With `pool: 'threads'` the workers run
      // in-process via worker_threads, so the binding loaded once in the
      // parent is reused.
      pool: 'threads' as const,
      poolOptions: {
        threads: {
          singleThread: true,
        },
        forks: {
          singleFork: true,
        },
      },
      // Files that mutate process.cwd() can't run in worker_threads. Route
      // them through the forks pool which spawns child processes.
      poolMatchGlobs: [
        ['**/security-scan-fix-route.test.ts', 'forks'],
      ] as Array<[string, 'forks' | 'threads']>,
      setupFiles: ['src/test/setup.ts'],
      include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'desktop/__tests__/**/*.test.js'],
      coverage: {
        provider: 'v8' as const,
        include: ['src/lib/**/*.ts'],
        exclude: [
          'src/lib/__tests__/**',
          'src/**/*.test.ts',
          // Server-side orchestration files requiring live DB/process context
          'src/lib/websocket.ts',
          'src/lib/websocket-utils.ts',
          'src/lib/super-admin.ts',
          'src/lib/task-dispatch.ts',
          'src/lib/security-scan.ts',
          'src/lib/sessions.ts',
          'src/lib/scheduler.ts',
          'src/lib/recurring-tasks.ts',
          'src/lib/local-agent-sync.ts',
          'src/lib/agent-sync.ts',
          'src/lib/agent-optimizer.ts',
          'src/lib/agent-workspace.ts',
          'src/lib/agent-templates.ts',
          'src/lib/codex-sessions.ts',
          'src/lib/claude-sessions.ts',
          'src/lib/claude-tasks.ts',
          'src/lib/hermes-memory.ts',
          'src/lib/hermes-sessions.ts',
          'src/lib/hermes-tasks.ts',
          'src/lib/github-sync-engine.ts',
          'src/lib/github-sync-poller.ts',
          'src/lib/github.ts',
          'src/lib/github.ts',
          'src/lib/mcp-audit.ts',
          'src/lib/navigation-metrics.ts',
          'src/lib/navigation.ts',
          'src/lib/provisioner-client.ts',
          'src/lib/provider-subscriptions.ts',
          'src/lib/skill-sync.ts',
          'src/lib/transcript-parser.ts',
          'src/lib/use-focus-trap.ts',
          'src/lib/use-server-events.ts',
          'src/lib/use-smart-poll.ts',
          'src/lib/adapters/**',
          'src/lib/dashboard-widgets.ts',
          'src/lib/docs-knowledge.ts',
          'src/lib/event-bus.ts',
          'src/lib/auto-credentials.ts',
          'src/lib/migrations.ts',
          'src/lib/db.ts',
          'src/lib/command.ts',
          'src/lib/client-logger.ts',
          'src/lib/agent-evals.ts',
          'src/lib/agent-card-helpers.ts',
          'src/lib/chat-utils.ts',
          // Additional server-side files requiring live runtime context
          'src/lib/auth.ts',
          'src/lib/webhooks.ts',
          'src/lib/memory-utils.ts',
          'src/lib/gateway-runtime.ts',
          'src/lib/device-identity.ts',
          'src/lib/utils.ts',
          'src/lib/version.ts',
          'src/lib/plugin-loader.ts',
          'src/lib/plugins.ts',
          'src/lib/office-layout.ts',
          'src/lib/skill-registry.ts',
        ],
        thresholds: {
          lines: 60,
          functions: 60,
          branches: 60,
          statements: 60,
        },
      },
    },
  }
})
