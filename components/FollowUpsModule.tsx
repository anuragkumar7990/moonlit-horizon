'use client'
import { useState, useEffect, useMemo } from 'react'

interface FollowUp {
  account:      string
  contactName:  string
  contactPhone: string
  followUpDate: string
  callDate:     string
  outcome:      string
  notes:        string
  sdr:          string
  zohoCallId:   string
}

type Filter = 'all' | 'overdue' | 'today' | 'upcoming'

const OUTCOME_STYLE: Record<string, { bg: string; color: string }> = {
  'meeting scheduled':   { bg: '#16a34a18', color: '#22C55E' },
  'meeting booked':      { bg: '#16a34a18', color: '#22C55E' },
  'interested':          { bg: '#16a34a18', color: '#22C55E' },
  'callback later':      { bg: '#2563eb18', color: '#60A5FA' },
  'call back later':     { bg: '#2563eb18', color: '#60A5FA' },
  'send more info':      { bg: '#7c3aed18', color: '#A78BFA' },
  'not interested':      { bg: '#d9770618', color: '#F59E0B' },
  'connected':           { bg: '#16a34a18', color: '#22C55E' },
  'rnr':                 { bg: '#37415118', color: '#9CA3AF' },
  'no answer':           { bg: '#37415118', color: '#9CA3AF' },
  'voicemail':           { bg: '#37415118', color: '#9CA3AF' },
  'busy':                { bg: '#37415118', color: '#9CA3AF' },
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  const style = OUTCOME_STYLE[outcome.toLowerCase().trim()] ?? { bg: '#37415118', color: '#9CA3AF' }
  return (
    <span
      className="text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ backgroundColor: style.bg, color: style.color }}
    >
      {outcome || '—'}
    </span>
  )
}

function dateStatus(followUpDate: string, today: string): 'overdue' | 'today' | 'upcoming' {
  if (followUpDate < today) return 'overdue'
  if (followUpDate === today) return 'today'
  return 'upcoming'
}

function DateCell({ followUpDate, today }: { followUpDate: string; today: string }) {
  const status = dateStatus(followUpDate, today)
  const color =
    status === 'overdue' ? '#F87171' :
    status === 'today'   ? '#FCD34D' :
    '#D1D5DB'
  const label =
    status === 'overdue' ? `${followUpDate} ▲` :
    status === 'today'   ? `${followUpDate} ★` :
    followUpDate
  return (
    <span className="text-xs font-medium whitespace-nowrap" style={{ color }}>
      {label}
    </span>
  )
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-6 h-6 border-2 border-mh-vermillion border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export default function FollowUpsModule() {
  const [followUps, setFollowUps] = useState<FollowUp[]>([])
  const [loading, setLoading]     = useState(true)
  const [filter, setFilter]       = useState<Filter>('all')
  const [search, setSearch]       = useState('')

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])

  useEffect(() => {
    fetch('/api/follow-ups')
      .then(r => r.json())
      .then((d: { followUps?: FollowUp[] }) => setFollowUps(d.followUps ?? []))
      .finally(() => setLoading(false))
  }, [])

  const counts = useMemo(() => ({
    overdue:  followUps.filter(f => f.followUpDate < today).length,
    today:    followUps.filter(f => f.followUpDate === today).length,
    upcoming: followUps.filter(f => f.followUpDate > today).length,
    all:      followUps.length,
  }), [followUps, today])

  const visible = useMemo(() => {
    let list = followUps
    if (filter !== 'all') list = list.filter(f => dateStatus(f.followUpDate, today) === filter)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(f =>
        f.account.toLowerCase().includes(q) ||
        f.contactName.toLowerCase().includes(q) ||
        f.notes.toLowerCase().includes(q)
      )
    }
    return list
  }, [followUps, filter, search, today])

  if (loading) return <Spinner />

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="card flex flex-wrap items-center gap-3">
        <p className="text-[10px] font-semibold text-mh-vermillion uppercase tracking-widest mr-auto">
          Follow-Ups
        </p>
        {(['all', 'overdue', 'today', 'upcoming'] as Filter[]).map(f => {
          const count = counts[f]
          const isActive = filter === f
          const color =
            f === 'overdue'  ? (isActive ? '#F87171' : undefined) :
            f === 'today'    ? (isActive ? '#FCD34D' : undefined) :
            undefined
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1 rounded-full transition-all border capitalize ${
                isActive
                  ? 'border-current'
                  : 'text-mh-muted border-transparent hover:text-white'
              }`}
              style={isActive ? {
                color: color ?? '#E8341C',
                backgroundColor: `${color ?? '#E8341C'}18`,
                borderColor: `${color ?? '#E8341C'}40`,
              } : undefined}
            >
              {f} ({count})
            </button>
          )
        })}
        <input
          type="text"
          placeholder="Search account / contact…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="ml-auto text-xs bg-transparent border border-mh-border rounded px-3 py-1 text-mh-text placeholder:text-mh-muted focus:outline-none focus:border-mh-vermillion/50 w-48"
        />
      </div>

      {visible.length === 0 ? (
        <div className="card text-mh-muted text-sm text-center py-10">
          {followUps.length === 0 ? 'No follow-ups scheduled.' : 'No follow-ups match the current filter.'}
        </div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                {['Follow-Up', 'Account', 'Contact', 'SDR', 'Outcome', 'Notes'].map(h => (
                  <th
                    key={h}
                    className="text-left text-[10px] font-semibold text-mh-muted uppercase tracking-widest px-4 py-3"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((f, i) => (
                <tr
                  key={i}
                  className="hover:bg-white/[0.02] transition-colors"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                >
                  <td className="px-4 py-3 align-top">
                    <DateCell followUpDate={f.followUpDate} today={today} />
                    <p className="text-[10px] text-mh-muted mt-0.5">called {f.callDate}</p>
                  </td>
                  <td className="px-4 py-3 text-mh-text align-top whitespace-nowrap max-w-[160px] truncate">
                    {f.account || '—'}
                  </td>
                  <td className="px-4 py-3 align-top whitespace-nowrap">
                    <p className="text-mh-text text-xs">{f.contactName || '—'}</p>
                    {f.contactPhone && (
                      <p className="text-[10px] text-mh-muted mt-0.5">{f.contactPhone}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-mh-muted text-xs align-top whitespace-nowrap">
                    {f.sdr || '—'}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <OutcomeBadge outcome={f.outcome} />
                  </td>
                  <td className="px-4 py-3 text-mh-muted text-xs align-top max-w-xs">
                    <p className="line-clamp-2">{f.notes || '—'}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
