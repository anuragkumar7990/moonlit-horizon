'use client'
import { useState, useEffect, useMemo } from 'react'
import type { UpdateEvent } from '@/app/api/updates/route'

const TYPE_META: Record<UpdateEvent['type'], { emoji: string; color: string; label: string }> = {
  call:    { emoji: '📞', color: '#60A5FA', label: 'Call' },
  meeting: { emoji: '🤝', color: '#A78BFA', label: 'Meeting' },
  note:    { emoji: '📝', color: '#34D399', label: 'Notes' },
  payment: { emoji: '💰', color: '#22C55E', label: 'Payment' },
  intel:   { emoji: '🧠', color: '#F59E0B', label: 'Intel' },
}

function relativeTime(ts: string): string {
  if (!ts) return '—'
  const d = new Date(ts)
  if (isNaN(d.getTime())) return ts.slice(0, 10)
  const diff = Math.floor((Date.now() - d.getTime()) / 1000)
  if (diff < 60)      return 'just now'
  if (diff < 3600)    return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400)   return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800)  return `${Math.floor(diff / 86400)}d ago`
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function formatDate(ts: string): string {
  if (!ts) return '—'
  const d = new Date(ts)
  if (isNaN(d.getTime())) return ts.slice(0, 10)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function groupByDate(events: UpdateEvent[]): Map<string, UpdateEvent[]> {
  const map = new Map<string, UpdateEvent[]>()
  for (const e of events) {
    const day = e.timestamp?.slice(0, 10) || 'Unknown'
    if (!map.has(day)) map.set(day, [])
    map.get(day)!.push(e)
  }
  return map
}

export default function UpdatesModule() {
  const [events, setEvents]         = useState<UpdateEvent[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<UpdateEvent['type'] | 'all'>('all')
  const [search, setSearch]         = useState('')
  const [page, setPage]             = useState(0)
  const PAGE_DAYS = 14

  useEffect(() => {
    fetch('/api/updates')
      .then(r => r.json())
      .then((d: { events?: UpdateEvent[]; error?: string }) => {
        if (d.error) { setError(d.error); return }
        setEvents(d.events ?? [])
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: events.length }
    for (const e of events) c[e.type] = (c[e.type] ?? 0) + 1
    return c
  }, [events])

  const filtered = useMemo(() => {
    let list = events
    if (typeFilter !== 'all') list = list.filter(e => e.type === typeFilter)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(e =>
        e.title.toLowerCase().includes(q) ||
        e.subtitle.toLowerCase().includes(q) ||
        (e.meta ?? '').toLowerCase().includes(q)
      )
    }
    return list
  }, [events, typeFilter, search])

  // Group by date; paginate by days
  const grouped = useMemo(() => groupByDate(filtered), [filtered])
  const allDays = useMemo(() => Array.from(grouped.keys()).sort((a, b) => b.localeCompare(a)), [grouped])
  const visibleDays = allDays.slice(page * PAGE_DAYS, (page + 1) * PAGE_DAYS)
  const totalPages = Math.ceil(allDays.length / PAGE_DAYS)

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-6 h-6 border-2 border-mh-vermillion border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (error) return <div className="card text-red-400 text-sm">{error}</div>

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0) }}
          className="flex-1 max-w-xs bg-mh-surface border border-mh-border rounded-lg px-3 py-1.5 text-xs
            text-mh-text placeholder:text-mh-muted outline-none focus:border-mh-vermillion transition-colors"
        />

        <div className="flex items-center gap-1 bg-mh-surface border border-mh-border rounded-full p-1">
          <button
            onClick={() => { setTypeFilter('all'); setPage(0) }}
            className={`text-xs px-3 py-1 rounded-full font-medium transition-colors
              ${typeFilter === 'all' ? 'bg-mh-vermillion text-white' : 'text-mh-muted hover:text-mh-text'}`}
          >
            All {counts.all}
          </button>
          {(['call', 'meeting', 'note', 'payment'] as const).map(t => (
            <button
              key={t}
              onClick={() => { setTypeFilter(t); setPage(0) }}
              className={`text-xs px-3 py-1 rounded-full font-medium transition-colors
                ${typeFilter === t ? 'bg-mh-vermillion text-white' : 'text-mh-muted hover:text-mh-text'}`}
            >
              {TYPE_META[t].emoji} {TYPE_META[t].label} {counts[t] ?? 0}
            </button>
          ))}
        </div>

        <span className="text-xs text-mh-muted ml-auto">{filtered.length} events</span>
      </div>

      {/* Activity feed */}
      {filtered.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-mh-muted text-sm italic">No updates found.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {visibleDays.map(day => {
            const dayEvents = grouped.get(day) ?? []
            return (
              <div key={day}>
                {/* Day header */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-px flex-1 bg-mh-border" />
                  <span className="text-[11px] font-semibold text-mh-muted uppercase tracking-widest whitespace-nowrap">
                    {formatDate(day)}
                    <span className="ml-2 text-mh-border">·</span>
                    <span className="ml-2 text-mh-muted font-normal">{dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}</span>
                  </span>
                  <div className="h-px flex-1 bg-mh-border" />
                </div>

                {/* Events for this day */}
                <div className="space-y-1.5">
                  {dayEvents.map(e => {
                    const meta = TYPE_META[e.type]
                    return (
                      <div
                        key={e.id}
                        className="card py-3 px-4 flex items-start gap-3 hover:border-mh-border/60 transition-colors"
                      >
                        {/* Type icon */}
                        <div
                          className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-base mt-0.5"
                          style={{ backgroundColor: meta.color + '18' }}
                        >
                          {meta.emoji}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <span className="text-sm font-medium text-mh-text">{e.title}</span>
                              {e.meta && (
                                <span className="text-xs text-mh-muted ml-2">{e.meta}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span
                                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                                style={{ backgroundColor: meta.color + '18', color: meta.color }}
                              >
                                {meta.label}
                              </span>
                              <span className="text-[10px] text-mh-muted whitespace-nowrap">
                                {relativeTime(e.timestamp)}
                              </span>
                            </div>
                          </div>
                          <p className="text-xs text-mh-muted mt-0.5 leading-relaxed line-clamp-2">{e.subtitle}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-mh-muted pt-2">
          <span>Showing days {page * PAGE_DAYS + 1}–{Math.min((page + 1) * PAGE_DAYS, allDays.length)} of {allDays.length}</span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 rounded border border-mh-border hover:text-mh-text disabled:opacity-40 transition-colors"
            >
              ← Newer
            </button>
            <span className="px-3 py-1.5 text-mh-text font-medium">{page + 1} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="px-3 py-1.5 rounded border border-mh-border hover:text-mh-text disabled:opacity-40 transition-colors"
            >
              Older →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
