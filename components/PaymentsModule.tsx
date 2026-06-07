'use client'
import { useState, useEffect, useMemo } from 'react'
import type { Payment } from '@/lib/sheets'

interface PaymentRow extends Payment {
  rowIndex: number
  attachmentUrl?: string
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  Invoiced: { bg: '#2563eb18', color: '#60A5FA' },
  Received: { bg: '#16a34a18', color: '#22C55E' },
  Partial:  { bg: '#7c3aed18', color: '#A78BFA' },
  Overdue:  { bg: '#dc262618', color: '#F87171' },
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { bg: '#37415118', color: '#9CA3AF' }
  return (
    <span
      className="text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ backgroundColor: s.bg, color: s.color }}
    >
      {status}
    </span>
  )
}

function isOverdue(dueDate: string, status: string): boolean {
  if (!dueDate || status === 'Received') return false
  return new Date(dueDate) < new Date()
}

// ── Add Invoice Modal ────────────────────────────────────────────────────────

interface AddInvoiceModalProps {
  onClose: () => void
  onAdded: (p: PaymentRow) => void
}

function AddInvoiceModal({ onClose, onAdded }: AddInvoiceModalProps) {
  const today = new Date().toISOString().slice(0, 10)
  const in30  = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)

  const [account,        setAccount]        = useState('')
  const [deal,           setDeal]           = useState('')
  const [amount,         setAmount]         = useState('')
  const [invoiceDate,    setInvoiceDate]    = useState(today)
  const [dueDate,        setDueDate]        = useState(in30)
  const [notes,          setNotes]          = useState('')
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  const [saving,         setSaving]         = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const [error,          setError]          = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!account || !amount || !invoiceDate || !dueDate) { setError('Account, amount and dates are required'); return }
    setSaving(true)
    setError(null)
    setUploadProgress(null)
    try {
      // 1. Upload attachment if provided
      let attachmentUrl: string | undefined
      if (attachmentFile) {
        setUploadProgress('Uploading attachment…')
        const fd = new FormData()
        fd.append('file', attachmentFile)
        const uploadRes = await fetch('/api/upload-attachment', { method: 'POST', body: fd })
        const uploadData = await uploadRes.json() as { url?: string; error?: string }
        if (!uploadRes.ok || uploadData.error) {
          setError(uploadData.error ?? 'File upload failed')
          return
        }
        attachmentUrl = uploadData.url
        setUploadProgress(null)
      }

      // 2. Save invoice
      const res = await fetch('/api/log-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account: account.trim(),
          deal: deal.trim(),
          amount: parseFloat(amount),
          invoiceDate,
          dueDate,
          notes: notes.trim(),
          attachmentUrl,
        }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok || data.error) { setError(data.error ?? 'Failed to add invoice'); return }
      onAdded({
        rowIndex: -1,
        date: today,
        account: account.trim(),
        deal: deal.trim(),
        amount: parseFloat(amount),
        invoiceDate,
        dueDate,
        status: 'Invoiced',
        notes: notes.trim(),
        attachmentUrl,
      })
      onClose()
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
      setUploadProgress(null)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-mh-surface border border-mh-border rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-mh-border">
          <h2 className="text-sm font-semibold text-mh-text">Add Invoice / Payment</h2>
          <button onClick={onClose} className="text-mh-muted hover:text-mh-text transition-colors text-lg leading-none">✕</button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-[10px] font-semibold text-mh-vermillion uppercase tracking-widest mb-1 block">Account *</label>
              <input
                value={account}
                onChange={e => setAccount(e.target.value)}
                placeholder="e.g. Stryker"
                required
                className="w-full bg-mh-bg border border-mh-border rounded-lg px-3 py-2 text-sm text-mh-text
                  placeholder:text-mh-muted outline-none focus:border-mh-vermillion transition-colors"
              />
            </div>

            <div className="col-span-2">
              <label className="text-[10px] font-semibold text-mh-vermillion uppercase tracking-widest mb-1 block">Deal Name</label>
              <input
                value={deal}
                onChange={e => setDeal(e.target.value)}
                placeholder="e.g. Agentic AI Training – Batch 1"
                className="w-full bg-mh-bg border border-mh-border rounded-lg px-3 py-2 text-sm text-mh-text
                  placeholder:text-mh-muted outline-none focus:border-mh-vermillion transition-colors"
              />
            </div>

            <div>
              <label className="text-[10px] font-semibold text-mh-vermillion uppercase tracking-widest mb-1 block">Amount (₹) *</label>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0"
                min="0"
                required
                className="w-full bg-mh-bg border border-mh-border rounded-lg px-3 py-2 text-sm text-mh-text
                  placeholder:text-mh-muted outline-none focus:border-mh-vermillion transition-colors"
              />
            </div>

            <div>
              <label className="text-[10px] font-semibold text-mh-vermillion uppercase tracking-widest mb-1 block">Invoice Date *</label>
              <input
                type="date"
                value={invoiceDate}
                onChange={e => setInvoiceDate(e.target.value)}
                required
                className="w-full bg-mh-bg border border-mh-border rounded-lg px-3 py-2 text-sm text-mh-text
                  outline-none focus:border-mh-vermillion transition-colors"
              />
            </div>

            <div>
              <label className="text-[10px] font-semibold text-mh-vermillion uppercase tracking-widest mb-1 block">Due Date *</label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                required
                className="w-full bg-mh-bg border border-mh-border rounded-lg px-3 py-2 text-sm text-mh-text
                  outline-none focus:border-mh-vermillion transition-colors"
              />
            </div>

            <div>
              <label className="text-[10px] font-semibold text-mh-vermillion uppercase tracking-widest mb-1 block">Notes</label>
              <input
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Optional"
                className="w-full bg-mh-bg border border-mh-border rounded-lg px-3 py-2 text-sm text-mh-text
                  placeholder:text-mh-muted outline-none focus:border-mh-vermillion transition-colors"
              />
            </div>
          </div>

          {/* Attachment */}
          <div>
            <label className="text-[10px] font-semibold text-mh-vermillion uppercase tracking-widest mb-1 block">
              Attach Invoice (PDF / Image)
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <span className="px-3 py-2 text-xs border border-mh-border rounded-lg text-mh-muted hover:text-mh-text
                hover:border-mh-vermillion transition-colors whitespace-nowrap">
                {attachmentFile ? '↩ Change file' : '+ Attach file'}
              </span>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                className="hidden"
                onChange={e => setAttachmentFile(e.target.files?.[0] ?? null)}
              />
              {attachmentFile ? (
                <span className="text-xs text-mh-text truncate max-w-[200px]">{attachmentFile.name}</span>
              ) : (
                <span className="text-xs text-mh-muted">No file chosen · max 20 MB</span>
              )}
            </label>
          </div>

          {uploadProgress && <p className="text-xs text-mh-muted">{uploadProgress}</p>}
          {error && <p className="text-red-400 text-xs">{error}</p>}

          <p className="text-[10px] text-mh-muted">
            Saving will add a row to Payments sheet and move the Zoho deal to <span className="text-blue-400">Payment Pending</span>.
          </p>

          <div className="flex gap-3 justify-end pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-mh-muted border border-mh-border rounded-lg hover:text-mh-text transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-sm font-medium bg-mh-vermillion text-white rounded-lg
                hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-2"
            >
              {saving && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {saving ? (uploadProgress ? 'Uploading…' : 'Saving…') : 'Add Invoice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main module ──────────────────────────────────────────────────────────────

export default function PaymentsModule() {
  const [payments, setPayments]   = useState<PaymentRow[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch]       = useState('')
  const [updating, setUpdating]   = useState<number | null>(null)
  const [showAdd, setShowAdd]     = useState(false)

  function loadPayments() {
    setLoading(true)
    fetch('/api/payments')
      .then(r => r.json())
      .then((d: { payments?: PaymentRow[]; error?: string }) => {
        if (d.error) { setError(d.error); return }
        setPayments(d.payments ?? [])
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadPayments() }, [])

  async function markAs(p: PaymentRow, status: Payment['status']) {
    setUpdating(p.rowIndex)
    try {
      const res = await fetch('/api/payments/mark-received', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowIndex: p.rowIndex, status, account: p.account, deal: p.deal }),
      })
      if (res.ok) {
        setPayments(prev => prev.map(row => row.rowIndex === p.rowIndex ? { ...row, status } : row))
      }
    } catch { /* ignore */ }
    setUpdating(null)
  }

  const filtered = useMemo(() => {
    let list = payments
    if (statusFilter !== 'all') list = list.filter(p => p.status === statusFilter)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(p =>
        p.account.toLowerCase().includes(q) ||
        p.deal.toLowerCase().includes(q)
      )
    }
    return list
  }, [payments, statusFilter, search])

  const summary = useMemo(() => {
    const all = payments
    const invoicedAmt  = all.filter(p => p.status === 'Invoiced').reduce((s, p) => s + p.amount, 0)
    const receivedAmt  = all.filter(p => p.status === 'Received').reduce((s, p) => s + p.amount, 0)
    const overdueAmt   = all.filter(p => isOverdue(p.dueDate, p.status)).reduce((s, p) => s + p.amount, 0)
    const outstandingAmt = all
      .filter(p => p.status !== 'Received')
      .reduce((s, p) => s + p.amount, 0)
    return {
      total:       all.reduce((s, p) => s + p.amount, 0),
      invoiced:    invoicedAmt,
      received:    receivedAmt,
      outstanding: outstandingAmt,
      overdue:     overdueAmt,
      overdueCount: all.filter(p => isOverdue(p.dueDate, p.status)).length,
    }
  }, [payments])

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-6 h-6 border-2 border-mh-vermillion border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (error) return <div className="card text-red-400 text-sm">{error}</div>

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`

  return (
    <div className="space-y-4">
      {showAdd && (
        <AddInvoiceModal
          onClose={() => setShowAdd(false)}
          onAdded={() => { setShowAdd(false); loadPayments() }}
        />
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: 'Total Invoiced',  value: fmt(summary.total),       color: '' },
          { label: 'Received',        value: fmt(summary.received),     color: '#22C55E' },
          { label: 'Invoiced (open)', value: fmt(summary.invoiced),     color: '#60A5FA' },
          { label: 'Outstanding',     value: fmt(summary.outstanding),  color: '#F59E0B' },
          {
            label: `Overdue (${summary.overdueCount})`,
            value: fmt(summary.overdue),
            color: summary.overdueCount > 0 ? '#F87171' : '#9CA3AF',
          },
        ].map(({ label, value, color }) => (
          <div key={label} className="card">
            <p className="text-[10px] font-semibold text-mh-vermillion uppercase tracking-widest mb-2">{label}</p>
            <p className="text-2xl font-semibold text-mh-text" style={color ? { color } : {}}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters + Add Invoice */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Search account or deal…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 max-w-xs bg-mh-surface border border-mh-border rounded-lg px-3 py-1.5 text-xs
            text-mh-text placeholder:text-mh-muted outline-none focus:border-mh-vermillion transition-colors"
        />
        <div className="flex gap-0 border border-mh-border rounded-full overflow-hidden">
          {(['all', 'Invoiced', 'Partial', 'Received', 'Overdue'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`text-xs px-4 py-1.5 font-medium transition-colors
                ${statusFilter === s ? 'bg-mh-vermillion text-white' : 'text-mh-muted hover:text-mh-text'}`}
            >
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>
        <span className="text-xs text-mh-muted ml-auto">{filtered.length} records</span>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-mh-vermillion text-white
            rounded-lg hover:opacity-90 transition-opacity whitespace-nowrap"
        >
          + Add Invoice
        </button>
      </div>

      {/* Table */}
      <div className="card overflow-x-auto">
        {filtered.length === 0 ? (
          <p className="text-mh-muted text-sm italic text-center py-10">No payments match your filters.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-mh-muted text-[10px] uppercase tracking-widest border-b border-mh-border">
                <th className="text-left pb-3 pr-4 font-semibold">Account</th>
                <th className="text-left pb-3 pr-4 font-semibold">Deal</th>
                <th className="text-right pb-3 pr-4 font-semibold">Amount</th>
                <th className="text-left pb-3 pr-4 font-semibold">Invoice Date</th>
                <th className="text-left pb-3 pr-4 font-semibold">Due Date</th>
                <th className="text-left pb-3 pr-4 font-semibold">Status</th>
                <th className="text-left pb-3 pr-4 font-semibold">Notes</th>
                <th className="text-left pb-3 pr-4 font-semibold">Attachment</th>
                <th className="text-left pb-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mh-border">
              {filtered.map(p => {
                const overdue = isOverdue(p.dueDate, p.status)
                return (
                  <tr
                    key={p.rowIndex}
                    className={`hover:bg-mh-surface/40 transition-colors ${overdue ? 'bg-red-500/5' : ''}`}
                  >
                    <td className="py-2.5 pr-4 text-mh-text font-medium max-w-[150px] truncate">{p.account}</td>
                    <td className="py-2.5 pr-4 text-mh-muted text-xs max-w-[130px] truncate">{p.deal || '—'}</td>
                    <td className="py-2.5 pr-4 text-right font-semibold text-mh-text">
                      {fmt(p.amount)}
                    </td>
                    <td className="py-2.5 pr-4 text-mh-muted text-xs whitespace-nowrap">{p.invoiceDate || '—'}</td>
                    <td className={`py-2.5 pr-4 text-xs whitespace-nowrap ${overdue ? 'text-red-400 font-semibold' : 'text-mh-muted'}`}>
                      {p.dueDate || '—'}
                      {overdue && <span className="ml-1 text-[9px]">OVERDUE</span>}
                    </td>
                    <td className="py-2.5 pr-4"><StatusBadge status={p.status} /></td>
                    <td className="py-2.5 pr-4 text-mh-muted text-xs max-w-[150px] truncate" title={p.notes}>{p.notes || '—'}</td>
                    <td className="py-2.5 pr-4">
                      {p.attachmentUrl ? (
                        <a
                          href={p.attachmentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] px-2 py-1 rounded border border-mh-border text-mh-muted
                            hover:text-mh-text hover:border-mh-vermillion transition-colors whitespace-nowrap"
                        >
                          📎 View
                        </a>
                      ) : (
                        <span className="text-[11px] text-mh-border">—</span>
                      )}
                    </td>
                    <td className="py-2.5">
                      {p.status !== 'Received' && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => markAs(p, 'Received')}
                            disabled={updating === p.rowIndex}
                            className="text-[10px] px-2 py-1 rounded border border-green-500/40 text-green-400
                              hover:bg-green-500/10 disabled:opacity-50 transition-colors whitespace-nowrap"
                          >
                            {updating === p.rowIndex ? '…' : 'Mark Received'}
                          </button>
                          {p.status !== 'Partial' && (
                            <button
                              onClick={() => markAs(p, 'Partial')}
                              disabled={updating === p.rowIndex}
                              className="text-[10px] px-2 py-1 rounded border border-purple-500/40 text-purple-400
                                hover:bg-purple-500/10 disabled:opacity-50 transition-colors"
                            >
                              Partial
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
