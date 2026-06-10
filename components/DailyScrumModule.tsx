'use client'
import { useState, useEffect } from 'react'

interface ScrumNote {
  rowIndex: number
  date: string
  slotTime: string
  notes: string
  actionItems: string
  meetingHappened: boolean
}

interface ScheduledMeeting {
  meetingId: string
  accountName: string
  contactName: string
  meetingType: string
  conducted: boolean
  startTime?: string
  source?: 'sheets' | 'zoho' | 'calendar'
  circlebakNotes: string | null
}

interface HotLead {
  name: string
  account: string
  stage: string
  amount: string
}

interface P0Task {
  task: string
  linkedDeal: string
  type: string
  status: string
}

interface ScrumData {
  today: string
  stats: { dialled: number; connected: number; meetingsBooked: number }
  dailyTargets: { dialled: number; connected: number; meetingsBooked: number }
  scheduledMeetings: ScheduledMeeting[]
  hotLeads: HotLead[]
  p0Tasks: P0Task[]
  suggestedItems: string[]
  todayNotes: ScrumNote[]
  past: { date: string; slots: ScrumNote[] }[]
}

type Tab = 'morning' | 'evening'

const DARK_INPUT = { background: '#0d0d1a', color: '#E5E7EB' }

function StatBar({
  label,
  actual,
  target,
  color,
}: {
  label: string
  actual: number
  target: number
  color: string
}) {
  const pct = target > 0 ? Math.min((actual / target) * 100, 100) : 0
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-mh-muted uppercase tracking-widest">{label}</span>
        <span className="text-xs font-semibold" style={{ color }}>
          {actual}<span className="text-mh-muted font-normal">/{target || '–'}</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  )
}

