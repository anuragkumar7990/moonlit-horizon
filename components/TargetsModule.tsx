'use client'
import { useState, useEffect } from 'react'

interface TargetRow {
  metric: string
  target: number
  actual: number
  pct: number | null
}

interface TargetsData {
  month: string
  targets: TargetRow[]
}

type Period = 'weekly' | 'monthly'

const WEEKLY_DIVISOR = 4

function PctBar({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-mh-muted text-xs">—</span>
  const capped = Math.min(pct, 100)
  const color = pct >= 100 ? '#FFD700' : pct >= 70 ? '#22C55E' : pct >= 40 ? '#F59E0B' : '#F87171'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-mh-border rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${capped}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-semibold shrink-0" style={{ color: pct >= 100 ? '#FFD700' : 'inherit' }}>
        {pct}%
      </span>
    </div>
  )
}

export default function TargetsModule() {
  const [data, setData] = useState<TargetsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState<Period>('monthly')

  useEffect(() => {
    fetch('/api/targets')
      .then(r => r.json())
      .then((d: TargetsData) => { setData(d); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [])

  const rows: TargetRow[] = (data?.targets ?? []).map(r => {
    if (period === 'weekly') {
      const wTarget = Math.round(r.target / WEEKLY_DIVISOR)
      const wActual = Math.round(r.actual / WEEKLY_DIVISOR)
      return {
        metric: r.metric,
        target: wTarget,
        actual: wActual,
        pct: wTarget > 0 ? Math.round((wActual / wTarget) * 100) : null,
      }
    }
    return r
  })

  const monthLabel = data?.month
    ? new Date(data.month + '-01').toLocaleString('en-IN', { month: 'long', year: 'numeric' })
    : '—'

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-mh-text">Targets</h2>
          <p className="text-xs text-mh-muted mt-0.5">{monthLabel}</p>
        </div>
        <div className="flex gap-0 border border-mh-border rounded-lg overflow-hidden">
          {(['weekly', 'monthly'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-1.5 text-xs font-medium transition-colors capitalize
                ${period === p ? 'bg-mh-vermillion text-white' : 'text-mh-muted hover:text-mh-text'}`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="py-16 text-center text-mh-muted text-sm">Loading targets…</div>
      )}
      {error && (
        <div className="py-16 text-center text-red-400 text-sm">{error}</div>
      )}

      {!loading && !error && (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-mh-border bg-mh-surface">
                <th className="text-left px-5 py-3 text-[10px] font-semibold text-mh-muted uppercase tracking-widest">Metric</th>
                <th className="text-right px-5 py-3 text-[10px] font-semibold text-mh-muted uppercase tracking-widest">Target</th>
                <th className="text-right px-5 py-3 text-[10px] font-semibold text-mh-muted uppercase tracking-widest">Actual</th>
                <th className="px-5 py-3 text-[10px] font-semibold text-mh-muted uppercase tracking-widest w-48">Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mh-border">
              {rows.map(r => (
                <tr key={r.metric} className="hover:bg-mh-surface/40 transition-colors">
                  <td className="px-5 py-4 text-mh-text font-medium">{r.metric}</td>
                  <td className="px-5 py-4 text-right text-mh-muted">
                    {r.target > 0 ? r.target.toLocaleString() : <span className="italic text-xs">Not set</span>}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <span
                      className="font-semibold"
                      style={{ color: r.pct !== null && r.pct >= 100 ? '#FFD700' : undefined }}
                    >
                      {r.actual.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <PctBar pct={r.target > 0 ? r.pct : null} />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-mh-muted text-sm">
                    No targets set for this month. Use <code className="text-xs bg-mh-surface px-1.5 py-0.5 rounded">/mh targets set</code> in Discord.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[11px] text-mh-muted">
        {period === 'weekly'
          ? 'Weekly figures derived as monthly ÷ 4.'
          : 'Monthly figures from the Targets sheet and live Zoho/Sheets data.'}
        {' '}Set targets via <code className="text-xs bg-mh-surface px-1 py-0.5 rounded">/mh targets set &lt;metric&gt; &lt;value&gt;</code> in Discord.
      </p>
    </div>
  )
}
