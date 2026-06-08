'use client'
import { useState, useEffect, useMemo } from 'react'
import type { EnrichedContact } from '@/app/api/contacts/route'
import BookMeetingModal from './BookMeetingModal'

function StageBadge({ stage }: { stage: string }) {
  if (!stage) return <span className="text-mh-muted text-xs">—</span>
  const s = stage.toLowerCase()
  let color = '#9CA3AF'
  if (s.includes('proposal') || s.includes('presentation')) color = '#60A5FA'
  else if (s.includes('negotiat') || s.includes('value')) color = '#A78BFA'
  else if (s.includes('closed won') || s.includes('won')) color = '#22C55E'
  else if (s.includes('closed lost') || s.includes('lost')) color = '#F87171'
  else if (s.includes('qualify') || s.includes('interest')) color = '#F59E0B'
  return (
    <span
      className="text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap"
      style={{ backgroundColor: color + '22', color }}
    >
      {stage}
    </span>
  )
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  const o = outcome.toLowerCase().trim()
  let color = '#9CA3AF'
  if (o.includes('meeting') || o === 'interested' || o === 'connected') color = '#22C55E'
  else if (o.includes('callback') || o.includes('call back')) color = '#60A5FA'
  else if (o.includes('more info') || o.includes('send more')) color = '#A78BFA'
  else if (o === 'not interested') color = '#F59E0B'
  return (
    <span
      className="text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap"
      style={{ backgroundColor: color + '22', color }}
    >
      {outcome || '—'}
    </span>
  )
}

