# Why this folder is docs, not code

The pack at `~/Downloads/agent-os-pack 3` is a complete **Next.js 14**
application — 34 components, 92 API routes, its own package.json, its
own routing, its own React tree.

Baseline Automations is **Vite + TanStack Router + Bun**. They're
different framework families with incompatible routing and asset
pipelines.

Wholesale merging the pack's `source/` into this repo would mean a
1-to-2-week port. So instead, what's been copied in here is the
**architectural intelligence** — install steps, agent matrix, design
system, workspace pattern, travel mode — that we can apply to our
existing routes incrementally without breaking the live app.

If you want the pack's source running as a sibling reference app:

```bash
cp -R "~/Downloads/agent-os-pack 3/source" ~/code/agent-os-pack-ref
cd ~/code/agent-os-pack-ref && npm install && npm run dev
```

It will run on its own port; you can crib UI components from it as
their patterns get ported into our Vite codebase.
