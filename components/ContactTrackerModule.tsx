'use client'
import { useState, useEffect, useMemo } from 'react'
import TouchpointModal from './TouchpointModal'
import type { TrackerContact } from '@/app/api/contact-tracker/route'

const PAGE_SIZE = 50

type Filter = 'all' | 'active' | 'due' | 'overdue' | 'never'

const TYPE_COLOR: Record<string, string> = {
  Call:        '#60A5FA',
  Email:       '#A78BFA',
  'Google Meet': '#22C55E',
  WhatsApp:    '#25D366',
  'In-person': '#F59E0B',
}

function DaysBadge({ days }: { days: number | null }) {
  if (days === null) return <span className="text-mh-muted text-xs">Never</span>
  let color = '#22C55E'
  if (days > 14) color = '#F87171'
  else if (days >= 7) color = '#F59E0B'
  return <span className="text-xs font-semibold tabular-nums" style={{ color }}>{days}d ago</span>
}

function TypeBadge({ type }: { type: string | null }) {
  if (!type) return <span className="text-mh-muted text-xs">—</span>
  const color = TYPE_COLOR[type] ?? '#9CA3AF'
  return (
    <span
      className="text-[11px] font-medium px-2 py-0.5 rounded-full"
      style={{ color, background: `${color}18`, border: `1px solid ${color}30` }}
    >
      {type}
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

export default function ContactTrackerModule() {
  const [contacts, setContacts] = useState<TrackerContact[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [filter, setFilter]     = useState<Filter>('all')
  const [page, setPage]         = useState(0)
  const [modal, setModal]       = useState<TrackerContact | null>(null)

  async function loadContacts() {
    setLoading(true)
    try {
      const r = await fetch('/api/contact-tracker')
      const d = await r.json() as { contacts?: TrackerContact[] }
      setContacts(d.contacts ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadContacts() }, [])

  const filtered = useMemo(() => {
    let list = contacts
    if (filter === 'active')  list = list.filter(c => c.daysSinceContact !== null && c.daysSinceContact < 7)
    if (filter === 'due')     list = list.filter(c => c.daysSinceContact !== null && c.daysSinceContact >= 7 && c.daysSinceContact <= 14)
    if (filter === 'overdue') list = list.filter(c => c.daysSinceContact !== null && c.daysSinceContact > 14)
    if (filter === 'never')   list = list.filter(c => c.daysSinceContact === null)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.accountName.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
      )
    }
    return list
  }, [contacts, filter, search])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const visible    = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const counts = useMemo(() => ({
    all:     contacts.length,
    active:  contacts.filter(c => c.daysSinceContact !== null && c.daysSinceContact < 7).length,
    due:     contacts.filter(c => c.daysSinceContact !== null && c.daysSinceContact >= 7 && c.daysSinceContact <= 14).length,
    overdue: contacts.filter(c => c.daysSinceContact !== null && c.daysSinceContact > 14).length,
    never:   contacts.filter(c => c.daysSinceContact === null).length,
  }), [contacts])

  const FILTERS: { id: Filter; label: string }[] = [
    { id: 'all',     label: `All (${counts.all})` },
    { id: 'active',  label: `Active <7d (${counts.active})` },
    { id: 'due',     label: `Due 7–14d (${counts.due})` },
    { id: 'overdue', label: `Overdue >14d (${counts.overdue})` },
    { id: 'never',   label: `Never (${counts.never})` },
  ]

  if (loading) return <Spinner />

  return (
    <>
      {modal && (
        <TouchpointModal
          contactName={modal.name}
          email={modal.email}
          onClose={() => setModal(null)}
          onSuccess={() => { setModal(null); loadContacts() }}
        />
      )}

      <div className="space-y-4">
        {/* Header row */}
        <div className="card flex flex-wrap items-center gap-3">
          <p className="text-[10px] font-semibold text-mh-vermillion uppercase tracking-widest">Follow Up Tracker</p>
          <span className="text-xs text-mh-muted">{contacts.length} contacts</span>
          {/* Search */}
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0) }}
            placeholder="Search name, account, email…"
            className="ml-auto text-xs px-3 py-1.5 rounded border border-mh-border bg-transparent text-mh-text placeholder:text-mh-muted focus:outline-none focus:border-mh-vermillion/50 w-64"
          />
        </div>

        {/* Filter pills */}
        <div className="flex flex-wrap gap-2">
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => { setFilter(f.id); setPage(0) }}
              className={`text-xs px-3 py-1 rounded-full border transition-all ${
                filter === f.id
                  ? 'bg-mh-vermillion/20 text-mh-vermillion border-mh-vermillion/40'
                  : 'text-mh-muted border-transparent hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Table */}
        {visible.length === 0 ? (
          <div className="card text-mh-muted text-sm text-center py-10">No contacts match this filter.</div>
        ) : (
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  {['Contact', 'Account', 'Phone', 'Email', 'Last Contact', 'Days Since', 'Channel', ''].map(h => (
                    <th key={h} className="text-left text-[10px] font-semibold text-mh-muted uppercase tracking-widest px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((c, i) => (
                  <tr key={i} className="hover:bg-white/[0.02] transition-colors" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td className="px-4 py-3 align-top">
                      <p className="text-mh-text text-sm font-medium whitespace-nowrap">{c.name}</p>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <p className="text-mh-muted text-xs whitespace-nowrap">{c.accountName || '—'}</p>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <p className="text-mh-muted text-xs whitespace-nowrap">{c.phone || '—'}</p>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <p className="text-mh-muted text-xs">{c.email || '—'}</p>
                    </td>
                    <td className="px-4 py-3 align-top whitespace-nowrap">
                      <p className="text-mh-muted text-xs">{c.lastContactDate || '—'}</p>
                    </td>
                    <td className="px-4 py-3 align-top whitespace-nowrap">
                      <DaysBadge days={c.daysSinceContact} />
                    </td>
                    <td className="px-4 py-3 align-top whitespace-nowrap">
                      <TypeBadge type={c.lastTouchpointType} />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <button
                        onClick={() => setModal(c)}
                        className="text-[11px] px-2.5 py-1 rounded border border-white/10 text-mh-muted hover:text-white hover:border-white/25 transition-all whitespace-nowrap"
                      >
                        Log
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-xs text-mh-muted">
            <span>Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1 rounded border border-mh-border hover:text-white disabled:opacity-40 transition-all"
              >
                Prev
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page === totalPages - 1}
                className="px-3 py-1 rounded border border-mh-border hover:text-white disabled:opacity-40 transition-all"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
