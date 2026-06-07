'use client'
import { useState, useRef, useEffect, useCallback, DragEvent, ChangeEvent } from 'react'

const LVL1_OPTIONS = [
  'Webinar',
  'Events',
  'Email',
  'Cold Outreach',
  'Referrals',
  'Internal Community Data',
]

interface SourceStat {
  source: string
  count: number
  weeksOfStock: number
}

interface ProspectStats {
  total: number
  totalWeeksOfStock: number
  bySource: SourceStat[]
  fetchedAt: string
}

interface UploadResult {
  row: number
  status: 'created' | 'skipped' | 'updated' | 'error' | 'excluded'
  reason?: string
}

interface UploadResponse {
  ok: boolean
  total: number
  created: number
  skipped: number
  updated: number
  excluded: number
  errors: number
  results: UploadResult[]
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

export default function ProspectModule() {
  const [stats, setStats] = useState<ProspectStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  // Upload state
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<{ headers: string[]; rows: string[][] } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle')
  const [uploadResponse, setUploadResponse] = useState<UploadResponse | null>(null)
  const [lvl1Source, setLvl1Source] = useState('Webinar')
  const [lvl2Source, setLvl2Source] = useState('')
  const [lvl2Options, setLvl2Options] = useState<string[]>([])
  const [lvl2Loading, setLvl2Loading] = useState(true)
  const [addingNew, setAddingNew] = useState(false)
  const [newSourceValue, setNewSourceValue] = useState('')
  const [addingStatus, setAddingStatus] = useState<'idle' | 'saving' | 'error'>('idle')
  const inputRef = useRef<HTMLInputElement>(null)

  const fetchStats = useCallback(async (bust = false) => {
    setStatsLoading(true)
    try {
      const url = bust ? `/api/prospect-stats?t=${Date.now()}` : '/api/prospect-stats'
      const res = await fetch(url, bust ? { cache: 'no-store' } : {})
      const data: ProspectStats = await res.json()
      setStats(data)
    } catch { /* keep existing stats */ } finally {
      setStatsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
    fetch('/api/zoho-sources')
      .then(r => r.json())
      .then((d: { values?: string[] }) => { setLvl2Options(d.values ?? []); setLvl2Loading(false) })
      .catch(() => setLvl2Loading(false))
  }, [fetchStats])

  async function handleAddSource() {
    if (!newSourceValue.trim()) return
    setAddingStatus('saving')
    try {
      const res = await fetch('/api/zoho-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: newSourceValue.trim() }),
      })
      const data: { ok?: boolean; value?: string; error?: string } = await res.json()
      if (data.error) { setAddingStatus('error'); return }
      const added = data.value!
      setLvl2Options(prev => [...prev, added])
      setLvl2Source(added)
      setAddingNew(false)
      setNewSourceValue('')
      setAddingStatus('idle')
    } catch {
      setAddingStatus('error')
    }
  }

  function parseCSVPreview(text: string): { headers: string[]; rows: string[][] } {
    const lines = text.split(/\r?\n/).filter(l => l.trim()).slice(0, 6)
    if (lines.length === 0) return { headers: [], rows: [] }
    const split = (line: string) => line.split(',').map(v => v.replace(/^"|"$/g, '').trim())
    return { headers: split(lines[0]), rows: lines.slice(1).map(split) }
  }

  async function handleFile(f: File) {
    if (!f.name.endsWith('.csv')) { alert('Please upload a CSV file (.csv)'); return }
    setFile(f)
    setUploadStatus('idle')
    setUploadResponse(null)
    setPreview(parseCSVPreview(await f.text()))
  }

  function onDragOver(e: DragEvent) { e.preventDefault(); setIsDragging(true) }
  function onDragLeave() { setIsDragging(false) }
  function onDrop(e: DragEvent) {
    e.preventDefault(); setIsDragging(false)
    const f = e.dataTransfer.files[0]; if (f) handleFile(f)
  }
  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (f) handleFile(f)
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
      }
    } catch (err) {
      setUploadStatus('error')
      setUploadResponse({
        ok: false, total: 0, created: 0, skipped: 0, updated: 0,
        excluded: 0, errors: 0, results: [], error: String(err),
      })
    }
  }

  function resetUpload() {
    setFile(null); setPreview(null)
    setUploadStatus('idle'); setUploadResponse(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const lowStockSources = stats?.bySource.filter(s => s.weeksOfStock < 2) ?? []

  return (
    <div className="space-y-6">

      {/* Stat cards */}
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

      {/* Source breakdown + Upload panel */}
      <div className="grid grid-cols-[1fr_400px] gap-4">

        {/* Source breakdown */}
        <div className="card">
          <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest mb-4">
            Prospect Stock by Source
          </p>
          {statsLoading ? (
            <p className="text-mh-muted text-sm italic">Loading…</p>
          ) : !stats || stats.bySource.length === 0 ? (
            <p className="text-mh-muted text-sm italic">No prospects in the database yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-mh-muted text-[10px] uppercase tracking-widest">
                  <th className="text-left pb-3 font-semibold">Source</th>
                  <th className="text-right pb-3 font-semibold">Count</th>
                  <th className="text-right pb-3 font-semibold">Weeks of Stock</th>
                  <th className="text-right pb-3 font-semibold">Health</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mh-border">
                {stats.bySource.map(({ source, count, weeksOfStock }) => (
                  <tr key={source}>
                    <td className="py-3 text-mh-text font-medium">{source}</td>
                    <td className="py-3 text-right text-mh-text">{count.toLocaleString()}</td>
                    <td className="py-3 text-right text-mh-text">{weeksOfStock}w</td>
                    <td className="py-3 text-right">
                      <span
                        className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                        style={{
                          color: stockColor(weeksOfStock),
                          backgroundColor: stockColor(weeksOfStock) + '22',
                        }}
                      >
                        {stockLabel(weeksOfStock)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {stats && (
            <p className="text-[10px] text-mh-muted mt-4 pt-3 border-t border-mh-border">
              Fetched at{' '}
              {new Date(stats.fetchedAt).toLocaleTimeString('en-IN', {
                hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata',
              })}{' '}
              IST ·{' '}
              <button
                onClick={() => fetchStats(true)}
                className="hover:text-mh-text transition-colors underline underline-offset-2"
              >
                Refresh
              </button>
            </p>
          )}
        </div>

        {/* Upload panel */}
        <div className="card space-y-4">
          <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest">
            Upload Prospects
          </p>

          {/* Source selectors — hide during upload/result */}
          {uploadStatus !== 'uploading' && uploadStatus !== 'done' && (
            <div className="space-y-3">
              {/* Lvl 1 */}
              <div>
                <label className="block text-[10px] font-semibold text-mh-muted uppercase tracking-widest mb-1.5">
                  Lvl 1 Source
                </label>
                <select
                  value={lvl1Source}
                  onChange={e => setLvl1Source(e.target.value)}
                  className="w-full bg-mh-bg border border-mh-border rounded-lg px-3 py-2 text-sm text-mh-text
                    outline-none focus:border-mh-vermillion transition-colors"
                >
                  <option value="">— None —</option>
                  {LVL1_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>

              {/* Lvl 2 */}
              <div>
                <label className="block text-[10px] font-semibold text-mh-muted uppercase tracking-widest mb-1.5">
                  Lvl 2 Source
                </label>
                {addingNew ? (
                  <div className="space-y-2">
                    <input
                      autoFocus
                      value={newSourceValue}
                      onChange={e => setNewSourceValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleAddSource()
                        if (e.key === 'Escape') { setAddingNew(false); setNewSourceValue(''); setAddingStatus('idle') }
                      }}
                      placeholder="New source name…"
                      className="w-full bg-mh-bg border border-mh-vermillion rounded-lg px-3 py-2 text-sm
                        text-mh-text outline-none placeholder:text-mh-muted"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleAddSource}
                        disabled={addingStatus === 'saving' || !newSourceValue.trim()}
                        className="flex-1 bg-mh-vermillion text-white rounded-lg px-3 py-1.5 text-xs font-medium
                          hover:opacity-90 disabled:opacity-50 transition-opacity"
                      >
                        {addingStatus === 'saving' ? 'Saving to Zoho…' : 'Add to Zoho'}
                      </button>
                      <button
                        onClick={() => { setAddingNew(false); setNewSourceValue(''); setAddingStatus('idle') }}
                        className="px-3 py-1.5 text-xs text-mh-muted hover:text-mh-text rounded-lg
                          border border-mh-border transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                    {addingStatus === 'error' && (
                      <p className="text-xs text-red-400">Failed to add. Try again.</p>
                    )}
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <select
                      value={lvl2Source}
                      onChange={e => setLvl2Source(e.target.value)}
                      disabled={lvl2Loading}
                      className="flex-1 bg-mh-bg border border-mh-border rounded-lg px-3 py-2 text-sm
                        text-mh-text outline-none focus:border-mh-vermillion disabled:opacity-50 transition-colors"
                    >
                      <option value="">{lvl2Loading ? 'Loading…' : '— None —'}</option>
                      {lvl2Options.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                    <button
                      onClick={() => setAddingNew(true)}
                      title="Add new Lvl 2 Source to Zoho"
                      className="px-3 py-2 border border-mh-border rounded-lg text-mh-muted text-lg leading-none
                        hover:text-mh-vermillion hover:border-mh-vermillion transition-colors"
                    >
                      +
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Drop zone */}
          {!file && uploadStatus !== 'uploading' && uploadStatus !== 'done' && (
            <div
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                isDragging
                  ? 'border-mh-vermillion bg-mh-vermillion/5'
                  : 'border-mh-border hover:border-mh-muted'
              }`}
            >
              <p className="text-mh-muted text-sm">Drop CSV here or click to browse</p>
              <p className="text-[11px] text-mh-muted opacity-60 mt-1">
                First Name, Last Name, Company, Email, Phone…
              </p>
              <input
                ref={inputRef} type="file" accept=".csv"
                className="hidden" onChange={onInputChange}
              />
            </div>
          )}

          {/* Preview */}
          {file && preview && uploadStatus === 'idle' && (
            <div className="space-y-3">
              <div className="bg-mh-bg border border-mh-border rounded-lg overflow-hidden">
                <div className="px-3 py-2 border-b border-mh-border flex items-center justify-between">
                  <span className="text-xs text-mh-text font-medium truncate max-w-[260px]">{file.name}</span>
                  <button
                    onClick={resetUpload}
                    className="text-xs text-mh-muted hover:text-mh-text ml-2 shrink-0 transition-colors"
                  >
                    Change
                  </button>
                </div>
                <div className="overflow-x-auto max-h-28">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-mh-border">
                        {preview.headers.slice(0, 5).map((h, i) => (
                          <th
                            key={i}
                            className="text-left px-3 py-2 text-mh-muted whitespace-nowrap font-medium"
                          >
                            {h}
                          </th>
                        ))}
                        {preview.headers.length > 5 && (
                          <th className="px-3 py-2 text-mh-muted">+{preview.headers.length - 5}</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.slice(0, 3).map((row, i) => (
                        <tr key={i} className="border-b border-mh-border/40">
                          {row.slice(0, 5).map((cell, j) => (
                            <td
                              key={j}
                              className="px-3 py-1.5 text-mh-muted whitespace-nowrap max-w-[80px] truncate"
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <button
                onClick={handleUpload}
                className="w-full bg-mh-vermillion text-white py-2 rounded-lg text-sm font-medium
                  hover:opacity-90 transition-opacity"
              >
                Upload to Zoho + Sheets
              </button>
            </div>
          )}

          {/* Uploading */}
          {uploadStatus === 'uploading' && (
            <div className="text-center py-8 space-y-3">
              <div className="inline-block w-6 h-6 border-2 border-mh-vermillion border-t-transparent
                rounded-full animate-spin"
              />
              <p className="text-sm text-mh-muted">Importing leads into Zoho…</p>
            </div>
          )}

          {/* Error */}
          {uploadStatus === 'error' && uploadResponse && (
            <div className="space-y-3">
              <p className="text-sm text-red-400 bg-red-400/10 rounded-lg px-3 py-2">
                {uploadResponse.error ?? 'Upload failed'}
              </p>
              <button
                onClick={resetUpload}
                className="text-xs text-mh-muted hover:text-mh-text transition-colors"
              >
                Try again
              </button>
            </div>
          )}

          {/* Results */}
          {uploadStatus === 'done' && uploadResponse && (
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'Created',  value: uploadResponse.created,       color: '#22C55E' },
                  { label: 'Updated',  value: uploadResponse.updated ?? 0,  color: '#60A5FA' },
                  { label: 'Skipped',  value: uploadResponse.skipped,        color: '#F59E0B' },
                  { label: 'Errors',   value: uploadResponse.errors,         color: '#F87171' },
                ].map(({ label, value, color }) => (
                  <div
                    key={label}
                    className="bg-mh-bg border border-mh-border rounded-lg p-3 text-center"
                  >
                    <div className="text-xl font-bold" style={{ color }}>{value}</div>
                    <div className="text-[10px] text-mh-muted mt-0.5">{label}</div>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-mh-muted">Stats above have been refreshed.</p>
              <button
                onClick={resetUpload}
                className="text-xs text-mh-muted hover:text-mh-text transition-colors underline underline-offset-2"
              >
                Upload another file
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
