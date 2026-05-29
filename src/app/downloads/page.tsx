import fs from 'node:fs'
import path from 'node:path'

export const dynamic = 'force-static'

type Doc = {
  id: 'quickstart' | 'playbooks' | 'ops' | 'onboarding'
  file: string
  title: string
  sub: string
}

const DOCS: Doc[] = [
  { id: 'quickstart', file: 'sales-operator-quickstart.pdf', title: 'Sales Operator Quickstart', sub: 'One-document operator guide · 22 sections' },
  { id: 'quickstart', file: 'sales-playbook-index.pdf', title: 'Sales Playbook Index', sub: 'Cross-vertical patterns + readme' },
  { id: 'playbooks', file: 'playbook-property-management.pdf', title: 'Property Management', sub: 'PM company owner / Director of Ops' },
  { id: 'playbooks', file: 'playbook-general-contractor.pdf', title: 'General Contractor', sub: 'Owner / GM · bid + sub coordination' },
  { id: 'playbooks', file: 'playbook-home-services.pdf', title: 'Home Services', sub: 'Plumbing / HVAC / electrical · missed calls' },
  { id: 'playbooks', file: 'playbook-real-estate.pdf', title: 'Real Estate', sub: 'Team lead · sub-5-min lead response' },
  { id: 'playbooks', file: 'playbook-mortgage.pdf', title: 'Mortgage', sub: 'Branch manager · doc cycle + closing' },
  { id: 'playbooks', file: 'playbook-cpa.pdf', title: 'CPA / Accounting', sub: 'Managing partner · tax-season pressure' },
  { id: 'playbooks', file: 'playbook-law-firm.pdf', title: 'Law Firm', sub: 'Solo + small firm · intake + matter mgmt' },
  { id: 'playbooks', file: 'playbook-marketing-agency.pdf', title: 'Marketing Agency', sub: 'Agency owner · reporting + content + leads' },
  { id: 'playbooks', file: 'playbook-ai-agency.pdf', title: 'AI Agency', sub: 'Founder · multi-client AI workforce delivery' },
  { id: 'ops', file: 'ops-digitalocean-execution.pdf', title: 'DigitalOcean Execution Guide', sub: '45-min deploy · exact commands + sizing + DNS' },
  { id: 'ops', file: 'ops-production-verification-checklist.pdf', title: 'Production Verification Checklist', sub: '10-tier acceptance gate · 15-min run' },
  { id: 'ops', file: 'ops-production-readiness-report.pdf', title: 'Production Readiness Report', sub: 'Dry-run results · 1214/1214 tests · runtime proofs' },
  { id: 'onboarding', file: 'onboarding-14-day-pilot-sop.pdf', title: '14-Day Pilot SOP', sub: 'Day-by-day · pilot ticket template · health flags' },
]

const GROUP_LABELS: Record<Doc['id'], string> = {
  quickstart: 'Sales — Operator Quickstart',
  playbooks: 'Sales Playbooks — 9 Verticals',
  ops: 'Operations — Production Deployment',
  onboarding: 'Onboarding — Pilot Delivery',
}

type ManifestEntry = { file: string; title: string; source: string; kb: number }
type Manifest = { generated: string; docs: ManifestEntry[]; bundle_kb: number }

function loadManifest(): Manifest | null {
  try {
    const p = path.join(process.cwd(), 'public', 'downloads', 'index.json')
    return JSON.parse(fs.readFileSync(p, 'utf8')) as Manifest
  } catch {
    return null
  }
}

export const metadata = {
  title: 'Baseline AI Workforce OS — Launch Bundle',
  description: 'Downloadable PDF library — sales playbooks, operations runbooks, and pilot SOP for Baseline AI Workforce OS.',
}

