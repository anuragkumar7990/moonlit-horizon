'use client'
import { useState, useMemo } from 'react'
import {
  startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  isWithinInterval, parseISO, format,
} from 'date-fns'
import type { Call, Meeting } from '@/lib/types'

type Period = 'daily' | 'weekly' | 'monthly' | 'all'

const NOT_CONNECTED_KEYWORDS = [
  'rnr', 'rang no response', 'switched off', 'unreachable',
  'wrong number', 'incoming not available', 'no answer',
  'voicemail', 'busy', 'not reachable', 'unanswered',
]

function isConnected(outcome: string): boolean {
  const o = outcome.toLowerCase().trim()
  if (!o) return false
  return !NOT_CONNECTED_KEYWORDS.some(kw => o.includes(kw))
}

function safeParse(d: string): Date | null {
  if (!d) return null
  try { return parseISO(d) } catch { return null }
}

function filterByPeriod(calls: Call[], period: Period): Call[] {
  if (period === 'all') return calls
  const now = new Date()
  let start: Date, end: Date
  if (period === 'daily') {
    start = startOfDay(now); end = endOfDay(now)
  } else if (period === 'weekly') {
    start = startOfWeek(now, { weekStartsOn: 1 })
    end   = endOfWeek(now,   { weekStartsOn: 1 })
  } else {
    start = startOfMonth(now); end = endOfMonth(now)
  }
  return calls.filter(c => {
    const d = safeParse(c.date)
    return d && isWithinInterval(d, { start, end })
  })
}

const OUTCOME_STYLE: Record<string, { bg: string; color: string }> = {
  'meeting scheduled':      { bg: '#16a34a18', color: '#22C55E' },
  'scheduled a meeting':    { bg: '#16a34a18', color: '#22C55E' },
  'interested':             { bg: '#16a34a18', color: '#22C55E' },
  'call back later':        { bg: '#2563eb18', color: '#60A5FA' },
  'callback later':         { bg: '#2563eb18', color: '#60A5FA' },
  'send more info':         { bg: '#7c3aed18', color: '#A78BFA' },
  'not interested':         { bg: '#d9770618', color: '#F59E0B' },
  'connected':              { bg: '#16a34a18', color: '#22C55E' },
  'rnr':                    { bg: '#37415118', color: '#9CA3AF' },
  'rang no response':       { bg: '#37415118', color: '#9CA3AF' },
  'no answer':              { bg: '#37415118', color: '#9CA3AF' },
  'voicemail':              { bg: '#37415118', color: '#9CA3AF' },
  'busy':                   { bg: '#37415118', color: '#9CA3AF' },
  'not reachable':          { bg: '#37415118', color: '#9CA3AF' },
  'unanswered':             { bg: '#37415118', color: '#9CA3AF' },
  'wrong number':           { bg: '#dc262618', color: '#F87171' },
  'incoming not available': { bg: '#dc262618', color: '#F87171' },
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  const key = outcome.toLowerCase().trim()
  const style = OUTCOME_STYLE[key] ?? { bg: '#37415118', color: '#9CA3AF' }
  return (
    <span
      className="text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ backgroundColor: style.bg, color: style.color }}
    >
      {outcome || '—'}
    </span>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card">
      <p className="text-[10px] font-semibold text-mh-vermillion uppercase tracking-widest mb-2">{label}</p>
      <p className="text-3xl font-semibold text-mh-text">{value}</p>
      {sub && <p className="text-xs text-mh-muted mt-1">{sub}</p>}
    </div>
  )
}

const NO_DURATION_FILTER = '__no_duration__'

