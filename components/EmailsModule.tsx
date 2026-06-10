'use client'
import { useState, useEffect, useRef, useCallback } from 'react'

// ── Constants ─────────────────────────────────────────────────────────────────

const EMAIL_CATEGORIES = [
  'Email - QA Domestic',
  'Email - QA International',
  'Email - Engineering Domestic',
  'Email - Engineering International',
  'Email - L&D Domestic',
] as const

type Category = typeof EMAIL_CATEGORIES[number]

const DISPLAY_NAME: Record<Category, string> = {
  'Email - QA Domestic':               'QA Domestic',
  'Email - QA International':          'QA International',
  'Email - Engineering Domestic':      'Engineering Domestic',
  'Email - Engineering International': 'Engineering International',
  'Email - L&D Domestic':              'L&D Domestic',
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface UploadResult {
  created: number
  skipped: number
  updated: number
  errors: number
  error?: string
}

interface CardState {
  uploading: boolean
  result: UploadResult | null
}

interface GMassStatistics {
  recipients?: number
  opens?: number
  clicks?: number
  replies?: number
  unsubscribes?: number
  bounces?: number
  blocks?: number
}

interface GMassCampaign {
  campaignId?: number
  subject?: string
  friendlyName?: string | null
  stage?: number
  creationTime?: string
  status?: string
  statistics?: GMassStatistics
  lists?: { listSource?: { listSourceSheet?: { worksheetName?: string } } }[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function cleanSubject(subject: string): string {
  // Strip GMass {{spin}}...{{end spin}} — take first variation as the display name
  return subject
    .replace(/\{\{spin\}\}(.*?)\{\{variation\}\}[\s\S]*?\{\{end spin\}\}/gi, '$1')
    .replace(/\{\{.*?\}\}/g, '')
    .trim()
}

function campaignName(c: GMassCampaign): string {
  if (c.friendlyName) return c.friendlyName
  if (c.subject) return cleanSubject(c.subject)
  return '(Unnamed)'
}

function recipients(c: GMassCampaign): number {
  return c.statistics?.recipients ?? 0
}

function pct(count: number, total: number): string {
  if (!total) return '—'
  return `${((count / total) * 100).toFixed(1)}%`
}

function campaignDate(c: GMassCampaign): string {
  const raw = c.creationTime ?? ''
  if (!raw) return '—'
  const d = new Date(raw)
  return isNaN(d.getTime()) ? raw : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
}

function sheetName(c: GMassCampaign): string {
  return c.lists?.[0]?.listSource?.listSourceSheet?.worksheetName ?? ''
}

// Weighted average rate across all campaigns
function weightedAvgPct(
  campaigns: GMassCampaign[],
  fn: (stats: GMassStatistics) => number,
): string {
  const totalRecipients = campaigns.reduce((s, c) => s + recipients(c), 0)
  if (!totalRecipients) return '—'
  const weighted = campaigns.reduce((s, c) => {
    const r = recipients(c)
    return s + fn(c.statistics ?? {}) * r
  }, 0)
  return `${((weighted / totalRecipients) * 100).toFixed(1)}%`
}

// ── Upload card ───────────────────────────────────────────────────────────────

function UploadCard({
  category,
  count,
  onUploaded,
}: {
  category: Category
  count: number
  onUploaded: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<CardState>({ uploading: false, result: null })
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setState({ uploading: true, result: null })

    const fd = new FormData()
    fd.append('file', file)
    fd.append('lvl1Source', 'Email')
    fd.append('lvl2Source', category)

    try {
      const res = await fetch('/api/upload-prospects', { method: 'POST', body: fd })
      const json = await res.json() as UploadResult
      setState({ uploading: false, result: json })
      onUploaded()
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setState(s => ({ ...s, result: null })), 5000)
    } catch (err) {
      setState({ uploading: false, result: { created: 0, skipped: 0, updated: 0, errors: 0, error: String(err) } })
    }

    if (inputRef.current) inputRef.current.value = ''
  }, [category, onUploaded])

  const { result, uploading } = state

  return (
    <div className="rounded-xl border border-mh-border bg-mh-surface p-5 flex flex-col gap-3 min-w-0">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold text-white leading-tight">{DISPLAY_NAME[category]}</span>
        <span className="text-xs text-mh-muted shrink-0 mt-0.5">Email</span>
      </div>

      <div className="flex items-end gap-1">
        <span className="text-3xl font-bold text-white tabular-nums">{count.toLocaleString()}</span>
        <span className="text-xs text-mh-muted mb-1">contacts</span>
      </div>

      {result && (
        <div className={`text-xs rounded-md px-2 py-1.5 ${result.error ? 'bg-red-900/30 text-red-300' : 'bg-emerald-900/30 text-emerald-300'}`}>
          {result.error
            ? result.error
            : `${result.created} created · ${result.skipped + result.updated} existing · ${result.errors} errors`}
        </div>
      )}

      <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="mt-auto w-full text-xs font-medium rounded-lg px-3 py-2 border border-mh-border bg-mh-bg text-mh-muted hover:text-white hover:border-white/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {uploading ? 'Uploading…' : 'Upload CSV'}
      </button>
    </div>
  )
}

// ── Stat chip ─────────────────────────────────────────────────────────────────

function StatChip({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-4 py-2.5 rounded-lg border border-mh-border bg-mh-surface">
      <span className="text-lg font-bold text-white tabular-nums">{value}</span>
      <span className="text-[11px] text-mh-muted">{label}</span>
    </div>
  )
}

// ── Main module ───────────────────────────────────────────────────────────────

export default function EmailsModule() {
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [countsLoading, setCountsLoading] = useState(true)

  const [campaigns, setCampaigns] = useState<GMassCampaign[]>([])
  const [gmassLoading, setGmassLoading] = useState(true)
  const [gmassError, setGmassError] = useState<string | null>(null)

  const loadCounts = useCallback(async () => {
    try {
      const res = await fetch('/api/email-lists')
      const json = await res.json() as { counts: Record<string, number>; error?: string }
      if (json.counts) setCounts(json.counts)
    } catch { /* counts stay 0 */ }
    finally { setCountsLoading(false) }
  }, [])

  const loadGmass = useCallback(async () => {
    try {
      const res = await fetch('/api/gmass')
      const json = await res.json() as { campaigns?: GMassCampaign[]; error?: string }
      if (json.error) setGmassError(json.error)
      else setCampaigns(json.campaigns ?? [])
    } catch (err) {
      setGmassError(String(err))
    } finally {
      setGmassLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCounts()
    loadGmass()
  }, [loadCounts, loadGmass])

  const sentCampaigns = campaigns.filter(c => c.status === 'sent' || (c.statistics?.recipients ?? 0) > 0)

  const totalRecipients = sentCampaigns.reduce((s, c) => s + recipients(c), 0)
  const avgOpen  = weightedAvgPct(sentCampaigns, s => s.opens  ?? 0)
  const avgClick = weightedAvgPct(sentCampaigns, s => s.clicks ?? 0)
  const avgReply = weightedAvgPct(sentCampaigns, s => s.replies ?? 0)

  const sortedCampaigns = [...campaigns].sort((a, b) =>
    new Date(b.creationTime ?? 0).getTime() - new Date(a.creationTime ?? 0).getTime()
  )

  return (
    <div className="space-y-8 py-2">

      {/* ── Part 1: Upload Email Set ─────────────────────────────────────── */}
      <section>
        <h2 className="text-base font-bold text-white mb-4">Email Lists</h2>
        {countsLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {EMAIL_CATEGORIES.map(cat => (
              <div key={cat} className="rounded-xl border border-mh-border bg-mh-surface p-5 h-36 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {EMAIL_CATEGORIES.map(cat => (
              <UploadCard
                key={cat}
                category={cat}
                count={counts[cat] ?? 0}
                onUploaded={loadCounts}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Part 2: GMass Campaign Stats ─────────────────────────────────── */}
      <section>
        <h2 className="text-base font-bold text-white mb-4">Campaign Stats</h2>

        {gmassLoading ? (
          <div className="rounded-xl border border-mh-border bg-mh-surface p-8 flex items-center justify-center">
            <span className="text-sm text-mh-muted animate-pulse">Loading campaigns…</span>
          </div>
        ) : gmassError ? (
          <div className="rounded-xl border border-mh-border bg-mh-surface px-5 py-4 text-sm text-mh-muted">
            Could not load campaign data — {gmassError}
          </div>
        ) : campaigns.length === 0 ? (
          <div className="rounded-xl border border-mh-border bg-mh-surface px-5 py-8 text-center text-sm text-mh-muted">
            No campaigns found in GMass account.
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary chips */}
            <div className="flex flex-wrap gap-2">
              <StatChip label="Campaigns"  value={campaigns.length} />
              <StatChip label="Total Sent" value={totalRecipients.toLocaleString()} />
              <StatChip label="Avg Open"   value={avgOpen} />
              <StatChip label="Avg Click"  value={avgClick} />
              <StatChip label="Avg Reply"  value={avgReply} />
            </div>

            {/* Campaign table */}
            <div className="rounded-xl border border-mh-border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-mh-border bg-mh-surface">
                    <th className="text-left px-4 py-2.5 text-mh-muted font-medium">Campaign</th>
                    <th className="text-left px-3 py-2.5 text-mh-muted font-medium hidden md:table-cell">Sheet</th>
                    <th className="text-right px-3 py-2.5 text-mh-muted font-medium">Sent</th>
                    <th className="text-right px-3 py-2.5 text-mh-muted font-medium">Opens</th>
                    <th className="text-right px-3 py-2.5 text-mh-muted font-medium">Clicks</th>
                    <th className="text-right px-3 py-2.5 text-mh-muted font-medium">Replies</th>
                    <th className="text-right px-4 py-2.5 text-mh-muted font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-mh-border">
                  {sortedCampaigns.map((c, i) => {
                    const r = recipients(c)
                    const stats = c.statistics ?? {}
                    return (
                      <tr key={c.campaignId ?? i} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-2.5 text-white font-medium max-w-[220px] truncate">{campaignName(c)}</td>
                        <td className="px-3 py-2.5 text-mh-muted max-w-[140px] truncate hidden md:table-cell">{sheetName(c)}</td>
                        <td className="px-3 py-2.5 text-right text-mh-muted tabular-nums">{r.toLocaleString()}</td>
                        <td className="px-3 py-2.5 text-right text-sky-400 tabular-nums">{pct(stats.opens ?? 0, r)}</td>
                        <td className="px-3 py-2.5 text-right text-violet-400 tabular-nums">{pct(stats.clicks ?? 0, r)}</td>
                        <td className="px-3 py-2.5 text-right text-emerald-400 tabular-nums">{pct(stats.replies ?? 0, r)}</td>
                        <td className="px-4 py-2.5 text-right text-mh-muted">{campaignDate(c)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
