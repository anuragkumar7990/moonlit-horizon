'use client'

import { useState, useRef, useEffect, DragEvent, ChangeEvent } from 'react'

interface UploadResult {
  row: number
  status: 'created' | 'skipped' | 'updated' | 'error' | 'excluded'
  id?: string
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

const LVL1_OPTIONS = ['Webinar', 'Events', 'Email', 'Referrals', 'Internal Community Data']

function parseCSVPreview(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim()).slice(0, 6)
  if (lines.length === 0) return { headers: [], rows: [] }
  const split = (line: string) => line.split(',').map(v => v.replace(/^"|"$/g, '').trim())
  const headers = split(lines[0])
  const rows = lines.slice(1).map(split)
  return { headers, rows }
}

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<{ headers: string[]; rows: string[][] } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [status, setStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle')
  const [response, setResponse] = useState<UploadResponse | null>(null)
  const [lvl1Source, setLvl1Source] = useState('Webinar')
  const [lvl2Source, setLvl2Source] = useState('')
  const [lvl2Options, setLvl2Options] = useState<string[]>([])
  const [lvl2Loading, setLvl2Loading] = useState(true)
  const [addingNew, setAddingNew] = useState(false)
  const [newSourceValue, setNewSourceValue] = useState('')
  const [addingStatus, setAddingStatus] = useState<'idle' | 'saving' | 'error'>('idle')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/zoho-sources')
      .then(r => r.json())
      .then((d: { values?: string[] }) => { setLvl2Options(d.values ?? []); setLvl2Loading(false) })
      .catch(() => setLvl2Loading(false))
  }, [])

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

  async function handleFile(f: File) {
    if (!f.name.endsWith('.csv')) {
      alert('Please upload a CSV file (.csv)')
      return
    }
    setFile(f)
    setStatus('idle')
    setResponse(null)
    const text = await f.text()
    setPreview(parseCSVPreview(text))
  }

  function onDragOver(e: DragEvent) { e.preventDefault(); setIsDragging(true) }
  function onDragLeave() { setIsDragging(false) }
  function onDrop(e: DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }
  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) handleFile(f)
  }

  async function handleUpload() {
    if (!file) return
    setStatus('uploading')
    const form = new FormData()
    form.append('file', file)
    if (lvl1Source) form.append('lvl1Source', lvl1Source)
    if (lvl2Source) form.append('lvl2Source', lvl2Source)
    try {
      const res = await fetch('/api/upload-prospects', { method: 'POST', body: form })
      const data: UploadResponse = await res.json()
      if (!res.ok || data.error) {
        setStatus('error')
        setResponse({ ...data, ok: false })
      } else {
        setStatus('done')
        setResponse(data)
      }
    } catch (err) {
      setStatus('error')
      setResponse({ ok: false, total: 0, created: 0, skipped: 0, excluded: 0, errors: 0, results: [], error: String(err) })
    }
  }

  function reset() {
    setFile(null)
    setPreview(null)
    setStatus('idle')
    setResponse(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Upload Prospects</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Upload a CSV file to batch-create Leads in Zoho CRM. Duplicate emails are skipped automatically.
        </p>
      </div>

      {/* Source selectors — always visible */}
      {status !== 'uploading' && status !== 'done' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Lead Source</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Lvl 1 Source
              </label>
              <select
                value={lvl1Source}
                onChange={e => setLvl1Source(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— None —</option>
                {LVL1_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Lvl 2 Source
              </label>
              {addingNew ? (
                <div className="space-y-2">
                  <input
                    autoFocus
                    value={newSourceValue}
                    onChange={e => setNewSourceValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddSource(); if (e.key === 'Escape') { setAddingNew(false); setNewSourceValue(''); setAddingStatus('idle') } }}
                    placeholder="New source name…"
                    className="w-full border border-blue-400 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddSource}
                      disabled={addingStatus === 'saving' || !newSourceValue.trim()}
                      className="flex-1 bg-blue-600 text-white rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {addingStatus === 'saving' ? 'Saving to Zoho…' : 'Add to Zoho'}
                    </button>
                    <button
                      onClick={() => { setAddingNew(false); setNewSourceValue(''); setAddingStatus('idle') }}
                      className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 rounded-lg border border-slate-200"
                    >
                      Cancel
                    </button>
                  </div>
                  {addingStatus === 'error' && (
                    <p className="text-xs text-red-600">Failed to add. Try again.</p>
                  )}
                </div>
              ) : (
                <div className="flex gap-2">
                  <select
                    value={lvl2Source}
                    onChange={e => setLvl2Source(e.target.value)}
                    disabled={lvl2Loading}
                    className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    <option value="">{lvl2Loading ? 'Loading…' : '— None —'}</option>
                    {lvl2Options.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                  <button
                    onClick={() => setAddingNew(true)}
                    title="Add new Lvl 2 Source to Zoho"
                    className="px-3 py-2 border border-slate-200 rounded-lg text-slate-500 hover:text-blue-600 hover:border-blue-400 text-lg leading-none transition-colors"
                  >
                    +
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Drop zone */}
      {!file && (
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
            isDragging
              ? 'border-blue-500 bg-blue-50'
              : 'border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50'
          }`}
        >
          <div className="text-4xl mb-3">📂</div>
          <p className="text-slate-700 font-medium">Drop your CSV here, or click to browse</p>
          <p className="text-slate-400 text-sm mt-1">Accepts .csv files — First Name, Last Name, Company, Email, Phone, Designation</p>
          <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={onInputChange} />
        </div>
      )}

      {/* Preview */}
      {file && preview && status === 'idle' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <span className="font-medium text-slate-800">{file.name}</span>
              <span className="text-slate-400 text-sm ml-2">— preview (first 5 rows)</span>
            </div>
            <button onClick={reset} className="text-sm text-slate-400 hover:text-slate-600">Change file</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  {preview.headers.map((h, i) => (
                    <th key={i} className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    {row.map((cell, j) => (
                      <td key={j} className="px-4 py-2.5 text-slate-700 whitespace-nowrap max-w-[180px] truncate">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
            <p className="text-sm text-slate-500">
              Rows detected: <strong className="text-slate-700">{preview.rows.length} shown</strong> — actual count may be higher
            </p>
            <button
              onClick={handleUpload}
              className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Upload to Zoho CRM
            </button>
          </div>
        </div>
      )}

      {/* Uploading */}
      {status === 'uploading' && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-slate-700 font-medium">Importing leads into Zoho CRM…</p>
          <p className="text-slate-400 text-sm mt-1">This may take a few seconds for large files</p>
        </div>
      )}

      {/* Error */}
      {status === 'error' && response && (
        <div className="bg-white rounded-xl border border-red-200 p-6">
          <p className="text-red-700 font-medium mb-2">Upload failed</p>
          <p className="text-red-600 text-sm bg-red-50 rounded px-3 py-2">{response.error ?? 'Unknown error'}</p>
          <button onClick={reset} className="mt-4 text-sm text-blue-600 hover:underline">Try again</button>
        </div>
      )}

      {/* Results */}
      {status === 'done' && response && (
        <div className="space-y-4">
          <div className="grid grid-cols-5 gap-3">
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-4 text-center">
              <div className="text-2xl font-bold text-green-700">{response.created}</div>
              <div className="text-sm text-green-600 mt-0.5">Created</div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-4 text-center">
              <div className="text-2xl font-bold text-blue-700">{response.updated ?? 0}</div>
              <div className="text-sm text-blue-600 mt-0.5">Updated</div>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-4 text-center">
              <div className="text-2xl font-bold text-yellow-700">{response.skipped}</div>
              <div className="text-sm text-yellow-600 mt-0.5">Skipped</div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-center">
              <div className="text-2xl font-bold text-slate-500">{response.excluded ?? 0}</div>
              <div className="text-sm text-slate-400 mt-0.5">Excluded</div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-4 text-center">
              <div className="text-2xl font-bold text-red-700">{response.errors}</div>
              <div className="text-sm text-red-600 mt-0.5">Errors</div>
            </div>
          </div>

          {response.results.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 text-sm font-medium text-slate-700">
                Row-by-row results
              </div>
              <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                {response.results.map((r) => (
                  <div key={r.row} className="px-5 py-2.5 flex items-center gap-3 text-sm">
                    <span className="text-slate-400 w-12">Row {r.row}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      r.status === 'created'  ? 'bg-green-100 text-green-700' :
                      r.status === 'updated'  ? 'bg-blue-100 text-blue-700' :
                      r.status === 'skipped'  ? 'bg-yellow-100 text-yellow-700' :
                      r.status === 'excluded' ? 'bg-slate-100 text-slate-500' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {r.status === 'created' ? 'Created' : r.status === 'updated' ? 'Updated' : r.status === 'skipped' ? 'Skipped' : r.status === 'excluded' ? 'Excluded' : 'Error'}
                    </span>
                    {r.reason && <span className="text-slate-500">{r.reason}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <button onClick={reset} className="text-sm text-blue-600 hover:underline">
            Upload another file
          </button>
        </div>
      )}

      {/* Column guide */}
      {!file && (
        <div className="mt-6 bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Expected CSV columns</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {[
              ['First Name', 'firstname, first_name'],
              ['Last Name', 'lastname, last_name'],
              ['Company', 'company, organization, organisation'],
              ['Email *', 'email — personal; also detects any "Work Email" column'],
              ['Work Email', 'any header containing "work" + "email" — preferred over personal'],
              ['Phone', 'phone_number, phone, mobile'],
              ['Designation', 'designation, title, role, position'],
              ['City', 'city'],
              ['Attendance', 'attendance — Attended → Contacted, else Not Contacted'],
              ['Priority', 'priority — rows with "Skip" are excluded entirely'],
            ].map(([field, variants]) => (
              <div key={field} className="flex gap-2">
                <span className="font-medium text-slate-700 w-28 shrink-0">{field}</span>
                <span className="text-slate-400">{variants}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-3">
            Headers matched case-insensitively. Only Email is required. Duplicate emails, phones, and names within the same file are auto-deduplicated.
          </p>
        </div>
      )}
    </div>
  )
}