export default function CallingModule({ calls, meetings }: { calls: Call[]; meetings: Meeting[] }) {
  const [period, setPeriod] = useState<Period>('weekly')
  const [search, setSearch] = useState('')
  const [outcomeFilter, setOutcomeFilter] = useState('all')
  const [creatingZoho, setCreatingZoho] = useState<Set<string>>(new Set())
  const [zohoStatus, setZohoStatus] = useState<Map<string, 'created' | 'exists'>>(new Map())

  const periodCalls = useMemo(() => filterByPeriod(calls, period), [calls, period])

  const stats = useMemo(() => {
    const dialled   = periodCalls.length
    const connected = periodCalls.filter(c => isConnected(c.outcome)).length
    const bookedCalls = periodCalls.filter(c => {
      const o = c.outcome.toLowerCase()
      return o.includes('meeting') || o.includes('scheduled')
    })
    // An account with any entry in the Meetings sheet is considered L2 (already had a meeting)
    const accountsWithMeetings = new Set(meetings.map(m => m.accountName.toLowerCase().trim()))
    const l1Booked = bookedCalls.filter(c => !accountsWithMeetings.has(c.account.toLowerCase().trim())).length
    const l2Booked = bookedCalls.filter(c =>  accountsWithMeetings.has(c.account.toLowerCase().trim())).length
    return { dialled, connected, l1Booked, l2Booked }
  }, [periodCalls, meetings])

  const { notConnectedBreakdown, connectedBreakdown } = useMemo(() => {
    const map = new Map<string, number>()
    for (const c of periodCalls) {
      const o = c.outcome || 'Unknown'
      map.set(o, (map.get(o) ?? 0) + 1)
    }
    const all = Array.from(map.entries())
      .map(([outcome, count]) => ({
        outcome,
        count,
        pct: periodCalls.length > 0 ? Math.round((count / periodCalls.length) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count)
    return {
      notConnectedBreakdown: all.filter(o => !isConnected(o.outcome)),
      connectedBreakdown:    all.filter(o =>  isConnected(o.outcome)),
    }
  }, [periodCalls])

  const allOutcomes = useMemo(
    () => Array.from(new Set(periodCalls.map(c => c.outcome).filter(Boolean))).sort(),
    [periodCalls],
  )

  const logsFiltered = useMemo(() => {
    const noDur = (c: Call) => !c.duration || c.duration === '0:00' || c.duration === '0'
    return periodCalls
      .filter(c => {
        if (c.account.toLowerCase().startsWith('untagged company')) return false
        if (outcomeFilter === NO_DURATION_FILTER) return noDur(c)
        if (outcomeFilter !== 'all' && c.outcome !== outcomeFilter) return false
        if (search) {
          const q = search.toLowerCase()
          return (
            c.account.toLowerCase().includes(q) ||
            c.contactName.toLowerCase().includes(q) ||
            (c.email ?? '').toLowerCase().includes(q) ||
            (c.sdr || 'Tanishq').toLowerCase().includes(q)
          )
        }
        return true
      })
      .sort((a, b) => {
        const dc = b.date.localeCompare(a.date)
        if (dc !== 0) return dc
        // within same date: no-duration rows first
        const aNoDur = noDur(a) ? 0 : 1
        const bNoDur = noDur(b) ? 0 : 1
        if (aNoDur !== bNoDur) return aNoDur - bNoDur
        return b.time.localeCompare(a.time)
      })
  }, [periodCalls, search, outcomeFilter])

  async function handleCreateZoho(c: Call) {
    const key = c.zohoCallId || `${c.date}-${c.account}`
    setCreatingZoho(prev => new Set(prev).add(key))
    try {
      const res = await fetch('/api/calls/create-zoho-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-dashboard-password': 'thetesttribe' },
        body: JSON.stringify({ account: c.account, contactName: c.contactName, contactEmail: c.email, contactPhone: c.contactPhone }),
      })
      const data = await res.json() as { existing?: boolean }
      setZohoStatus(prev => new Map(prev).set(key, data.existing ? 'exists' : 'created'))
    } catch {
      /* silent fail */
    } finally {
      setCreatingZoho(prev => { const s = new Set(prev); s.delete(key); return s })
    }
  }

  return (
    <div>
      {/* Period toggle */}
      <div className="flex items-center justify-end mb-6">
        <div className="flex items-center gap-1 bg-mh-surface border border-mh-border rounded-full p-1">
          {(['daily', 'weekly', 'monthly', 'all'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`text-xs px-4 py-1.5 rounded-full font-medium capitalize transition-colors
                ${period === p ? 'bg-mh-vermillion text-white' : 'text-mh-muted hover:text-mh-text'}`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <StatCard label="Dialled"             value={stats.dialled} />
        <StatCard label="Connected"           value={stats.connected} sub={stats.dialled > 0 ? `${Math.round((stats.connected / stats.dialled) * 100)}% of calls` : undefined} />
        <StatCard label="Not Connected"       value={stats.dialled - stats.connected} sub={stats.dialled > 0 ? `${Math.round(((stats.dialled - stats.connected) / stats.dialled) * 100)}% of calls` : undefined} />
        <StatCard label="L1 Meetings Booked"  value={stats.l1Booked} />
        <StatCard label="L2 Meetings Booked"  value={stats.l2Booked} />
      </div>

      {/* Outcome breakdown */}
      <div className="card mb-6">
        <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest mb-5">Outcome Breakdown</p>
        {notConnectedBreakdown.length === 0 && connectedBreakdown.length === 0 ? (
          <p className="text-mh-muted text-sm italic">No calls in this period.</p>
        ) : (
          <div className="space-y-6">

            {/* Not Connected */}
            {notConnectedBreakdown.length > 0 && (() => {
              const total = notConnectedBreakdown.reduce((s, o) => s + o.count, 0)
              const pctOfAll = periodCalls.length > 0 ? Math.round((total / periodCalls.length) * 100) : 0
              return (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-mh-muted uppercase tracking-wide">Not Connected</p>
                    <span className="text-xs text-mh-muted tabular-nums">{total} calls · {pctOfAll}% of total</span>
                  </div>
                  <div className="space-y-2.5">
                    {notConnectedBreakdown.map(({ outcome, count, pct }) => (
                      <div key={outcome}>
                        <div className="flex items-center justify-between mb-1">
                          <OutcomeBadge outcome={outcome} />
                          <span className="text-sm font-semibold text-mh-text tabular-nums">
                            {count} <span className="text-mh-muted font-normal text-xs">({pct}%)</span>
                          </span>
                        </div>
                        <div className="h-1.5 bg-[#1c1c1c] rounded-full">
                          <div className="h-1.5 rounded-full transition-all"
                            style={{ width: `${pct}%`, backgroundColor: OUTCOME_STYLE[outcome.toLowerCase().trim()]?.color ?? '#9CA3AF' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* Connected */}
            {connectedBreakdown.length > 0 && (() => {
              const total = connectedBreakdown.reduce((s, o) => s + o.count, 0)
              const pctOfAll = periodCalls.length > 0 ? Math.round((total / periodCalls.length) * 100) : 0
              return (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-mh-muted uppercase tracking-wide">Connected</p>
                    <span className="text-xs text-mh-muted tabular-nums">{total} calls · {pctOfAll}% of total</span>
                  </div>
                  <div className="space-y-2.5">
                    {connectedBreakdown.map(({ outcome, count, pct }) => {
                      const isMtg = outcome.toLowerCase().includes('meeting') || outcome.toLowerCase().includes('scheduled')
                      return (
                        <div key={outcome} className={isMtg ? 'bg-emerald-900/10 rounded-lg px-2 py-2 -mx-2' : ''}>
                          <div className="flex items-center justify-between mb-1">
                            <OutcomeBadge outcome={outcome} />
                            <span className={`font-semibold text-mh-text tabular-nums ${isMtg ? 'text-base' : 'text-sm'}`}>
                              {count} <span className="text-mh-muted font-normal text-xs">({pct}%)</span>
                            </span>
                          </div>
                          <div className={`${isMtg ? 'h-2' : 'h-1.5'} bg-[#1c1c1c] rounded-full`}>
                            <div className={`${isMtg ? 'h-2' : 'h-1.5'} rounded-full transition-all`}
                              style={{ width: `${pct}%`, backgroundColor: OUTCOME_STYLE[outcome.toLowerCase().trim()]?.color ?? '#9CA3AF' }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}

          </div>
        )}
      </div>

      {/* Calls log */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest">
            Calls Log
            <span className="ml-2 text-mh-text font-semibold">{logsFiltered.length}</span>
          </p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search account, contact, email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="text-xs bg-mh-surface border border-mh-border rounded-lg px-3 py-1.5
                text-mh-text placeholder:text-mh-muted outline-none focus:border-mh-vermillion w-52 transition-colors"
            />
            <select
              value={outcomeFilter}
              onChange={e => setOutcomeFilter(e.target.value)}
              style={{ color: '#E5E7EB', background: '#0d0d1a' }}
              className="text-xs border border-mh-border rounded-lg px-3 py-1.5
                outline-none focus:border-mh-vermillion transition-colors"
            >
              <option value="all" style={{ background: '#0d0d1a' }}>All outcomes</option>
              <option value={NO_DURATION_FILTER} style={{ background: '#0d0d1a' }}>No Duration</option>
              {allOutcomes.map(o => <option key={o} value={o} style={{ background: '#0d0d1a' }}>{o}</option>)}
            </select>
          </div>
        </div>

        {logsFiltered.length === 0 ? (
          <p className="text-mh-muted text-sm italic text-center py-10">No calls match your filters.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-mh-muted text-[10px] uppercase tracking-widest border-b border-mh-border">
                    <th className="text-left pb-2 pr-4 font-semibold">Date</th>
                    <th className="text-left pb-2 pr-4 font-semibold">Account</th>
                    <th className="text-left pb-2 pr-4 font-semibold">Contact</th>
                    <th className="text-left pb-2 pr-4 font-semibold">Designation</th>
                    <th className="text-left pb-2 pr-4 font-semibold">Phone</th>
                    <th className="text-left pb-2 pr-4 font-semibold">Email</th>
                    <th className="text-left pb-2 pr-4 font-semibold">SDR</th>
                    <th className="text-left pb-2 pr-4 font-semibold">Duration</th>
                    <th className="text-left pb-2 pr-4 font-semibold">Outcome</th>
                    <th className="text-left pb-2 pr-4 font-semibold">Create in Zoho</th>
                    <th className="text-left pb-2 font-semibold">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-mh-border">
                  {logsFiltered.slice(0, 150).map((c, i) => {
                    const d = safeParse(c.date)
                    const noDur = !c.duration || c.duration === '0:00' || c.duration === '0'
                    const isMeetingOutcome = c.outcome.toLowerCase().includes('meeting') || c.outcome.toLowerCase().includes('scheduled')
                    const zohoKey = c.zohoCallId || `${c.date}-${c.account}`
                    const zohoSt = zohoStatus.get(zohoKey)
                    const isCreating = creatingZoho.has(zohoKey)
                    return (
                      <tr
                        key={`${c.zohoCallId || i}-${c.date}-${c.account}`}
                        className={`hover:bg-mh-surface/40 transition-colors ${noDur ? 'opacity-60' : ''}`}
                      >
                        <td className="py-2 pr-4 text-mh-muted whitespace-nowrap text-xs">
                          {d ? format(d, 'dd MMM') : c.date || '—'}
                          {c.time && <span className="ml-1 opacity-60">{c.time}</span>}
                        </td>
                        <td className="py-2 pr-4 text-mh-text font-medium max-w-[140px] truncate">{c.account || '—'}</td>
                        <td className="py-2 pr-4 text-mh-muted max-w-[120px] truncate">{c.contactName || '—'}</td>
                        <td className="py-2 pr-4 text-mh-muted text-xs max-w-[120px] truncate">{c.designation || '—'}</td>
                        <td className="py-2 pr-4 text-mh-muted text-xs whitespace-nowrap">{c.contactPhone || '—'}</td>
                        <td className="py-2 pr-4 text-mh-muted text-xs max-w-[160px] truncate">{c.email || '—'}</td>
                        <td className="py-2 pr-4 text-mh-muted whitespace-nowrap text-xs">{c.sdr || 'Tanishq'}</td>
                        <td className="py-2 pr-4 text-mh-muted whitespace-nowrap text-xs">
                          {noDur ? <span className="text-orange-400 text-[10px]">no duration</span> : c.duration}
                        </td>
                        <td className="py-2 pr-4"><OutcomeBadge outcome={c.outcome} /></td>
                        <td className="py-2 pr-4">
                          {isMeetingOutcome && c.account ? (
                            zohoSt ? (
                              <span className={`text-xs font-semibold ${zohoSt === 'created' ? 'text-green-400' : 'text-mh-muted'}`}>
                                {zohoSt === 'created' ? '✓ Deal Created' : '✓ Already Exists'}
                              </span>
                            ) : (
                              <button
                                onClick={() => handleCreateZoho(c)}
                                disabled={isCreating}
                                title="Creates an Account + Deal in Zoho CRM at Discovery Call booked stage"
                                className="text-xs px-3 py-1 rounded-lg font-medium
                                  bg-mh-vermillion/10 border border-mh-vermillion/40 text-mh-vermillion
                                  hover:bg-mh-vermillion hover:text-white transition-colors disabled:opacity-40 whitespace-nowrap"
                              >
                                {isCreating ? 'Creating…' : '+ Create Deal'}
                              </button>
                            )
                          ) : (
                            <span className="text-mh-muted text-xs">—</span>
                          )}
                        </td>
                        <td className="py-2 text-mh-muted text-xs max-w-[200px] truncate" title={c.notes}>{c.notes || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {logsFiltered.length > 150 && (
              <p className="text-xs text-mh-muted text-center mt-3 pt-3 border-t border-mh-border">
                Showing 150 of {logsFiltered.length} calls
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
