'use client'
import { useState, useRef, useEffect, useCallback, useMemo, ChangeEvent } from 'react'
import type { ContactIntelRow } from '@/lib/sheets'
import BookMeetingModal from './BookMeetingModal'

const LVL1_OPTIONS: { label: string; value: string }[] = [
  { label: 'Webinar',        value: 'Webinar' },
  { label: 'Events',         value: 'Events' },
  { label: 'Email',          value: 'Email' },
  { label: 'Cold Outreach',  value: 'Cold Outreach' },
  { label: 'Referrals',      value: 'Referrals' },
  { label: 'Community Data', value: 'Internal Community Data' },
]

interface L2BreakdownEntry {
  source: string
  count: number
}

interface SourceStat {
  source: string
  count: number
  weeksOfStock: number
  l2Breakdown?: L2BreakdownEntry[]
}

interface ProspectStats {
  total: number
  totalWeeksOfStock: number
  bySource: SourceStat[]
  fetchedAt: string
}

interface UploadResponse {
  ok: boolean
  total: number
  created: number
  skipped: number
  updated: number
  excluded: number
  errors: number
  results: { row: number; status: string; reason?: string }[]
  error?: string
}

function stockColor(weeks: number): string {
  if (weeks < 2) return '#F87171'
  if (weeks < 4) return '#F59E0B'
  return '#22C55E'
}

