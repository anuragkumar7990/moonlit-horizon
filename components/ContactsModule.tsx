'use client'
import { useState, useEffect, useMemo } from 'react'
import type { ContactIntelRow } from '@/lib/sheets'
import BookMeetingModal from './BookMeetingModal'

const CONNECTED_OUTCOMES = new Set([
  'meeting scheduled', 'interested', 'not interested', 'call back later',
  'send more info', 'callback later', 'connected', 'meeting booked',
])

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

function RateBadge({ rate }: { rate: number }) {
  const color = rate >= 50 ? '#22C55E' : rate >= 30 ? '#F59E0B' : '#9CA3AF'
  return <span className="text-xs font-semibold" style={{ color }}>{rate}%</span>
}

export default function ContactsModule() {
  const [contacts, setContacts] = useState<ContactIntelRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [search, setSearch]     = useState('')
  const [sdrFilter, setSdrFilter]     = useState('all')
  const [outcomeFilter, setOutcomeFilter] = useState('all')
  const [sort, setSort]         = useState<'name' | 'calls' | 'rate' | 'date'>('calls')
  const [page, setPage]         = useState(0)
  const [bookTarget, setBookTarget] = useState<ContactIntelRow | null>(null)
  const PAGE_SIZE = 100

  useEffect(() => {
    fetch('/api/contact-intel')
      .then(r => r.json())
      .then((d: { contacts?: ContactIntelRow[]; error?: string }) => {
        if (d.error) { setError(d.error); return }
        setContacts(d.contacts ?? [])
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  const sdrs = useMemo(
    () => Array.from(new Set(contacts.map(c => c.sdr).filter(Boolean))).sort(),
    [contacts]
  )

  const outcomes = useMemo(
    () => Array.from(new Set(contacts.map(c => c.lastCallOutcome).filter(Boolean))).sort(),
    [contacts]
  )

  const filtered = useMemo(() => {
    let list = contacts
    if (sdrFilter !== 'all')     list = list.filter(c => c.sdr === sdrFilter)
    if (outcomeFilter !== 'all') list = list.filter(c => c.lastCallOutcome === outcomeFilter)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(c =>
        c.name.toLowerCase().includes(q)     ||
        c.company.toLowerCase().includes(q)  ||
        c.email.toLowerCase().includes(q)    ||
        c.title.toLowerCase().includes(q)
      )
    }
    return list
  }, [contacts, sdrFilter, outcomeFilter, search])

  const sorted = useMemo(() => {
    const arr = [...filtered]
    if (sort === 'name')  arr.sort((a, b) => a.name.localeCompare(b.name))
    if (sort === 'calls') arr.sort((a, b) => b.totalCalls - a.totalCalls)
    if (sort === 'rate')  arr.sort((a, b) => b.connectionRate - a.connectionRate)
    if (sort === 'date')  arr.sort((a, b) => (b.lastCallDate || '').localeCompare(a.lastCallDate || ''))
    return arr
  }, [filtered, sort])

  const pageData = useMemo(
    () => sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [sorted, page]
  )

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE)

  const stats = useMemo(() => {
    const total     = contacts.length
    const called    = contacts.filter(c => c.totalCalls > 0).length
    const connected = contacts.filter(c => c.connectedCalls > 0).length
    const withMtg   = contacts.filter(c => CONNECTED_OUTCOMES.has((c.lastCallOutcome || '').toLowerCase()) && (c.lastCallOutcome || '').toLowerCase().includes('meeting')).length
    return { total, called, connected, withMtg }
  }, [contacts])

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
          accountName={bookTarget.company || bookTarget.name}
          contactName={bookTarget.name}
          contactEmail={bookTarget.email}
          contactId={bookTarget.zohoContactId || undefined}
          onClose={() => setBookTarget(null)}
        />
      )}
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Contacts',   value: stats.total.toLocaleString() },
          { label: 'Called',           value: stats.called.toLocaleString(), sub: `${Math.round(stats.called/stats.total*100)}% of total` },
          { label: 'Connected',        value: stats.connected.toLocaleString() },
          { label: 'Mtg Scheduled',    value: stats.withMtg.toLocaleString() },
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
            placeholder="Search name, company, email…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0) }}
            className="flex-1 min-w-[200px] bg-mh-bg border border-mh-border rounded-lg px-3 py-1.5 text-xs
              text-mh-text placeholder:text-mh-muted outline-none focus:border-mh-vermillion transition-colors"
          />
          <select
            value={sdrFilter}
            onChange={e => { setSdrFilter(e.target.value); setPage(0) }}
            className="bg-mh-bg border border-mh-border rounded-lg px-3 py-1.5 text-xs text-mh-text
              outline-none focus:border-mh-vermillion transition-colors"
          >
            <option value="all">All SDRs</option>
            {sdrs.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={outcomeFilter}
            onChange={e => { setOutcomeFilter(e.target.value); setPage(0) }}
            className="bg-mh-bg border border-mh-border rounded-lg px-3 py-1.5 text-xs text-mh-text
              outline-none focus:border-mh-vermillion transition-colors"
          >
            <option value="all">All outcomes</option>
            {outcomes.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <select
            value={sort}
            onChange={e => { setSort(e.target.value as typeof sort); setPage(0) }}
            className="bg-mh-bg border border-mh-border rounded-lg px-3 py-1.5 text-xs text-mh-text
              outline-none focus:border-mh-vermillion transition-colors"
          >
            <option value="calls">Sort: Most calls</option>
            <option value="rate">Sort: Highest rate</option>
            <option value="date">Sort: Recent calls</option>
            <option value="name">Sort: Name A–Z</option>
          </select>
          <span className="text-xs text-mh-muted ml-auto shrink-0">
            {filtered.length.toLocaleString()} contacts
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-mh-muted text-[10px] uppercase tracking-widest border-b border-mh-border">
              <th className="text-left pb-3 pr-4 font-semibold">Name</th>
              <th className="text-left pb-3 pr-4 font-semibold">Company</th>
              <th className="text-left pb-3 pr-4 font-semibold">Title</th>
              <th className="text-left pb-3 pr-4 font-semibold">SDR</th>
              <th className="text-right pb-3 pr-4 font-semibold">Calls</th>
              <th className="text-right pb-3 pr-4 font-semibold">Conn.</th>
              <th className="text-right pb-3 pr-4 font-semibold">Rate</th>
              <th className="text-left pb-3 pr-4 font-semibold">Last Call</th>
              <th className="text-left pb-3 pr-4 font-semibold">Last Outcome</th>
              <th className="pb-3 font-semibold"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-mh-border">
            {pageData.map((c, i) => (
              <tr key={`${c.email || i}-${c.name}`} className="hover:bg-mh-surface/40 transition-colors">
                <td className="py-2 pr-4">
                  <div className="text-mh-text font-medium text-sm leading-tight truncate max-w-[140px]">{c.name || '—'}</div>
                  <div className="text-[10px] text-mh-muted truncate max-w-[140px]">{c.email}</div>
                </td>
                <td className="py-2 pr-4 text-mh-muted text-xs max-w-[130px] truncate">{c.company || '—'}</td>
                <td className="py-2 pr-4 text-mh-muted text-xs max-w-[120px] truncate">{c.title || '—'}</td>
                <td className="py-2 pr-4 text-mh-muted text-xs whitespace-nowrap">{c.sdr || '—'}</td>
                <td className="py-2 pr-4 text-right text-mh-text font-semibold">{c.totalCalls}</td>
                <td className="py-2 pr-4 text-right text-mh-muted">{c.connectedCalls}</td>
                <td className="py-2 pr-4 text-right"><RateBadge rate={c.connectionRate} /></td>
                <td className="py-2 pr-4 text-mh-muted text-xs whitespace-nowrap">{c.lastCallDate || '—'}</td>
                <td className="py-2 pr-4"><OutcomeBadge outcome={c.lastCallOutcome} /></td>
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
          <p className="text-center text-mh-muted text-sm py-10 italic">No contacts match your filters.</p>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-mh-muted">
          <span>
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sorted.length)} of {sorted.length.toLocaleString()}
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
