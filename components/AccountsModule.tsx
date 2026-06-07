'use client'
import { useState, useEffect, useMemo } from 'react'
import { AccountIntelPanel } from './AccountIntelPanel'
import type { AccountIntelligence } from '@/lib/sheets'

const STATUS_ORDER: Record<string, number> = { Active: 0, Won: 1, Warm: 2, Cold: 3, Dead: 4 }
const STATUS_EMOJI: Record<string, string>  = { Won: '✅', Active: '🔥', Warm: '🟡', Cold: '🔵', Dead: '⚫' }

export default function AccountsModule() {
  const [allIntel, setAllIntel] = useState<AccountIntelligence[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [search, setSearch]     = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    fetch('/api/account-intel')
      .then(r => r.json())
      .then((d: { intel?: AccountIntelligence[]; error?: string }) => {
        if (d.error) { setError(d.error); return }
        const sorted = (d.intel ?? []).sort(
          (a, b) => (STATUS_ORDER[a.status] ?? 5) - (STATUS_ORDER[b.status] ?? 5)
        )
        setAllIntel(sorted)
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  // The AccountIntelPanel manages its own selection — we just filter the list fed into it
  const filteredIntel = useMemo(() => {
    return allIntel.filter(i => {
      if (statusFilter !== 'all' && i.status !== statusFilter) return false
      if (search) return i.account.toLowerCase().includes(search.toLowerCase())
      return true
    })
  }, [allIntel, search, statusFilter])

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const i of allIntel) c[i.status] = (c[i.status] ?? 0) + 1
    return c
  }, [allIntel])

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-6 h-6 border-2 border-mh-vermillion border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (error) return <div className="card text-red-400 text-sm">{error}</div>

  return (
    <div className="space-y-4">
      {/* Status pills + search */}
      <div className="card flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          {(['all', 'Active', 'Won', 'Warm', 'Cold', 'Dead'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors
                ${statusFilter === s
                  ? 'bg-mh-vermillion text-white'
                  : 'bg-mh-surface border border-mh-border text-mh-muted hover:text-mh-text'
                }`}
            >
              {s === 'all'
                ? `All ${allIntel.length}`
                : `${STATUS_EMOJI[s]} ${s} ${counts[s] ?? 0}`}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search accounts…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="ml-auto w-56 bg-mh-bg border border-mh-border rounded-lg px-3 py-1.5 text-xs
            text-mh-text placeholder:text-mh-muted outline-none focus:border-mh-vermillion transition-colors"
        />
        <span className="text-xs text-mh-muted">{filteredIntel.length} accounts</span>
      </div>

      {/* Intel panel — handles its own account selection */}
      {filteredIntel.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-mh-muted text-sm italic">No accounts match your filters.</p>
        </div>
      ) : (
        <div className="card">
          <AccountIntelPanel intel={filteredIntel} />
        </div>
      )}
    </div>
  )
}
