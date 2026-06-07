'use client'
import { useState, useEffect, useMemo } from 'react'
import type { Payment } from '@/lib/sheets'

interface PaymentRow extends Payment {
  rowIndex: number
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

export default function PaymentsModule() {
  const [payments, setPayments]   = useState<PaymentRow[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch]       = useState('')
  const [updating, setUpdating]   = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/payments')
      .then(r => r.json())
      .then((d: { payments?: PaymentRow[]; error?: string }) => {
        if (d.error) { setError(d.error); return }
        setPayments(d.payments ?? [])
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  async function markAs(rowIndex: number, status: Payment['status']) {
    setUpdating(rowIndex)
    try {
      const res = await fetch('/api/payments/mark-received', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowIndex, status }),
      })
      if (res.ok) {
        setPayments(prev =>
          prev.map(p => p.rowIndex === rowIndex ? { ...p, status } : p)
        )
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
      {/* Summary cards */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: 'Total Invoiced',  value: fmt(summary.total),       color: 'text-mh-text' },
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
            <p className="text-2xl font-semibold" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
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
                    <td className="py-2.5">
                      {p.status !== 'Received' && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => markAs(p.rowIndex, 'Received')}
                            disabled={updating === p.rowIndex}
                            className="text-[10px] px-2 py-1 rounded border border-green-500/40 text-green-400
                              hover:bg-green-500/10 disabled:opacity-50 transition-colors whitespace-nowrap"
                          >
                            {updating === p.rowIndex ? '…' : 'Mark Received'}
                          </button>
                          {p.status !== 'Partial' && (
                            <button
                              onClick={() => markAs(p.rowIndex, 'Partial')}
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
