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
  'Email - QA Domestic':           'QA Domestic',
  'Email - QA International':      'QA International',
  'Email - Engineering Domestic':  'Engineering Domestic',
  'Email - Engineering International': 'Engineering International',
  'Email - L&D Domestic':          'L&D Domestic',
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

interface GMassCampaign {
  id?: string | number
  subject?: string
  name?: string
  campaignName?: string
  campaign_name?: string
  sentCount?: number
  sent_count?: number
  totalSent?: number
  total_sent?: number
  openRate?: number
  open_rate?: number
  clickRate?: number
  click_rate?: number
  replyRate?: number
  reply_rate?: number
  bounceCount?: number
  bounce_count?: number
  bounces?: number
  unsubscribeCount?: number
  unsubscribe_count?: number
  scheduledDate?: string
  scheduled_date?: string
  sentDate?: string
  sent_date?: string
  createdAt?: string
  created_at?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function campaignName(c: GMassCampaign): string {
  return c.subject ?? c.name ?? c.campaignName ?? c.campaign_name ?? '(Unnamed)'
}

function sent(c: GMassCampaign): number {
  return c.sentCount ?? c.sent_count ?? c.totalSent ?? c.total_sent ?? 0
}

function openRate(c: GMassCampaign): number {
  return c.openRate ?? c.open_rate ?? 0
}

function clickRate(c: GMassCampaign): number {
  return c.clickRate ?? c.click_rate ?? 0
}

function replyRate(c: GMassCampaign): number {
  return c.replyRate ?? c.reply_rate ?? 0
}

function campaignDate(c: GMassCampaign): string {
  const raw = c.scheduledDate ?? c.scheduled_date ?? c.sentDate ?? c.sent_date ?? c.createdAt ?? c.created_at ?? ''
  if (!raw) return '—'
  const d = new Date(raw)
  return isNaN(d.getTime()) ? raw : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
}

function fmtRate(r: number): string {
  return r > 0 && r <= 1 ? `${(r * 100).toFixed(1)}%` : `${r.toFixed(1)}%`
}

function weightedAvg(campaigns: GMassCampaign[], fn: (c: GMassCampaign) => number): string {
  const totalSent = campaigns.reduce((s, c) => s + sent(c), 0)
  if (totalSent === 0) return '—'
  const weighted = campaigns.reduce((s, c) => s + fn(c) * sent(c), 0)
  const avg = weighted / totalSent
  return fmtRate(avg > 1 ? avg : avg)
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

    // reset input so the same file can be re-uploaded if needed
    if (inputRef.current) inputRef.current.value = ''
  }, [category, onUploaded])

  const { result, uploading } = state
  const displayCount = count.toLocaleString()

  return (
    <div className="rounded-xl border border-mh-border bg-mh-surface p-5 flex flex-col gap-3 min-w-0">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold text-white leading-tight">{DISPLAY_NAME[category]}</span>
        <span className="text-xs text-mh-muted shrink-0 mt-0.5">Email</span>
      </div>

      <div className="flex items-end gap-1">
        <span className="text-3xl font-bold text-white tabular-nums">{displayCount}</span>
        <span className="text-xs text-mh-muted mb-1">contacts</span>
      </div>

      {result && (
        <div className={`text-xs rounded-md px-2 py-1.5 ${result.error ? 'bg-red-900/30 text-red-300' : 'bg-emerald-900/30 text-emerald-300'}`}>
          {result.error
            ? result.error
            : `${result.created} created · ${result.skipped + result.updated} existing · ${result.errors} errors`}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleFile}
      />
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
    } catch {
      // counts stay as 0 — non-critical
    } finally {
      setCountsLoading(false)
    }
  }, [])

  const loadGmass = useCallback(async () => {
    try {
      const res = await fetch('/api/gmass')
      const json = await res.json() as { campaigns?: GMassCampaign[]; error?: string }
      if (json.error) {
        setGmassError(json.error)
      } else {
        setCampaigns(json.campaigns ?? [])
      }
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

  // Campaign aggregates
  const totalSent = campaigns.reduce((s, c) => s + sent(c), 0)
  const avgOpen  = weightedAvg(campaigns, openRate)
  const avgClick = weightedAvg(campaigns, clickRate)
  const avgReply = weightedAvg(campaigns, replyRate)

  const sortedCampaigns = [...campaigns].sort((a, b) => {
    const da = new Date(a.scheduledDate ?? a.scheduled_date ?? a.sentDate ?? a.sent_date ?? a.createdAt ?? a.created_at ?? 0).getTime()
    const db = new Date(b.scheduledDate ?? b.scheduled_date ?? b.sentDate ?? b.sent_date ?? b.createdAt ?? b.created_at ?? 0).getTime()
    return db - da
  })

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
              <StatChip label="Total Sent" value={totalSent.toLocaleString()} />
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
                    <th className="text-right px-3 py-2.5 text-mh-muted font-medium">Sent</th>
                    <th className="text-right px-3 py-2.5 text-mh-muted font-medium">Open</th>
                    <th className="text-right px-3 py-2.5 text-mh-muted font-medium">Click</th>
                    <th className="text-right px-3 py-2.5 text-mh-muted font-medium">Reply</th>
                    <th className="text-right px-4 py-2.5 text-mh-muted font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-mh-border">
                  {sortedCampaigns.map((c, i) => (
                    <tr key={c.id ?? i} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-2.5 text-white font-medium max-w-[200px] truncate">{campaignName(c)}</td>
                      <td className="px-3 py-2.5 text-right text-mh-muted tabular-nums">{sent(c).toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-right text-sky-400 tabular-nums">{fmtRate(openRate(c))}</td>
                      <td className="px-3 py-2.5 text-right text-violet-400 tabular-nums">{fmtRate(clickRate(c))}</td>
                      <td className="px-3 py-2.5 text-right text-emerald-400 tabular-nums">{fmtRate(replyRate(c))}</td>
                      <td className="px-4 py-2.5 text-right text-mh-muted">{campaignDate(c)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