export default function DailyScrumModule() {
  const [data, setData] = useState<ScrumData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('morning')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [actionItems, setActionItems] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [editingSlot, setEditingSlot] = useState<ScrumNote | null>(null)
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set())
  const [conductedState, setConductedState] = useState<Record<string, boolean>>({})

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/scrum')
      const d = await res.json() as ScrumData
      setData(d)
      setSelectedDate(prev => prev ?? d.today)
      const existing = d.todayNotes[0]
      if (existing) {
        setNotes(existing.notes)
        setActionItems(existing.actionItems)
      }
      const initial: Record<string, boolean> = {}
      for (const m of d.scheduledMeetings) initial[m.meetingId] = m.conducted
      setConductedState(prev => ({ ...initial, ...prev }))
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function save() {
    if (!data) return
    setSaving(true)
    const existing = data.todayNotes[0]
    await fetch('/api/scrum', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: data.today,
        slotTime: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }),
        notes,
        actionItems,
        meetingHappened: true,
        ...(existing?.rowIndex ? { rowIndex: existing.rowIndex } : {}),
      }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    await load()
  }

  async function markSkipped() {
    if (!data) return
    await fetch('/api/scrum', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: data.today, slotTime: 'N/A', notes: '', actionItems: '', meetingHappened: false }),
    })
    await load()
  }

  async function toggleConducted(meetingId: string, current: boolean) {
    const newStatus = current ? 'Meeting Booked' : 'Conducted'
    setConductedState(prev => ({ ...prev, [meetingId]: !current }))
    await fetch(`/api/meetings/${meetingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
  }

  async function saveEditedSlot() {
    if (!editingSlot) return
    await fetch('/api/scrum', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: editingSlot.date,
        slotTime: editingSlot.slotTime,
        notes: editingSlot.notes,
        actionItems: editingSlot.actionItems,
        meetingHappened: editingSlot.meetingHappened,
        rowIndex: editingSlot.rowIndex,
      }),
    })
    setEditingSlot(null)
    await load()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-mh-vermillion border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!data) return <p className="text-mh-muted text-sm italic">Failed to load scrum data.</p>

  const isToday = selectedDate === data.today
  const pastSlots = selectedDate && selectedDate !== data.today
    ? (data.past.find(p => p.date === selectedDate)?.slots ?? [])
    : null

  return (
    <div className="flex gap-4">

      {/* ── Left sidebar ────────────────────────────────────────────────── */}
      <div className="shrink-0 flex flex-col gap-1 overflow-y-auto" style={{ width: '168px', maxHeight: '72vh' }}>
        <p className="text-[9px] font-semibold text-mh-muted uppercase tracking-widest mb-2 px-1">Scrum History</p>

        <button
          onClick={() => setSelectedDate(data.today)}
          className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all"
          style={selectedDate === data.today
            ? { background: 'linear-gradient(135deg, rgba(232,52,28,0.15), rgba(255,90,58,0.08))', color: '#E8341C', border: '1px solid rgba(232,52,28,0.3)' }
            : { background: 'rgba(255,255,255,0.03)', color: '#888899', border: '1px solid transparent' }
          }
        >
          Today
          <span className="block text-[10px] opacity-60 mt-0.5">{data.today}</span>
        </button>

        {data.past.map(({ date, slots }) => {
          const hasNotes = slots.some(s => s.notes || s.actionItems)
          const allSkipped = slots.every(s => !s.meetingHappened)
          return (
            <button
              key={date}
              onClick={() => setSelectedDate(date)}
              className="w-full text-left px-3 py-2 rounded-lg text-xs transition-all"
              style={selectedDate === date
                ? { background: 'rgba(255,255,255,0.07)', color: '#E5E7EB', border: '1px solid rgba(255,255,255,0.12)' }
                : { background: 'rgba(255,255,255,0.02)', color: '#888899', border: '1px solid transparent' }
              }
            >
              {date}
              <span
                className="block text-[9px] mt-0.5"
                style={{ color: allSkipped ? '#555566' : hasNotes ? '#22C55E' : '#FFD700' }}
              >
                {allSkipped ? 'Skipped' : hasNotes ? 'Notes saved' : 'No notes'}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-4">

        {/* Tab bar */}
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-1 rounded-full p-1"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            {(['morning', 'evening'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="text-xs px-4 py-1.5 rounded-full font-medium capitalize transition-all"
                style={tab === t
                  ? { background: 'linear-gradient(135deg, #E8341C, #FF5A3A)', color: '#fff', boxShadow: '0 0 10px rgba(232,52,28,0.35)' }
                  : { color: '#888899' }
                }
              >
                {t === 'morning' ? '☀ Morning' : '☾ Evening'}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-mh-muted">
            {isToday ? `Today — ${data.today}` : `Viewing ${selectedDate}`}
            {!isToday && <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-mh-muted">Read-only</span>}
          </p>
        </div>

        {/* ── PAST DATE ──────────────────────────────────────────────────── */}
        {!isToday && pastSlots !== null && (
          <div className="space-y-3">
            {pastSlots.length === 0 ? (
              <p className="text-mh-muted text-sm italic">No scrum notes recorded for {selectedDate}.</p>
            ) : (
              pastSlots.map(s => (
                <div key={s.rowIndex} className="card space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-mh-muted">{s.slotTime || 'Logged'}</span>
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full"
                        style={{
                          background: s.meetingHappened ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)',
                          color: s.meetingHappened ? '#22C55E' : '#888899',
                        }}
                      >
                        {s.meetingHappened ? 'Happened' : 'Skipped'}
                      </span>
                      <button onClick={() => setEditingSlot({ ...s })} className="text-[10px] text-blue-400 hover:text-blue-300">Edit</button>
                    </div>
                  </div>
                  {s.notes && <p className="text-sm text-mh-text">{s.notes}</p>}
                  {s.actionItems && (
                    <div className="text-xs text-mh-muted space-y-0.5">
                      {s.actionItems.split('\n').filter(Boolean).map((a, i) => <p key={i}>→ {a}</p>)}
                    </div>
                  )}
                  {!s.notes && !s.actionItems && (
                    <p className="text-xs text-mh-muted italic">{s.meetingHappened ? 'No notes recorded.' : 'Skipped.'}</p>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* ── TODAY: MORNING ──────────────────────────────────────────────── */}
        {isToday && tab === 'morning' && (
          <div className="space-y-4">

            {/* Day Targets */}
            <div className="card space-y-3">
              <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest">Day Targets</p>
              <div className="grid grid-cols-3 gap-5">
                <StatBar label="Dialled"     actual={0} target={data.dailyTargets.dialled}        color="#E8341C" />
                <StatBar label="Connected"   actual={0} target={data.dailyTargets.connected}      color="#22C55E" />
                <StatBar label="Mtgs Booked" actual={0} target={data.dailyTargets.meetingsBooked} color="#FFD700" />
              </div>
            </div>

            {/* Meetings Today */}
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest">Meetings Scheduled Today</p>
                <span className="text-sm font-bold text-mh-text">{data.scheduledMeetings.length}</span>
              </div>
              {data.scheduledMeetings.length === 0 ? (
                <p className="text-mh-muted text-xs italic">No meetings scheduled for today.</p>
              ) : (
                <div className="space-y-2">
                  {data.scheduledMeetings.map(m => (
                    <div key={m.meetingId} className="flex items-center gap-3 py-2 border-b border-mh-border last:border-0">
                      <span
                        className="text-[9px] px-2 py-0.5 rounded-full font-semibold uppercase shrink-0"
                        style={{
                          background: m.meetingType === 'L2+' ? 'rgba(255,215,0,0.15)' : 'rgba(102,153,255,0.15)',
                          color: m.meetingType === 'L2+' ? '#FFD700' : '#6699FF',
                        }}
                      >
                        {m.meetingType}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-mh-text truncate">{m.accountName}</p>
                        {m.contactName && <p className="text-[10px] text-mh-muted">{m.contactName}</p>}
                      </div>
                      {m.source === 'calendar' && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded shrink-0" style={{ background: 'rgba(66,133,244,0.15)', color: '#4285F4' }}>GCal</span>
                      )}
                      {m.source === 'zoho' && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded shrink-0" style={{ background: 'rgba(255,140,0,0.15)', color: '#FF8C00' }}>Zoho</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Hot Leads */}
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest">Hot Leads</p>
                <span className="text-sm font-bold" style={{ color: '#E8341C' }}>{data.hotLeads.length}</span>
              </div>
              {data.hotLeads.length === 0 ? (
                <p className="text-mh-muted text-xs italic">No hot leads at the moment.</p>
              ) : (
                <div className="space-y-2">
                  {data.hotLeads.map((l, i) => (
                    <div key={i} className="flex items-center gap-3 py-1.5 border-b border-mh-border last:border-0">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: '#E8341C', boxShadow: '0 0 6px rgba(232,52,28,0.7)' }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-mh-text truncate">{l.account}</p>
                        <p className="text-[10px] text-mh-muted truncate">{l.stage}</p>
                      </div>
                      {l.amount && l.amount !== 'null' && (
                        <span className="text-[10px] text-mh-muted shrink-0">₹{Number(l.amount).toLocaleString('en-IN')}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* P0 Tasks */}
            <div className="card">
              <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest mb-3">P0 Tasks Today</p>
              {data.p0Tasks.length === 0 ? (
                <p className="text-mh-muted text-xs italic">No P0 tasks for today.</p>
              ) : (
                <ul className="space-y-2">
                  {data.p0Tasks.map((t, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs">
                      <span className="text-mh-vermillion mt-0.5 shrink-0">•</span>
                      <span className="text-mh-text">{t.task}{t.linkedDeal ? <span className="text-mh-muted ml-2">({t.linkedDeal})</span> : null}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

          </div>
        )}

        {/* ── TODAY: EVENING ──────────────────────────────────────────────── */}
        {isToday && tab === 'evening' && (
          <div className="space-y-4">

            {/* Actuals vs Targets */}
            <div className="card space-y-3">
              <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest">Actuals vs Targets</p>
              <div className="grid grid-cols-3 gap-5">
                <StatBar label="Dialled"     actual={data.stats.dialled}       target={data.dailyTargets.dialled}        color="#E8341C" />
                <StatBar label="Connected"   actual={data.stats.connected}      target={data.dailyTargets.connected}      color="#22C55E" />
                <StatBar label="Mtgs Booked" actual={data.stats.meetingsBooked} target={data.dailyTargets.meetingsBooked} color="#FFD700" />
              </div>
            </div>

            {/* Meeting Check-in */}
            <div className="card">
              <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest mb-3">Meeting Check-in</p>
              {data.scheduledMeetings.length === 0 ? (
                <p className="text-mh-muted text-xs italic">No meetings scheduled today.</p>
              ) : (
                <div className="space-y-3">
                  {data.scheduledMeetings.map(m => {
                    const isConducted = conductedState[m.meetingId] ?? m.conducted
                    const hasCircle = !!(m.circlebakNotes?.trim())
                    const expanded = expandedNotes.has(m.meetingId)
                    return (
                      <div
                        key={m.meetingId}
                        className="rounded-lg p-3"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                      >
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => toggleConducted(m.meetingId, isConducted)}
                            className="flex items-center justify-center w-5 h-5 rounded-full border-2 shrink-0 transition-all"
                            style={isConducted
                              ? { background: '#22C55E', borderColor: '#22C55E' }
                              : { borderColor: 'rgba(255,255,255,0.25)' }
                            }
                          >
                            {isConducted && <span className="text-white text-[10px] font-bold leading-none">✓</span>}
                          </button>
                          <span
                            className="text-[9px] px-2 py-0.5 rounded-full font-semibold uppercase shrink-0"
                            style={{
                              background: m.meetingType === 'L2+' ? 'rgba(255,215,0,0.15)' : 'rgba(102,153,255,0.15)',
                              color: m.meetingType === 'L2+' ? '#FFD700' : '#6699FF',
                            }}
                          >
                            {m.meetingType}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-mh-text truncate">{m.accountName}</p>
                            {m.contactName && <p className="text-[10px] text-mh-muted">{m.contactName}</p>}
                          </div>
                          <span
                            className="text-[10px] shrink-0 px-2 py-0.5 rounded-full"
                            style={{
                              background: isConducted ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)',
                              color: isConducted ? '#22C55E' : '#888899',
                            }}
                          >
                            {isConducted ? 'Conducted' : 'Pending'}
                          </span>
                          {m.source === 'calendar' && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded shrink-0" style={{ background: 'rgba(66,133,244,0.15)', color: '#4285F4' }}>GCal</span>
                          )}
                          {m.source === 'zoho' && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded shrink-0" style={{ background: 'rgba(255,140,0,0.15)', color: '#FF8C00' }}>Zoho</span>
                          )}
                          {hasCircle && (
                            <button
                              onClick={() => setExpandedNotes(prev => {
                                const n = new Set(prev)
                                expanded ? n.delete(m.meetingId) : n.add(m.meetingId)
                                return n
                              })}
                              className="text-[10px] text-blue-400 hover:text-blue-300 shrink-0"
                            >
                              Circleback {expanded ? '▲' : '▼'}
                            </button>
                          )}
                        </div>
                        {hasCircle && expanded && (
                          <div
                            className="mt-3 pt-3 border-t text-xs text-mh-muted leading-relaxed whitespace-pre-wrap"
                            style={{ borderColor: 'rgba(255,255,255,0.07)' }}
                          >
                            {m.circlebakNotes}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Discussion Items */}
            <div className="card py-3">
              <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest mb-2">Discussion Items</p>
              <ul className="space-y-1">
                {data.suggestedItems.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-mh-text">
                    <span className="text-mh-vermillion mt-0.5 shrink-0">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Notes + Action Items */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest block mb-1">Notes</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={5}
                  placeholder="What was discussed? What's blocking progress?"
                  className="w-full border border-mh-border rounded-lg px-3 py-2 text-sm placeholder:text-mh-muted resize-none outline-none focus:border-mh-vermillion/50"
                  style={DARK_INPUT}
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest block mb-1">Action Items</label>
                <textarea
                  value={actionItems}
                  onChange={e => setActionItems(e.target.value)}
                  rows={5}
                  placeholder="One action per line..."
                  className="w-full border border-mh-border rounded-lg px-3 py-2 text-sm placeholder:text-mh-muted resize-none outline-none focus:border-mh-vermillion/50"
                  style={DARK_INPUT}
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={save}
                disabled={saving}
                className="px-5 py-2 rounded-lg text-sm font-semibold text-white transition-all"
                style={{ background: 'linear-gradient(135deg, #E8341C, #FF5A3A)', opacity: saving ? 0.6 : 1 }}
              >
                {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Scrum Notes'}
              </button>
              <button
                onClick={markSkipped}
                className="px-4 py-2 rounded-lg text-sm text-mh-muted hover:text-mh-text border border-mh-border"
              >
                Mark as Skipped
              </button>
            </div>
          </div>
        )}

      </div>

      {/* ── Edit Past Slot Modal ─────────────────────────────────────────── */}
      {editingSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="card w-full max-w-md mx-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-mh-text">Edit Scrum — {editingSlot.date}</p>
              <label className="flex items-center gap-2 text-xs text-mh-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={editingSlot.meetingHappened}
                  onChange={e => setEditingSlot(s => s ? { ...s, meetingHappened: e.target.checked } : s)}
                  className="accent-mh-vermillion"
                />
                Meeting happened
              </label>
            </div>
            <textarea
              value={editingSlot.notes}
              onChange={e => setEditingSlot(s => s ? { ...s, notes: e.target.value } : s)}
              rows={4}
              placeholder="Notes..."
              className="w-full border border-mh-border rounded-lg px-3 py-2 text-sm placeholder:text-mh-muted resize-none outline-none"
              style={DARK_INPUT}
            />
            <textarea
              value={editingSlot.actionItems}
              onChange={e => setEditingSlot(s => s ? { ...s, actionItems: e.target.value } : s)}
              rows={3}
              placeholder="Action items (one per line)..."
              className="w-full border border-mh-border rounded-lg px-3 py-2 text-sm placeholder:text-mh-muted resize-none outline-none"
              style={DARK_INPUT}
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditingSlot(null)} className="px-4 py-1.5 text-sm text-mh-muted">Cancel</button>
              <button
                onClick={saveEditedSlot}
                className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, #E8341C, #FF5A3A)' }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