function stockLabel(weeks: number): string {
  if (weeks < 2) return 'Low'
  if (weeks < 4) return 'OK'
  return 'Good'
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

function RateBadge({ rate }: { rate: number }) {
  const color = rate >= 50 ? '#22C55E' : rate >= 30 ? '#F59E0B' : '#9CA3AF'
  return <span className="text-xs font-semibold" style={{ color }}>{rate}%</span>
}

export default function ProspectModule() {
  // ── Stats ──────────────────────────────────────────────────────────────────
  const [stats, setStats] = useState<ProspectStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  // ── Upload (1-line) ────────────────────────────────────────────────────────
  const [file, setFile] = useState<File | null>(null)
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle')
  const [uploadResponse, setUploadResponse] = useState<UploadResponse | null>(null)
  const [lvl1Source, setLvl1Source] = useState('Webinar') // stores the VALUE (not label)
  const [lvl2Source, setLvl2Source] = useState('')
  const [lvl2Options, setLvl2Options] = useState<string[]>([])
  const [lvl2Loading, setLvl2Loading] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)

  // ── Prospects Database table ───────────────────────────────────────────────
  const [prospects, setProspects] = useState<ContactIntelRow[]>([])
  const [prospectsLoading, setProspectsLoading] = useState(true)
  const [prospSearch, setProspSearch] = useState('')
  const [prospSDR, setProspSDR] = useState('all')
  const [prospOutcome, setProspOutcome] = useState('all')
  const [prospSort, setProspSort] = useState<'calls' | 'rate' | 'date' | 'name'>('calls')
  const [prospPage, setProspPage] = useState(0)
  const [bookTarget, setBookTarget] = useState<ContactIntelRow | null>(null)
  const PROSP_PAGE_SIZE = 100

  const fetchStats = useCallback(async (bust = false) => {
    setStatsLoading(true)
    try {
      const url = bust ? `/api/prospect-stats?t=${Date.now()}` : '/api/prospect-stats'
      const res = await fetch(url, bust ? { cache: 'no-store' } : {})
      setStats(await res.json())
    } catch { /* keep */ } finally { setStatsLoading(false) }
  }, [])

  useEffect(() => {
    fetchStats()
    fetch('/api/zoho-sources')
      .then(r => r.json())
      .then((d: { values?: string[] }) => { setLvl2Options(d.values ?? []); setLvl2Loading(false) })
      .catch(() => setLvl2Loading(false))
    fetch('/api/contact-intel')
      .then(r => r.json())
      .then((d: { contacts?: ContactIntelRow[] }) => setProspects(d.contacts ?? []))
      .catch(() => {})
      .finally(() => setProspectsLoading(false))
  }, [fetchStats])

  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.name.endsWith('.csv')) { alert('Please upload a CSV file (.csv)'); return }
    setFile(f)
    setUploadStatus('idle')
    setUploadResponse(null)
  }

  async function handleUpload() {
    if (!file) return
    setUploadStatus('uploading')
    const form = new FormData()
    form.append('file', file)
    if (lvl1Source) form.append('lvl1Source', lvl1Source)
    if (lvl2Source) form.append('lvl2Source', lvl2Source)
    try {
      const res = await fetch('/api/upload-prospects', { method: 'POST', body: form })
      const data: UploadResponse = await res.json()
      if (!res.ok || data.error) {
        setUploadStatus('error')
        setUploadResponse({ ...data, ok: false })
      } else {
        setUploadStatus('done')
        setUploadResponse(data)
        fetchStats(true)
        setTimeout(() => { setFile(null); setUploadStatus('idle'); setUploadResponse(null) }, 6000)
      }
    } catch (err) {
      setUploadStatus('error')
      setUploadResponse({ ok: false, total: 0, created: 0, skipped: 0, updated: 0, excluded: 0, errors: 0, results: [], error: String(err) })
    }
  }

  // ── Prospects table logic ──────────────────────────────────────────────────
  const sdrs = useMemo(
    () => Array.from(new Set(prospects.map(c => c.sdr).filter(Boolean))).sort(),
    [prospects]
  )
  const outcomes = useMemo(
    () => Array.from(new Set(prospects.map(c => c.lastCallOutcome).filter(Boolean))).sort(),
    [prospects]
  )
  const filteredProspects = useMemo(() => {
    let list = prospects
    if (prospSDR !== 'all')     list = list.filter(c => c.sdr === prospSDR)
    if (prospOutcome !== 'all') list = list.filter(c => c.lastCallOutcome === prospOutcome)
    if (prospSearch) {
      const q = prospSearch.toLowerCase()
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q)
      )
    }
    return list
  }, [prospects, prospSDR, prospOutcome, prospSearch])

  const sortedProspects = useMemo(() => {
    const arr = [...filteredProspects]
    if (prospSort === 'name')  arr.sort((a, b) => a.name.localeCompare(b.name))
    if (prospSort === 'calls') arr.sort((a, b) => b.totalCalls - a.totalCalls)
    if (prospSort === 'rate')  arr.sort((a, b) => b.connectionRate - a.connectionRate)
    if (prospSort === 'date')  arr.sort((a, b) => (b.lastCallDate || '').localeCompare(a.lastCallDate || ''))
    return arr
  }, [filteredProspects, prospSort])

  const prospPageData = useMemo(
    () => sortedProspects.slice(prospPage * PROSP_PAGE_SIZE, (prospPage + 1) * PROSP_PAGE_SIZE),
    [sortedProspects, prospPage]
  )
  const prospTotalPages = Math.ceil(sortedProspects.length / PROSP_PAGE_SIZE)

  const tableStats = useMemo(() => {
    const total     = prospects.length
    const called    = prospects.filter(c => c.totalCalls > 0).length
    const connected = prospects.filter(c => c.connectedCalls > 0).length
    const converted = prospects.filter(c => c.zohoContactId).length
    return { total, called, connected, converted }
  }, [prospects])

  const lowStockSources = stats?.bySource.filter(s => s.weeksOfStock < 2) ?? []

  return (
    <div className="space-y-6">
      {bookTarget && (
        <BookMeetingModal
          accountName={bookTarget.company || bookTarget.name}
          contactName={bookTarget.name}
          contactEmail={bookTarget.email}
          contactId={bookTarget.zohoContactId || undefined}
          onClose={() => setBookTarget(null)}
        />
      )}

      {/* ── 1. Upload + Source counts — 1 combined row ───────────────────── */}
      <div className="card py-3">
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest shrink-0">Upload</p>
          <select
            value={lvl1Source}
            onChange={e => setLvl1Source(e.target.value)}
            style={{ color: '#E5E7EB', background: '#0d0d1a' }}
            className="border border-mh-border rounded-lg px-2 py-1 text-xs
              outline-none focus:border-mh-vermillion transition-colors"
          >
            <option value="" style={{ background: '#0d0d1a' }}>— Lvl 1 —</option>
            {LVL1_OPTIONS.map(o => <option key={o.value} value={o.value} style={{ background: '#0d0d1a' }}>{o.label}</option>)}
          </select>
          <select
            value={lvl2Source}
            onChange={e => setLvl2Source(e.target.value)}
            disabled={lvl2Loading}
            style={{ color: '#E5E7EB', background: '#0d0d1a' }}
            className="border border-mh-border rounded-lg px-2 py-1 text-xs
              outline-none focus:border-mh-vermillion disabled:opacity-50 transition-colors"
          >
            <option value="" style={{ background: '#0d0d1a' }}>{lvl2Loading ? 'Loading…' : '— Lvl 2 —'}</option>
            {lvl2Options.map(v => <option key={v} value={v} style={{ background: '#0d0d1a' }}>{v}</option>)}
          </select>

          <label
            htmlFor="csv-upload-inline"
            className="cursor-pointer text-xs px-3 py-1.5 bg-mh-surface border border-mh-border rounded-lg
              text-mh-muted hover:text-mh-text hover:border-mh-vermillion transition-colors truncate max-w-[200px]"
          >
            {file ? file.name : 'Choose CSV…'}
          </label>
          <input
            id="csv-upload-inline"
            ref={inputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={onInputChange}
          />

          {file && uploadStatus === 'idle' && (
            <button
              onClick={handleUpload}
              className="text-xs px-3 py-1.5 bg-mh-vermillion text-white rounded-lg hover:opacity-90 transition-opacity shrink-0"
            >
              Upload
            </button>
          )}
          {uploadStatus === 'uploading' && (
            <span className="text-xs text-mh-muted flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 border border-mh-vermillion border-t-transparent rounded-full animate-spin" />
              Uploading…
            </span>
          )}
          {uploadStatus === 'done' && uploadResponse && (
            <span className="text-xs text-green-400">
              {uploadResponse.created} created · {uploadResponse.skipped} skipped
            </span>
          )}
          {uploadStatus === 'error' && uploadResponse && (
            <span className="text-xs text-red-400">{uploadResponse.error ?? 'Upload failed'}</span>
          )}

          {(uploadStatus === 'done' || uploadStatus === 'error') && (
            <button
              onClick={() => { setFile(null); setUploadStatus('idle'); setUploadResponse(null); if (inputRef.current) inputRef.current.value = '' }}
              className="text-[10px] text-mh-muted hover:text-mh-text transition-colors ml-auto"
            >
              Clear
            </button>
          )}

          {/* separator */}
          <div className="h-8 w-px bg-mh-border shrink-0 mx-1" />

          {/* Source mini-counts */}
          {LVL1_OPTIONS.map(opt => {
            const live = stats?.bySource.find(s => s.source === opt.value)
            const count = statsLoading ? null : (live?.count ?? 0)
            const weeks = live?.weeksOfStock ?? 0
            const color = stockColor(weeks)
            return (
              <div key={opt.value} className="flex flex-col items-center min-w-[52px]">
                <p className="text-lg font-bold leading-tight" style={{ color }}>
                  {count === null ? '—' : count.toLocaleString()}
                </p>
                <p className="text-[9px] text-mh-muted text-center leading-tight mt-0.5">{opt.label}</p>
              </div>
            )
          })}

          {stats && uploadStatus === 'idle' && (
            <span className="text-[10px] text-mh-muted ml-auto shrink-0">
              <button onClick={() => fetchStats(true)} className="hover:text-mh-text underline underline-offset-2">
                Refresh
              </button>
            </span>
          )}
        </div>
      </div>

      {/* ── 2. Uncalled Leads Database ────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-baseline gap-4 flex-wrap">
          <h3 className="text-lg font-bold text-mh-text">Uncalled Leads Database</h3>
          {!prospectsLoading && (
            <span className="text-xs text-mh-muted italic">
              {tableStats.total.toLocaleString()} total
              {' · '}called: <em className="not-italic font-semibold text-mh-text">{tableStats.called}</em>
              {tableStats.total > 0 && <span className="text-mh-muted"> ({Math.round(tableStats.called / tableStats.total * 100)}%)</span>}
              {' · '}connected: <em className="not-italic font-semibold text-mh-text">{tableStats.connected}</em>
              {' · '}converted: <em className="not-italic font-semibold text-mh-text">{tableStats.converted}</em>
              {' · '}
              <span style={{ color: statsLoading ? '#9CA3AF' : lowStockSources.length > 0 ? '#F87171' : '#22C55E' }}>
                {statsLoading ? '…' : lowStockSources.length > 0 ? `Low stock: ${lowStockSources.map(s => LVL1_OPTIONS.find(o => o.value === s.source)?.label ?? s.source).join(', ')}` : `${stats?.totalWeeksOfStock ?? 0}w stock`}
              </span>
            </span>
          )}
        </div>

        {/* Filters */}
        <div className="card">
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              placeholder="Search name, company, email…"
              value={prospSearch}
              onChange={e => { setProspSearch(e.target.value); setProspPage(0) }}
              className="flex-1 min-w-[200px] bg-mh-bg border border-mh-border rounded-lg px-3 py-1.5 text-xs
                text-mh-text placeholder:text-mh-muted outline-none focus:border-mh-vermillion transition-colors"
            />
            <select
              value={prospSDR}
              onChange={e => { setProspSDR(e.target.value); setProspPage(0) }}
              style={{ color: '#E5E7EB', background: '#0d0d1a' }}
              className="border border-mh-border rounded-lg px-3 py-1.5 text-xs
                outline-none focus:border-mh-vermillion transition-colors"
            >
              <option value="all" style={{ background: '#0d0d1a' }}>All SDRs</option>
              {sdrs.map(s => <option key={s} value={s} style={{ background: '#0d0d1a' }}>{s}</option>)}
            </select>
            <select
              value={prospOutcome}
              onChange={e => { setProspOutcome(e.target.value); setProspPage(0) }}
              style={{ color: '#E5E7EB', background: '#0d0d1a' }}
              className="border border-mh-border rounded-lg px-3 py-1.5 text-xs
                outline-none focus:border-mh-vermillion transition-colors"
            >
              <option value="all" style={{ background: '#0d0d1a' }}>All outcomes</option>
              {outcomes.map(o => <option key={o} value={o} style={{ background: '#0d0d1a' }}>{o}</option>)}
            </select>
            <select
              value={prospSort}
              onChange={e => { setProspSort(e.target.value as typeof prospSort); setProspPage(0) }}
              style={{ color: '#E5E7EB', background: '#0d0d1a' }}
              className="border border-mh-border rounded-lg px-3 py-1.5 text-xs
                outline-none focus:border-mh-vermillion transition-colors"
            >
              <option value="calls" style={{ background: '#0d0d1a' }}>Sort: Most calls</option>
              <option value="rate" style={{ background: '#0d0d1a' }}>Sort: Highest rate</option>
              <option value="date" style={{ background: '#0d0d1a' }}>Sort: Recent calls</option>
              <option value="name" style={{ background: '#0d0d1a' }}>Sort: Name A–Z</option>
            </select>
            <span className="text-xs text-mh-muted ml-auto shrink-0">
              {filteredProspects.length.toLocaleString()} prospects
            </span>
          </div>
        </div>

        {/* Table */}
        {prospectsLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-5 h-5 border-2 border-mh-vermillion border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
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
                {prospPageData.map((c, i) => (
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

            {sortedProspects.length === 0 && (
              <p className="text-center text-mh-muted text-sm py-10 italic">No prospects match your filters.</p>
            )}
          </div>
        )}

        {/* Pagination */}
        {prospTotalPages > 1 && (
          <div className="flex items-center justify-between text-xs text-mh-muted">
            <span>
              Showing {prospPage * PROSP_PAGE_SIZE + 1}–{Math.min((prospPage + 1) * PROSP_PAGE_SIZE, sortedProspects.length)} of {sortedProspects.length.toLocaleString()}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setProspPage(p => Math.max(0, p - 1))}
                disabled={prospPage === 0}
                className="px-3 py-1.5 rounded border border-mh-border hover:text-mh-text disabled:opacity-40 transition-colors"
              >
                ← Prev
              </button>
              <span className="px-3 py-1.5 text-mh-text font-medium">
                {prospPage + 1} / {prospTotalPages}
              </span>
              <button
                onClick={() => setProspPage(p => Math.min(prospTotalPages - 1, p + 1))}
                disabled={prospPage === prospTotalPages - 1}
                className="px-3 py-1.5 rounded border border-mh-border hover:text-mh-text disabled:opacity-40 transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
