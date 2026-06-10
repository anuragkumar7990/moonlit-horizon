'use client'
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { LostDealCategory } from '@/lib/sheets'

type Temperature = 'Hot' | 'Warm' | 'Cold' | null

interface ActiveDeal {
  id: string
  name: string
  account: string
  stage: string
  temperature: Temperature
  amount: string
  closingDate: string
}

interface LostDeal {
  rowIndex: number
  dealId: string
  dealName: string
  account: string
  contactEmail: string
  category: LostDealCategory
  dateMoved: string
  notes: string
}

interface UpcomingMeeting {
  date: string
  contact: string
  company: string
  meetingType: string
  dealId: string
}

interface DealsData {
  active: ActiveDeal[]
  lost: LostDeal[]
  upcoming: UpcomingMeeting[]
}

const KANBAN_STAGES = [
  'Discovery Call booked',
  'Discovery Call Conducted',
  'Outline Meeting Conducted',
  'Negotiation',
  'Payment Pending',
  'Won',
]

const NEGATIVE_CATEGORIES: LostDealCategory[] = [
  'No Shows / Multiple Reschedules',
  'Meeting Rescheduled-Cancelled',
  'Dropped 2025-26',
  'Lost',
]

const TEMP_COLORS: Record<NonNullable<Temperature>, { dot: string; label: string; badge: string }> = {
  Hot:  { dot: '#E8341C', label: '#E8341C', badge: 'rgba(232,52,28,0.15)' },
  Warm: { dot: '#FFD700', label: '#FFD700', badge: 'rgba(255,215,0,0.15)' },
  Cold: { dot: '#5599FF', label: '#6699FF', badge: 'rgba(85,153,255,0.15)' },
}