export default function ContactsModule() {
  const [contacts, setContacts] = useState<EnrichedContact[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [search, setSearch]     = useState('')
  const [stageFilter, setStageFilter] = useState('all')
  const [sort, setSort]         = useState<'name' | 'date' | 'stage' | 'calls'>('name')
  const [page, setPage]         = useState(0)
  const [bookTarget, setBookTarget] = useState<EnrichedContact | null>(null)
  const PAGE_SIZE = 50

  useEffect(() => {
    fetch('/api/contacts')
      .then(r => r.json())
      .then((d: { contacts?: EnrichedContact[]; error?: string }) => {
        if (d.error) { setError(d.error); return }
        setContacts(d.contacts ?? [])
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  const stages = useMemo(
    () => Array.from(new Set(contacts.map(c => c.zohoStage).filter(Boolean))).sort(),
    [contacts]
  )

  const filtered = useMemo(() => {
    let list = contacts
    if (stageFilter !== 'all') list = list.filter(c => c.zohoStage === stageFilter)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.accountName.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q)
      )
    }
    return list
  }, [contacts, stageFilter, search])

  const sorted = useMemo(() => {
    const arr = [...filtered]
    if (sort === 'name')  arr.sort((a, b) => a.name.localeCompare(b.name))
    if (sort === 'date')  arr.sort((a, b) => (b.lastCallDate || '').localeCompare(a.lastCallDate || ''))
    if (sort === 'stage') arr.sort((a, b) => (a.zohoStage || '').localeCompare(b.zohoStage || ''))
    if (sort === 'calls') arr.sort((a, b) => b.totalCalls - a.totalCalls)
    return arr
  }, [filtered, sort])

  const pageData = useMemo(
    () => sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [sorted, page]
  )
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE)

  const stats = useMemo(() => ({
    total:     contacts.length,
    withStage: contacts.filter(c => c.zohoStage).length,
    withCalls: contacts.filter(c => c.totalCalls > 0).length,
    connected: contacts.filter(c => c.connectedCalls > 0).length,
  }), [contacts])

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-6 h-6 border-2 border-mh-vermillion border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (error) return <div className="card text-red-400 text-sm">{error}</div>

  return (
    <div className="space-y-4">
      {bookTarget && (
        <BookMeetingModal
          accountName={bookTarget.accountName || bookTarget.name}
          contactName={bookTarget.name}
          contactEmail={bookTarget.email}
          contactId={bookTarget.id}
          onClose={() => setBookTarget(null)}
        />
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Contacts', value: stats.total },
          { label: 'Active Deals',   value: stats.withStage, sub: 'with a deal stage set' },
          { label: 'Called',         value: stats.withCalls, sub: 'at least 1 call logged' },
          { label: 'Connected',      value: stats.connected, sub: 'at least 1 connection' },
        ].map(({ label, value, sub }) => (
          <div key={label} className="card">
            <p className="text-[10px] font-semibold text-mh-vermillion uppercase tracking-widest mb-2">{label}</p>
            <p className="text-3xl font-semibold text-mh-text">{value}</p>
            {sub && <p className="text-xs text-mh-muted mt-1">{sub}</p>}
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search name, account, email, title…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0) }}
            className="flex-1 min-w-[200px] bg-mh-bg border border-mh-border rounded-lg px-3 py-1.5 text-xs
              text-mh-text placeholder:text-mh-muted outline-none focus:border-mh-vermillion transition-colors"
          />
          <select
            value={stageFilter}
            onChange={e => { setStageFilter(e.target.value); setPage(0) }}
            style={{ color: '#E5E7EB', background: '#0d0d1a' }}
            className="border border-mh-border rounded-lg px-3 py-1.5 text-xs
              outline-none focus:border-mh-vermillion transition-colors"
          >
            <option value="all" style={{ background: '#0d0d1a' }}>All stages</option>
            {stages.map(s => <option key={s} value={s} style={{ background: '#0d0d1a' }}>{s}</option>)}
          </select>
          <select
            value={sort}
            onChange={e => { setSort(e.target.value as typeof sort); setPage(0) }}
            style={{ color: '#E5E7EB', background: '#0d0d1a' }}
            className="border border-mh-border rounded-lg px-3 py-1.5 text-xs
              outline-none focus:border-mh-vermillion transition-colors"
          >
            <option value="name" style={{ background: '#0d0d1a' }}>Sort: Name A–Z</option>
            <option value="date" style={{ background: '#0d0d1a' }}>Sort: Recent activity</option>
            <option value="stage" style={{ background: '#0d0d1a' }}>Sort: Deal stage</option>
            <option value="calls" style={{ background: '#0d0d1a' }}>Sort: Most calls</option>
          </select>
          <span className="text-xs text-mh-muted ml-auto shrink-0">
            {filtered.length} contacts
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-mh-muted text-[10px] uppercase tracking-widest border-b border-mh-border">
              <th className="text-left pb-3 pr-4 font-semibold">Name</th>
              <th className="text-left pb-3 pr-4 font-semibold">Account</th>
              <th className="text-left pb-3 pr-4 font-semibold">Title</th>
              <th className="text-left pb-3 pr-4 font-semibold">Phone</th>
              <th className="text-left pb-3 pr-4 font-semibold">Deal Stage</th>
              <th className="text-right pb-3 pr-4 font-semibold">Calls</th>
              <th className="text-right pb-3 pr-4 font-semibold">Rate</th>
              <th className="text-left pb-3 pr-4 font-semibold">Last Activity</th>
              <th className="text-left pb-3 pr-4 font-semibold">Last Outcome</th>
              <th className="pb-3 font-semibold"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-mh-border">
            {pageData.map((c, i) => (
              <tr key={`${c.id || i}`} className="hover:bg-mh-surface/40 transition-colors">
                <td className="py-2 pr-4">
                  <div className="text-mh-text font-medium text-sm leading-tight truncate max-w-[160px]">{c.name}</div>
                  <div className="text-[10px] text-mh-muted truncate max-w-[160px]">{c.email}</div>
                </td>
                <td className="py-2 pr-4 text-mh-muted text-xs max-w-[130px] truncate">{c.accountName || '—'}</td>
                <td className="py-2 pr-4 text-mh-muted text-xs max-w-[130px] truncate">{c.title || '—'}</td>
                <td className="py-2 pr-4 text-mh-muted text-xs whitespace-nowrap">{c.phone || '—'}</td>
                <td className="py-2 pr-4"><StageBadge stage={c.zohoStage} /></td>
                <td className="py-2 pr-4 text-right text-mh-text font-semibold text-sm">
                  {c.totalCalls > 0 ? c.totalCalls : <span className="text-mh-muted">—</span>}
                </td>
                <td className="py-2 pr-4 text-right">
                  {c.totalCalls > 0 ? (
                    <span
                      className="text-xs font-semibold"
                      style={{ color: c.connectionRate >= 50 ? '#22C55E' : c.connectionRate >= 30 ? '#F59E0B' : '#9CA3AF' }}
                    >
                      {c.connectionRate}%
                    </span>
                  ) : <span className="text-mh-muted text-xs">—</span>}
                </td>
                <td className="py-2 pr-4 text-mh-muted text-xs whitespace-nowrap">{c.lastCallDate || '—'}</td>
                <td className="py-2 pr-4">
                  {c.lastCallOutcome
                    ? <OutcomeBadge outcome={c.lastCallOutcome} />
                    : <span className="text-mh-muted text-xs">—</span>
                  }
                </td>
                <td className="py-2">
                  {c.email && (
                    <button
                      onClick={() => setBookTarget(c)}
                      className="text-[10px] px-2 py-1 rounded-md font-medium transition-all hover:opacity-90 whitespace-nowrap"
                      style={{ background: 'rgba(232,52,28,0.12)', color: '#E8341C', border: '1px solid rgba(232,52,28,0.2)' }}
                    >
                      Book
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {sorted.length === 0 && (
          <p className="text-center text-mh-muted text-sm py-10 italic">No contacts found.</p>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-mh-muted">
          <span>
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sorted.length)} of {sorted.length}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 rounded border border-mh-border hover:text-mh-text disabled:opacity-40 transition-colors"
            >
              ← Prev
            </button>
            <span className="px-3 py-1.5 text-mh-text font-medium">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="px-3 py-1.5 rounded border border-mh-border hover:text-mh-text disabled:opacity-40 transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
