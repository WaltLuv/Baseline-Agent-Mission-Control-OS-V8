import { createHmac } from 'node:crypto'
import { getDatabase } from '@/lib/db'

/**
 * Read-only public share view of an executive briefing.
 *
 * Security:
 *   - The page is only reachable with a valid signed link:
 *       ?id={briefingId}&exp={epoch}&sig={hmac}
 *     The HMAC is server-only — recipients can't forge or extend.
 *   - If `exp` has passed we render the expired state.
 *   - If the briefing was revoked we render the revoked state.
 *   - We render the snapshot saved at share time — never live data.
 *     This means recipients see exactly what the operator shared, no
 *     leakage of fresher numbers or other workspaces.
 */

interface Snapshot {
  headline?: string
  valueCreatedMonthUsd?: number
  hoursSavedMonth?: number
  dailyWins?: { title: string; impact: string; valueUsd: number }[]
  attentionItems?: { title: string; severity: string; reason: string }[]
  topEmployee?: { name: string; impact: string } | null
  nextAction?: { label: string; href: string }
}

function getSecret(): string {
  return (
    process.env.SHARE_SIGNING_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.MISSION_CONTROL_SECRET ||
    'dev-only-mission-control-share-secret'
  )
}

function verifySig(id: string, exp: number, sig: string): boolean {
  const expected = createHmac('sha256', getSecret())
    .update(`${id}.${exp}`)
    .digest('hex')
    .slice(0, 32)
  return expected === sig
}

interface PageProps {
  searchParams: Promise<{ id?: string; exp?: string; sig?: string }>
}

export default async function BriefingSharePage({ searchParams }: PageProps) {
  const { id, exp, sig } = await searchParams

  if (!id || !exp || !sig) {
    return <StateView title="Invalid share link" detail="This link is missing required parameters." />
  }

  const expNum = Number(exp)
  if (!Number.isFinite(expNum) || expNum < Math.floor(Date.now() / 1000)) {
    return <StateView title="This briefing link has expired" detail="Ask the sender for a fresh one — links expire to protect your business." />
  }

  if (!verifySig(id, expNum, sig)) {
    return <StateView title="This link can't be verified" detail="The signature on this share link is invalid or has been tampered with." />
  }

  let row: { snapshot: string; expires_at: number; revoked_at: number | null } | undefined
  try {
    const db = getDatabase()
    row = db.prepare(
      `SELECT snapshot, expires_at, revoked_at FROM briefing_shares WHERE id = ?`
    ).get(id) as typeof row
  } catch {
    return <StateView title="We couldn't load this briefing" detail="Please ask the sender to share it again." />
  }

  if (!row) {
    return <StateView title="Briefing not found" detail="It may have been revoked or never existed." />
  }
  if (row.revoked_at) {
    return <StateView title="This briefing has been revoked" detail="The sender no longer wishes to share it." />
  }

  let b: Snapshot = {}
  try {
    b = JSON.parse(row.snapshot)
  } catch {
    return <StateView title="This briefing snapshot is unreadable" detail="Please contact the sender." />
  }

  return (
    <div className="min-h-screen bg-background text-foreground" data-testid="briefing-share-view">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-primary">
          Mission Control · Shared executive briefing
        </p>
        <h1 className="mt-2 text-3xl font-bold">{b.headline ?? 'Executive briefing'}</h1>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Stat label="Value created · this month" value={`$${(b.valueCreatedMonthUsd ?? 0).toLocaleString()}`} />
          <Stat label="Hours saved" value={(b.hoursSavedMonth ?? 0).toString()} />
        </div>

        {b.dailyWins && b.dailyWins.length > 0 && (
          <Section title="Today's wins">
            <ul className="space-y-1.5 text-sm">
              {b.dailyWins.map((w, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-emerald-400">●</span>
                  <span>
                    <strong>{w.title}</strong> — {w.impact}{' '}
                    <span className="text-emerald-400">+${w.valueUsd.toLocaleString()}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {b.attentionItems && b.attentionItems.length > 0 && (
          <Section title="Attention required">
            <ul className="space-y-1.5 text-sm">
              {b.attentionItems.map((a, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className={a.severity === 'high' ? 'text-red-400' : 'text-amber-400'}>●</span>
                  <span>
                    <strong>{a.title}</strong>
                    <span className="ml-1 text-muted-foreground">— {a.reason}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {b.topEmployee && (
          <Section title="Star AI employee">
            <p className="text-sm">
              <strong>{b.topEmployee.name}</strong> — {b.topEmployee.impact}
            </p>
          </Section>
        )}

        {b.nextAction && (
          <Section title="What you should do next">
            <p className="text-sm text-foreground">{b.nextAction.label}</p>
          </Section>
        )}

        <p className="mt-10 text-center text-xs text-muted-foreground">
          This is a read-only snapshot. Sign in to{' '}
          <a href="/login" className="underline">Mission Control</a> to see live data.
        </p>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/40 bg-card/30 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold text-primary">{value}</p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 rounded-lg border border-border/40 bg-card/20 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      <div className="mt-2">{children}</div>
    </section>
  )
}

function StateView({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center" data-testid="briefing-share-state">
      <div className="max-w-md text-center p-8">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-2 text-muted-foreground">{detail}</p>
        <a href="/" className="mt-4 inline-block text-sm underline">Back to home</a>
      </div>
    </div>
  )
}
