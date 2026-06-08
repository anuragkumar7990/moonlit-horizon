'use client'
import { useState, useRef, useEffect, useCallback, useMemo, ChangeEvent } from 'react'
import type { ContactIntelRow } from '@/lib/sheets'
import BookMeetingModal from './BookMeetingModal'

const LVL1_OPTIONS = [
  'Webinar',
  'Events',
  'Email',
  'Cold Outreach',
  'Referrals',
  'Internal Community Data',
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

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card">
      <p className="text-[10px] font-semibold text-mh-vermillion uppercase tracking-widest mb-2">{label}</p>
      <p className="text-3xl font-semibold text-mh-text">{value}</p>
      {sub && <p className="text-xs text-mh-muted mt-1">{sub}</p>}
    </div>
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
  const [lvl1Source, setLvl1Source] = useState('Webinar')
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
    const withMtg   = prospects.filter(c =>
      (c.lastCallOutcome || '').toLowerCase().includes('meeting')
    ).length
    return { total, called, connected, withMtg }
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

      {/* ── 1. Stat cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="Total Prospects"
          value={statsLoading ? '—' : (stats?.total ?? 0)}
          sub="uncalled leads in pipeline"
        />
        <StatCard
          label="Weeks of Stock"
          value={statsLoading ? '—' : `${stats?.totalWeeksOfStock ?? 0}w`}
          sub="at 250 calls / week"
        />
        <div className="card">
          <p className="text-[10px] font-semibold text-mh-vermillion uppercase tracking-widest mb-2">Stock Health</p>
          {statsLoading ? (
            <p className="text-mh-muted text-sm">Loading…</p>
          ) : lowStockSources.length > 0 ? (
            <>
              <p className="text-3xl font-semibold" style={{ color: '#F87171' }}>Low</p>
              <p className="text-xs text-mh-muted mt-1">
                {lowStockSources.map(s => s.source).join(', ')} below 2w
              </p>
            </>
          ) : (
            <>
              <p className="text-3xl font-semibold" style={{ color: '#22C55E' }}>Healthy</p>
              <p className="text-xs text-mh-muted mt-1">All sources above 2-week threshold</p>
            </>
          )}
        </div>
      </div>

      {/* ── 2. Upload — 1 line ────────────────────────────────────────────── */}
      <div className="card py-3">
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest shrink-0">Upload Prospects</p>
          <select
            value={lvl1Source}
            onChange={e => setLvl1Source(e.target.value)}
            className="bg-mh-bg border border-mh-border rounded-lg px-2 py-1 text-xs text-mh-text
              outline-none focus:border-mh-vermillion transition-colors"
          >
            <option value="">— Lvl 1 —</option>
            {LVL1_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <select
            value={lvl2Source}
            onChange={e => setLvl2Source(e.target.value)}
            disabled={lvl2Loading}
            className="bg-mh-bg border border-mh-border rounded-lg px-2 py-1 text-xs text-mh-text
              outline-none focus:border-mh-vermillion disabled:opacity-50 transition-colors"
          >
            <option value="">{lvl2Loading ? 'Loading…' : '— Lvl 2 —'}</option>
            {lvl2Options.map(v => <option key={v} value={v}>{v}</option>)}
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

          {stats && uploadStatus === 'idle' && (
            <span className="text-[10px] text-mh-muted ml-auto">
              Refreshed{' '}
              {new Date(stats.fetchedAt).toLocaleTimeString('en-IN', {
                hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata',
              })}{' '}IST ·{' '}
              <button onClick={() => fetchStats(true)} className="hover:text-mh-text underline underline-offset-2">
                Refresh
              </button>
            </span>
          )}
        </div>
      </div>

      {/* ── 3. Source cards — 6 cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        {LVL1_OPTIONS.map(source => {
          const live = stats?.bySource.find(s => s.source === source)
          const count = statsLoading ? null : (live?.count ?? 0)
          const weeks = live?.weeksOfStock ?? 0
          const color = stockColor(weeks)
          const label = stockLabel(weeks)
          return (
            <div key={source} className="card">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-mh-text leading-tight">{source}</p>
                {count !== null && (
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                    style={{ color, backgroundColor: color + '22' }}
                  >
                    {label}
                  </span>
                )}
              </div>
              <p className="text-3xl font-semibold text-mh-text mt-3">
                {count === null ? '—' : count.toLocaleString()}
              </p>
              <p className="text-[10px] text-mh-muted mt-1">
                {count === null ? '' : `${weeks}w of stock`}
              </p>
            </div>
          )
        })}
      </div>

      {/* ── 4. Prospects Database table ───────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-mh-text">Prospects Database</h3>
          {!prospectsLoading && (
            <span className="text-xs text-mh-muted">{prospects.length.toLocaleString()} total</span>
          )}
        </div>

        {/* Table stats */}
        {!prospectsLoading && (
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Total',       value: tableStats.total.toLocaleString() },
              { label: 'Called',      value: tableStats.called.toLocaleString(), sub: tableStats.total > 0 ? `${Math.round(tableStats.called / tableStats.total * 100)}% of total` : undefined },
              { label: 'Connected',   value: tableStats.connected.toLocaleString() },
              { label: 'Mtg Booked',  value: tableStats.withMtg.toLocaleString() },
            ].map(({ label, value, sub }) => (
              <div key={label} className="card py-3">
                <p className="text-[10px] font-semibold text-mh-vermillion uppercase tracking-widest mb-1">{label}</p>
                <p className="text-2xl font-semibold text-mh-text">{value}</p>
                {sub && <p className="text-xs text-mh-muted mt-0.5">{sub}</p>}
              </div>
            ))}
          </div>
        )}

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
              className="bg-mh-bg border border-mh-border rounded-lg px-3 py-1.5 text-xs text-mh-text
                outline-none focus:border-mh-vermillion transition-colors"
            >
              <option value="all">All SDRs</option>
              {sdrs.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select
              value={prospOutcome}
              onChange={e => { setProspOutcome(e.target.value); setProspPage(0) }}
              className="bg-mh-bg border border-mh-border rounded-lg px-3 py-1.5 text-xs text-mh-text
                outline-none focus:border-mh-vermillion transition-colors"
            >
              <option value="all">All outcomes</option>
              {outcomes.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            <select
              value={prospSort}
              onChange={e => { setProspSort(e.target.value as typeof prospSort); setProspPage(0) }}
              className="bg-mh-bg border border-mh-border rounded-lg px-3 py-1.5 text-xs text-mh-text
                outline-none focus:border-mh-vermillion transition-colors"
            >
              <option value="calls">Sort: Most calls</option>
              <option value="rate">Sort: Highest rate</option>
              <option value="date">Sort: Recent calls</option>
              <option value="name">Sort: Name A–Z</option>
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