function TempBadge({ temperature, dealId, onUpdate }: {
  temperature: Temperature
  dealId: string
  onUpdate: (dealId: string, temp: Temperature) => void
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      const target = e.target as Node
      if (
        btnRef.current && !btnRef.current.contains(target) &&
        (dropRef.current == null || !dropRef.current.contains(target))
      ) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function handleToggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left })
    }
    setOpen(o => !o)
  }

  const c = temperature ? TEMP_COLORS[temperature] : null

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleToggle}
        className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider"
        style={c ? { background: c.badge, color: c.label } : { background: 'rgba(255,255,255,0.06)', color: '#888899' }}
      >
        {c && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c.dot }} />}
        {temperature ?? 'Unassigned'}
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={dropRef}
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            zIndex: 99999,
            background: 'rgba(10,10,18,0.98)',
            border: '1px solid rgba(255,255,255,0.12)',
            backdropFilter: 'blur(16px)',
            borderRadius: '12px',
            padding: '4px 0',
            minWidth: '110px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          }}
        >
          {(['Hot', 'Warm', 'Cold', null] as Temperature[]).map(t => (
            <button
              key={t ?? 'none'}
              onClick={() => { setOpen(false); onUpdate(dealId, t) }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-white/5 text-left"
            >
              {t ? <span className="w-2 h-2 rounded-full shrink-0" style={{ background: TEMP_COLORS[t].dot }} /> : <span className="w-2 h-2 shrink-0" />}
              <span style={{ color: t ? TEMP_COLORS[t].label : '#888899' }}>{t ?? 'Unassigned'}</span>
              {temperature === t && <span className="ml-auto text-[10px] opacity-60">✓</span>}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}

function DealCard({
  deal,
  onTempUpdate,
  onMoveToNegative,
}: {
  deal: ActiveDeal
  onTempUpdate: (id: string, t: Temperature) => void
  onMoveToNegative: (deal: ActiveDeal) => void
}) {
  return (
    <div
      className="card py-2 px-3 mb-2 cursor-grab select-none text-xs"
      draggable
      onDragStart={e => e.dataTransfer.setData('dealId', deal.id)}
    >
      <div className="font-semibold text-mh-text text-[11px] leading-tight mb-1 truncate" title={deal.name}>{deal.name}</div>
      <div className="text-mh-muted truncate mb-2" title={deal.account}>{deal.account}</div>
      <div className="flex items-center justify-between gap-2">
        <TempBadge temperature={deal.temperature} dealId={deal.id} onUpdate={onTempUpdate} />
        {deal.amount && deal.amount !== 'null' && (
          <span className="text-[10px] text-mh-muted">₹{Number(deal.amount).toLocaleString('en-IN')}</span>
        )}
      </div>
      <button
        onClick={() => onMoveToNegative(deal)}
        className="mt-2 text-[9px] text-mh-muted/50 hover:text-mh-muted transition-colors"
      >
        Move to negative ↓
      </button>
    </div>
  )
}

function NegativeCard({
  category,
  deals,
  onDrop,
  onClick,
}: {
  category: LostDealCategory
  deals: LostDeal[]
  onDrop: (dealId: string, category: LostDealCategory) => void
  onClick: () => void
}) {
  const [over, setOver] = useState(false)
  const COLORS: Record<LostDealCategory, string> = {
    'No Shows / Multiple Reschedules': '#E8341C',
    'Meeting Rescheduled-Cancelled':   '#FF8C42',
    'Dropped 2025-26':                 '#FFD700',
    'Lost':                            '#E8341C',
  }
  const color = COLORS[category]

  return (
    <div
      className="card py-3 px-4 cursor-pointer transition-all"
      style={{
        borderColor: over ? color : undefined,
        background: over ? `${color}10` : undefined,
      }}
      onDragOver={e => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={e => {
        e.preventDefault()
        setOver(false)
        const id = e.dataTransfer.getData('dealId')
        if (id) onDrop(id, category)
      }}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold" style={{ color }}>{category}</span>
        <span className="text-lg font-bold" style={{ color }}>{deals.length}</span>
      </div>
      <p className="text-[10px] text-mh-muted mt-0.5">Drop deals here or click to view</p>
    </div>
  )
}

export default function DealsModule() {
  const [data, setData] = useState<DealsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [tempFilter, setTempFilter] = useState<Temperature | 'All'>('All')
  const [negativeModal, setNegativeModal] = useState<{ category: LostDealCategory } | null>(null)
  const [moveModal, setMoveModal] = useState<{ deal: ActiveDeal } | null>(null)
  const [restoreModal, setRestoreModal] = useState<{ lostDeal: LostDeal } | null>(null)
  const [pendingCategory, setPendingCategory] = useState<LostDealCategory>('Lost')
  const [pendingNotes, setPendingNotes] = useState('')
  const [restoreStage, setRestoreStage] = useState(KANBAN_STAGES[0])

  async function load(background = false) {
    if (!background) setLoading(true)
    try {
      const res = await fetch('/api/deals')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const d = await res.json() as DealsData
      setData(d)
      setError(null)
    } catch (e) {
      setError(String(e))
    } finally {
      if (!background) setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const interval = setInterval(() => load(true), 30_000)
    return () => clearInterval(interval)
  }, [])

  async function handleTempUpdate(dealId: string, temperature: Temperature) {
    if (!data) return
    // Optimistic — don't reload after; Zoho is async and would revert the value
    setData(prev => prev ? {
      ...prev,
      active: prev.active.map(d => d.id === dealId ? { ...d, temperature } : d),
    } : prev)
    fetch('/api/update-deal-temperature', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dealId, temperature }),
    })
  }

  async function handleKanbanDrop(e: React.DragEvent, newStage: string) {
    e.preventDefault()
    const dealId = e.dataTransfer.getData('dealId')
    if (!dealId) return
    const deal = data?.active.find(d => d.id === dealId)
    if (!deal || deal.stage === newStage) return
    // Optimistic — don't reload after; Zoho is async and would revert the value
    setData(prev => prev ? {
      ...prev,
      active: prev.active.map(d => d.id === dealId ? { ...d, stage: newStage } : d),
    } : prev)
    fetch('/api/update-deal-stage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dealId, stage: newStage }),
    })
  }

  async function handleMoveToNegative(deal: ActiveDeal, category: LostDealCategory, notes: string) {
    // Optimistic: remove from active immediately
    setData(prev => prev ? { ...prev, active: prev.active.filter(d => d.id !== deal.id) } : prev)
    setMoveModal(null)
    setPendingNotes('')
    await fetch('/api/move-deal-to-lost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dealId: deal.id, dealName: deal.name, account: deal.account, category, notes }),
    })
    load(true)
  }

  async function handleDrop(dealId: string, category: LostDealCategory) {
    const deal = data?.active.find(d => d.id === dealId)
    if (!deal) return
    setMoveModal({ deal })
    setPendingCategory(category)
  }

  async function handleRestore(lostDeal: LostDeal, targetStage: string) {
    // Optimistic: remove from lost immediately
    setData(prev => prev ? { ...prev, lost: prev.lost.filter(d => d.rowIndex !== lostDeal.rowIndex) } : prev)
    setRestoreModal(null)
    await fetch('/api/restore-deal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sheetRowIndex: lostDeal.rowIndex, dealId: lostDeal.dealId, targetStage }),
    })
    load(true)
  }

  const filtered = (data?.active ?? []).filter(d => {
    const matchSearch = !search || d.name.toLowerCase().includes(search.toLowerCase()) || d.account.toLowerCase().includes(search.toLowerCase())
    const matchTemp = tempFilter === 'All' || d.temperature === tempFilter || (tempFilter === null && !d.temperature)
    return matchSearch && matchTemp
  })

  const byStage = (stage: string) => filtered.filter(d => d.stage.toLowerCase() === stage.toLowerCase())

  const STAGE_COLORS: Record<string, string> = {
    'Discovery Call booked':     '#6699FF',
    'Discovery Call Conducted':  '#5588EE',
    'Outline Meeting Conducted': '#9966FF',
    'Negotiation':               '#FFD700',
    'Payment Pending':           '#FF8C42',
    'Won':                       '#22C55E',
  }

  const lostByCategory = (cat: LostDealCategory) => (data?.lost ?? []).filter(d => d.category === cat)

  const todayIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const tomorrowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000 + 86400000).toISOString().slice(0, 10)
  const nextWeekIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000 + 7 * 86400000).toISOString().slice(0, 10)

  const bucketLabel = (date: string) => {
    if (date === todayIST) return 'Today'
    if (date === tomorrowIST) return 'Tomorrow'
    if (date <= nextWeekIST) return 'This Week'
    return 'Next Week+'
  }

  const CARD_HEIGHT = '240px'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-mh-vermillion border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {error && (
        <div className="card border-red-500/40 bg-red-500/10 text-red-400 text-sm px-4 py-3">
          Failed to load deals: {error}. <button onClick={() => load()} className="underline ml-1">Retry</button>
        </div>
      )}

      {/* Row 1: Upcoming Meetings + Pipeline */}
      <div className="grid grid-cols-[280px_1fr] gap-4">

        {/* Upcoming Meetings */}
        <div className="card flex flex-col" style={{ maxHeight: CARD_HEIGHT }}>
          <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest mb-3 shrink-0">Upcoming Meetings</p>
          {(data?.upcoming ?? []).length === 0 ? (
            <p className="text-mh-muted text-xs italic">No upcoming meetings booked.</p>
          ) : (
            <div className="overflow-y-auto space-y-0 flex-1" style={{ maxHeight: '190px' }}>
              {(data?.upcoming ?? []).slice(0, 5).map((m, i) => (
                <div key={i} className="flex items-start gap-2 py-1.5 border-b border-mh-border last:border-0">
                  <div className="text-[9px] text-mh-muted uppercase bg-mh-border/30 rounded px-1.5 py-0.5 mt-0.5 shrink-0">
                    {bucketLabel(m.date.slice(0, 10))}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-mh-text truncate">{m.company}</p>
                    <p className="text-[10px] text-mh-muted truncate">{m.contact} · {m.meetingType}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pipeline Funnel */}
        <div className="card flex flex-col" style={{ maxHeight: CARD_HEIGHT }}>
          <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest mb-3 shrink-0">Pipeline</p>
          <div className="space-y-2 overflow-y-auto flex-1">
            {KANBAN_STAGES.map(stage => {
              const count = (data?.active ?? []).filter(d => d.stage === stage).length
              const maxCount = Math.max(...KANBAN_STAGES.map(s => (data?.active ?? []).filter(d => d.stage === s).length), 1)
              const pct = maxCount > 0 ? Math.max((count / maxCount) * 100, count > 0 ? 8 : 0) : 0
              const col = STAGE_COLORS[stage] ?? '#888899'
              return (
                <div key={stage} className="flex items-center gap-3">
                  <span className="text-[10px] text-mh-muted w-44 shrink-0 truncate">{stage}</span>
                  <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: col }} />
                  </div>
                  <span className="text-xs font-semibold text-mh-text w-4 text-right">{count}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <div>
        <div className="flex items-center gap-4 mb-3">
          <p className="text-base font-bold text-mh-text">Kanban Board</p>
          <div className="flex items-center gap-2 flex-1">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search deals..."
              className="border border-mh-border rounded-lg px-3 py-1 text-xs placeholder:text-mh-muted outline-none focus:border-mh-vermillion/50 w-40"
              style={{ color: '#E5E7EB', background: '#0d0d1a' }}
            />
            <div className="flex items-center gap-1">
              {(['All', 'Hot', 'Warm', 'Cold'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTempFilter(t === 'All' ? 'All' : t as Temperature)}
                  className="px-2.5 py-0.5 rounded-full text-[10px] font-medium transition-all whitespace-nowrap"
                  style={tempFilter === t
                    ? { background: t === 'All' ? '#444' : TEMP_COLORS[t as NonNullable<Temperature>].badge, color: t === 'All' ? '#fff' : TEMP_COLORS[t as NonNullable<Temperature>].label, border: `1px solid ${t === 'All' ? '#666' : TEMP_COLORS[t as NonNullable<Temperature>].dot}` }
                    : { background: 'rgba(255,255,255,0.04)', color: '#888899', border: '1px solid rgba(255,255,255,0.08)' }
                  }
                >
                  {t}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-mh-muted ml-auto">{filtered.length} deals</span>
          </div>
        </div>
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${KANBAN_STAGES.length}, minmax(0, 1fr))` }}>
          {KANBAN_STAGES.map(stage => {
            const cards = byStage(stage)
            const col = STAGE_COLORS[stage] ?? '#888899'
            return (
              <div
                key={stage}
                className="rounded-xl p-2 min-h-[120px]"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                onDragOver={e => e.preventDefault()}
                onDrop={e => handleKanbanDrop(e, stage)}
              >
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider truncate" style={{ color: col }}>{stage}</span>
                  <span className="text-[11px] font-bold ml-1 shrink-0" style={{ color: col }}>{cards.length}</span>
                </div>
                {cards.map(deal => (
                  <DealCard
                    key={deal.id}
                    deal={deal}
                    onTempUpdate={handleTempUpdate}
                    onMoveToNegative={d => { setMoveModal({ deal: d }); setPendingCategory('Lost') }}
                  />
                ))}
                {cards.length === 0 && (
                  <p className="text-[10px] text-mh-muted/30 italic px-1 py-4 text-center">Empty</p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Negative Zone */}
      <div>
        <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest mb-3">Negative Zone</p>
        <div className="grid grid-cols-4 gap-3">
          {NEGATIVE_CATEGORIES.map(cat => (
            <NegativeCard
              key={cat}
              category={cat}
              deals={lostByCategory(cat)}
              onDrop={handleDrop}
              onClick={() => setNegativeModal({ category: cat })}
            />
          ))}
        </div>
      </div>

      {/* Move to Negative Modal */}
      {moveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="card w-full max-w-sm mx-4 space-y-4">
            <p className="text-sm font-semibold text-mh-text">Move &quot;{moveModal.deal.name}&quot; to Negative Zone</p>
            <div>
              <label className="text-[10px] text-mh-muted uppercase tracking-widest block mb-1">Category</label>
              <select
                value={pendingCategory}
                onChange={e => setPendingCategory(e.target.value as LostDealCategory)}
                className="w-full border border-mh-border rounded-lg px-3 py-2 text-sm"
                style={{ color: '#E5E7EB', background: '#0d0d1a' }}
              >
                {NEGATIVE_CATEGORIES.map(c => <option key={c} value={c} style={{ background: '#0d0d1a', color: '#E5E7EB' }}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-mh-muted uppercase tracking-widest block mb-1">Notes (optional)</label>
              <textarea
                value={pendingNotes}
                onChange={e => setPendingNotes(e.target.value)}
                rows={2}
                placeholder="Why is this deal here?"
                className="w-full border border-mh-border rounded-lg px-3 py-2 text-sm placeholder:text-mh-muted resize-none outline-none focus:border-mh-vermillion/50"
                style={{ color: '#E5E7EB', background: '#0d0d1a' }}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setMoveModal(null)} className="px-4 py-1.5 text-sm text-mh-muted hover:text-mh-text">Cancel</button>
              <button
                onClick={() => handleMoveToNegative(moveModal.deal, pendingCategory, pendingNotes)}
                className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, #E8341C, #FF5A3A)' }}
              >
                Move
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Negative Category Detail Modal */}
      {negativeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="card w-full max-w-xl mx-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-mh-text">{negativeModal.category}</p>
              <button onClick={() => setNegativeModal(null)} className="text-mh-muted hover:text-mh-text text-lg">×</button>
            </div>
            {lostByCategory(negativeModal.category).length === 0 ? (
              <p className="text-mh-muted text-sm italic">No deals here.</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] text-mh-muted uppercase tracking-widest border-b border-mh-border">
                    <th className="text-left py-2">Deal</th>
                    <th className="text-left py-2">Account</th>
                    <th className="text-left py-2">Date</th>
                    <th className="text-left py-2">Notes</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {lostByCategory(negativeModal.category).map(d => (
                    <tr key={d.rowIndex} className="border-b border-mh-border/50 hover:bg-white/2">
                      <td className="py-2 pr-2 text-mh-text">{d.dealName}</td>
                      <td className="py-2 pr-2 text-mh-muted">{d.account}</td>
                      <td className="py-2 pr-2 text-mh-muted whitespace-nowrap">{d.dateMoved}</td>
                      <td className="py-2 pr-2 text-mh-muted text-[10px]">{d.notes}</td>
                      <td className="py-2">
                        <button
                          onClick={() => { setRestoreModal({ lostDeal: d }); setRestoreStage(KANBAN_STAGES[0]); setNegativeModal(null) }}
                          className="text-[10px] text-blue-400 hover:text-blue-300"
                        >
                          Restore
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Restore Modal */}
      {restoreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="card w-full max-w-sm mx-4 space-y-4">
            <p className="text-sm font-semibold text-mh-text">Restore &quot;{restoreModal.lostDeal.dealName}&quot;</p>
            <div>
              <label className="text-[10px] text-mh-muted uppercase tracking-widest block mb-1">Target Stage</label>
              <select
                value={restoreStage}
                onChange={e => setRestoreStage(e.target.value)}
                className="w-full border border-mh-border rounded-lg px-3 py-2 text-sm"
                style={{ color: '#E5E7EB', background: '#0d0d1a' }}
              >
                {KANBAN_STAGES.map(s => <option key={s} value={s} style={{ background: '#0d0d1a', color: '#E5E7EB' }}>{s}</option>)}
              </select>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setRestoreModal(null)} className="px-4 py-1.5 text-sm text-mh-muted hover:text-mh-text">Cancel</button>
              <button
                onClick={() => handleRestore(restoreModal.lostDeal, restoreStage)}
                className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, #22C55E, #16A34A)' }}
              >
                Restore
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