export default function DownloadsPage() {
  const manifest = loadManifest()
  const sizeByFile: Record<string, number> = {}
  if (manifest) for (const d of manifest.docs) sizeByFile[d.file] = d.kb
  const bundleMeta = manifest
    ? `All ${manifest.docs.length} PDFs in one download · ~${(manifest.bundle_kb / 1024).toFixed(1)} MB · generated ${manifest.generated}`
    : 'All PDFs in one download'

  const grouped: Record<Doc['id'], Doc[]> = { quickstart: [], playbooks: [], ops: [], onboarding: [] }
  for (const d of DOCS) grouped[d.id].push(d)

  return (
    <main className="downloads-page" data-testid="downloads-page">
      <style>{CSS}</style>
      <div className="wrap">
        <div className="kicker">Baseline AI Workforce OS</div>
        <h1>Launch <span>Bundle</span> — Sales &amp; Ops PDFs</h1>
        <p className="lede">
          The complete operator-grade documentation set. Everything a new sales operator, customer
          success lead, or deployment engineer needs to demo, sell, onboard, deploy, and verify the
          Baseline AI Workforce OS.
        </p>

        <div className="doctrine">
          <strong>Mission Control</strong> supervises ·{' '}
          <strong>Baseline OS</strong> coordinates ·{' '}
          <strong>Hermes / OpenClaw / Claude Code</strong> execute
        </div>

        <div className="bundle" data-testid="bundle-row">
          <div className="meta">
            <strong>baseline-launch-bundle.zip</strong>
            <span>{bundleMeta}</span>
          </div>
          <div className="actions">
            <a className="btn" href="/downloads/baseline-launch-bundle.zip" download data-testid="download-bundle-btn">
              Download all (.zip)
            </a>
            <a className="btn ghost" href="/downloads/index.json" data-testid="manifest-btn">
              View manifest (JSON)
            </a>
          </div>
        </div>

        {(Object.keys(grouped) as Doc['id'][]).map((gid) => (
          <section key={gid} className="group">
            <h2>{GROUP_LABELS[gid]}</h2>
            <div className="grid">
              {grouped[gid].map((d) => {
                const kb = sizeByFile[d.file]
                const sizeText = kb ? `${kb} KB` : 'PDF'
                const slug = d.file.replace('.pdf', '')
                return (
                  <div key={d.file} className="card" data-testid={`card-${slug}`}>
                    <div className="title">{d.title}</div>
                    <div className="sub">{d.sub}</div>
                    <div className="row">
                      <span className="pill">{sizeText}</span>
                      <a
                        className="download"
                        href={`/downloads/${d.file}`}
                        download
                        data-testid={`dl-${slug}`}
                      >
                        Download ↓
                      </a>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        ))}

        <footer className="dl-footer">
          Generated PDFs are derived from the Markdown sources in <code>/app/docs/</code>.
          Regenerate with <code>python3 scripts/build-pdfs.py</code>.
          No live customer data is embedded in any of these documents.
        </footer>
      </div>
    </main>
  )
}

const CSS = `
.downloads-page {
  --dl-bg: #0b1220;
  --dl-panel: #11192d;
  --dl-panel-2: #0e1626;
  --dl-text: #e2e8f0;
  --dl-muted: #94a3b8;
  --dl-accent: #38bdf8;
  --dl-accent-2: #22d3ee;
  --dl-line: #1e293b;
  background: var(--dl-bg);
  color: var(--dl-text);
  font-family: -apple-system, "Inter", "Segoe UI", system-ui, sans-serif;
  line-height: 1.55;
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
}
.downloads-page .wrap { max-width: 980px; margin: 0 auto; padding: 56px 28px 80px; }
.downloads-page .kicker { text-transform: uppercase; letter-spacing: 0.22em; color: var(--dl-accent); font-size: 11px; font-weight: 600; margin-bottom: 14px; }
.downloads-page h1 { font-size: 38px; line-height: 1.08; letter-spacing: -0.02em; margin: 0 0 14px 0; font-weight: 800; color: var(--dl-text); }
.downloads-page h1 span { color: var(--dl-accent-2); }
.downloads-page .lede { color: var(--dl-muted); font-size: 15px; max-width: 70ch; margin: 0; }
.downloads-page .doctrine { margin-top: 24px; padding: 14px 18px; background: var(--dl-panel-2); border-left: 3px solid var(--dl-accent); font-size: 13px; border-radius: 4px; }
.downloads-page .doctrine strong { color: var(--dl-accent); }
.downloads-page .bundle { margin-top: 40px; padding: 22px 24px; background: linear-gradient(180deg, #0b203a 0%, #0c1730 100%); border: 1px solid #1d3a63; border-radius: 12px; display: flex; align-items: center; justify-content: space-between; gap: 24px; flex-wrap: wrap; }
.downloads-page .bundle .meta strong { color: var(--dl-accent-2); display: block; font-size: 18px; margin-bottom: 4px; }
.downloads-page .bundle .meta span { color: var(--dl-muted); font-size: 13px; }
.downloads-page .bundle .actions { display: flex; gap: 10px; flex-wrap: wrap; }
.downloads-page .btn { display: inline-block; padding: 11px 18px; background: var(--dl-accent); color: #04111f; border-radius: 7px; text-decoration: none; font-weight: 700; font-size: 14px; transition: transform .12s ease, background .12s ease; }
.downloads-page .btn:hover { transform: translateY(-1px); background: var(--dl-accent-2); }
.downloads-page .btn.ghost { background: transparent; color: var(--dl-text); border: 1px solid var(--dl-line); }
.downloads-page .btn.ghost:hover { background: var(--dl-panel-2); color: var(--dl-accent); }
.downloads-page .group { margin-top: 48px; }
.downloads-page .group h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.18em; color: var(--dl-muted); margin: 0 0 14px 0; font-weight: 600; }
.downloads-page .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
.downloads-page .card { background: var(--dl-panel); border: 1px solid var(--dl-line); border-radius: 8px; padding: 14px 16px; display: flex; flex-direction: column; gap: 8px; transition: border-color .12s ease, transform .12s ease; }
.downloads-page .card:hover { border-color: var(--dl-accent); transform: translateY(-1px); }
.downloads-page .card .title { font-weight: 600; font-size: 14px; color: var(--dl-text); }
.downloads-page .card .sub { font-size: 12px; color: var(--dl-muted); }
.downloads-page .card .row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: auto; }
.downloads-page .pill { font-size: 11px; color: var(--dl-muted); background: var(--dl-panel-2); padding: 2px 8px; border-radius: 999px; border: 1px solid var(--dl-line); }
.downloads-page .download { font-size: 13px; color: var(--dl-accent); text-decoration: none; font-weight: 600; }
.downloads-page .download:hover { color: var(--dl-accent-2); }
.downloads-page .dl-footer { margin-top: 64px; padding-top: 24px; border-top: 1px solid var(--dl-line); color: var(--dl-muted); font-size: 12px; }
.downloads-page .dl-footer code { background: var(--dl-panel); padding: 1px 6px; border-radius: 3px; font-size: 11px; }
`
