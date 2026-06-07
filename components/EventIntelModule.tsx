'use client'
import { useState, useEffect } from 'react'

interface LumaEvent {
  id: string
  name: string
  startAt: string
  endAt: string
  coverUrl?: string
  url: string
  guestCount: number
  status: string
  location?: string
}

interface LumaResponse {
  configured: boolean
  events: LumaEvent[]
  fetchedAt?: string
  message?: string
  error?: string
}

function formatDate(iso: string) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
      timeZone: 'Asia/Kolkata',
    })
  } catch { return iso }
}

function StatusBadge({ status }: { status: string }) {
  const isPast = status === 'Past'
  return (
    <span
      className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
      style={{
        color: isPast ? '#9CA3AF' : '#22C55E',
        backgroundColor: isPast ? '#9CA3AF22' : '#22C55E22',
      }}
    >
      {status}
    </span>
  )
}

export default function EventIntelModule() {
  const [data, setData] = useState<LumaResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [relevant, setRelevant] = useState<Record<string, boolean>>(() => {
    try {
      const s = localStorage.getItem('mh_event_relevant')
      return s ? JSON.parse(s) : {}
    } catch { return {} }
  })
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('all')
  const [addingToProspects, setAddingToProspects] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/luma-events')
      .then(r => r.json())
      .then((d: LumaResponse) => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  function markRelevant(id: string, val: boolean) {
    const updated = { ...relevant, [id]: val }
    setRelevant(updated)
    try { localStorage.setItem('mh_event_relevant', JSON.stringify(updated)) } catch { /* ignore */ }
  }

  async function addToProspects(event: LumaEvent) {
    setAddingToProspects(event.id)
    await new Promise(r => setTimeout(r, 800))
    setAddingToProspects(null)
    alert(`Event "${event.name}" marked as relevant for Corporate Training.\n\nTo import leads: download attendee CSV from Luma and upload via the Prospect Database tab with Lvl 1 Source = "Events".`)
  }

  const events = (data?.events ?? []).filter(e => {
    if (filter === 'upcoming') return e.status === 'Upcoming'
    if (filter === 'past') return e.status === 'Past'
    return true
  })

  if (loading) {
    return (
      <div className="py-16 text-center text-mh-muted text-sm">Loading Luma events…</div>
    )
  }

  if (!data?.configured) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="w-12 h-12 rounded-full bg-mh-surface border border-mh-border flex items-center justify-center">
          <svg className="w-6 h-6 text-mh-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <p className="text-mh-text text-sm font-medium">Luma not configured</p>
        <p className="text-xs text-mh-muted max-w-sm text-center">
          {data?.message ?? 'Add LUMA_API_KEY and LUMA_CALENDAR_API_ID to your Vercel environment variables to connect The Test Tribe Luma calendar.'}
        </p>
        <div className="bg-mh-surface border border-mh-border rounded-lg px-4 py-3 text-xs text-mh-muted font-mono space-y-1">
          <div>LUMA_API_KEY=luma-xxx</div>
          <div>LUMA_CALENDAR_API_ID=cal-xxx</div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-mh-text">Event Intelligence</h2>
          <p className="text-xs text-mh-muted mt-0.5">
            {events.length} events · {data.events.filter(e => e.status === 'Upcoming').length} upcoming
            {data.fetchedAt && ` · synced ${new Date(data.fetchedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })} IST`}
          </p>
        </div>
        <div className="flex gap-0 border border-mh-border rounded-lg overflow-hidden">
          {(['all', 'upcoming', 'past'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 text-xs font-medium transition-colors capitalize
                ${filter === f ? 'bg-mh-vermillion text-white' : 'text-mh-muted hover:text-mh-text'}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Events', value: data.events.length },
          { label: 'Upcoming', value: data.events.filter(e => e.status === 'Upcoming').length },
          { label: 'Total Attendees', value: data.events.reduce((s, e) => s + e.guestCount, 0).toLocaleString() },
          { label: 'CT Relevant', value: Object.values(relevant).filter(Boolean).length },
        ].map(({ label, value }) => (
          <div key={label} className="card">
            <p className="text-[10px] font-semibold text-mh-vermillion uppercase tracking-widest mb-2">{label}</p>
            <p className="text-3xl font-semibold text-mh-text">{value}</p>
          </div>
        ))}
      </div>

      {/* Events table */}
      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-mh-border bg-mh-surface">
              <th className="text-left px-5 py-3 text-[10px] font-semibold text-mh-muted uppercase tracking-widest">Event</th>
              <th className="text-left px-4 py-3 text-[10px] font-semibold text-mh-muted uppercase tracking-widest">Date</th>
              <th className="text-left px-4 py-3 text-[10px] font-semibold text-mh-muted uppercase tracking-widest">Location</th>
              <th className="text-right px-4 py-3 text-[10px] font-semibold text-mh-muted uppercase tracking-widest">Attendees</th>
              <th className="text-center px-4 py-3 text-[10px] font-semibold text-mh-muted uppercase tracking-widest">Status</th>
              <th className="text-center px-4 py-3 text-[10px] font-semibold text-mh-muted uppercase tracking-widest">CT Relevant?</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-mh-border">
            {events.map(event => {
              const isRelevant = relevant[event.id] === true
              const isLoading = addingToProspects === event.id
              return (
                <tr key={event.id} className="hover:bg-mh-surface/40 transition-colors">
                  <td className="px-5 py-3.5">
                    <a
                      href={event.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-mh-text font-medium hover:text-mh-vermillion transition-colors"
                    >
                      {event.name}
                    </a>
                  </td>
                  <td className="px-4 py-3.5 text-mh-muted text-xs whitespace-nowrap">{formatDate(event.startAt)}</td>
                  <td className="px-4 py-3.5 text-mh-muted text-xs">{event.location ?? 'Online'}</td>
                  <td className="px-4 py-3.5 text-right text-mh-text font-semibold">{event.guestCount.toLocaleString()}</td>
                  <td className="px-4 py-3.5 text-center"><StatusBadge status={event.status} /></td>
                  <td className="px-4 py-3.5 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => markRelevant(event.id, true)}
                        className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors font-semibold
                          ${isRelevant
                            ? 'bg-green-500/20 border-green-500/40 text-green-400'
                            : 'border-mh-border text-mh-muted hover:border-green-500/40 hover:text-green-400'}`}
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => markRelevant(event.id, false)}
                        className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors font-semibold
                          ${relevant[event.id] === false
                            ? 'bg-red-500/20 border-red-500/40 text-red-400'
                            : 'border-mh-border text-mh-muted hover:border-red-500/40 hover:text-red-400'}`}
                      >
                        No
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    {isRelevant && event.status === 'Past' && (
                      <button
                        onClick={() => addToProspects(event)}
                        disabled={isLoading}
                        className="text-[11px] px-2.5 py-1 rounded-lg bg-mh-vermillion text-white font-medium
                          hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap"
                      >
                        {isLoading ? 'Adding…' : 'Add to Prospects'}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
            {events.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-mh-muted text-sm">No events found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-mh-muted">
        CT Relevant selections are saved locally. &quot;Add to Prospects&quot; appears for past relevant events — download attendee CSV from Luma and upload via Prospect Database.
      </p>
    </div>
  )
}
