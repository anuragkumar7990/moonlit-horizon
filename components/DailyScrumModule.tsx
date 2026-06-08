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

interface ScrumData {
  today: string
  stats: { dialled: number; connected: number; meetingsBooked: number }
  suggestedItems: string[]
  todayNotes: ScrumNote[]
  past: { date: string; slots: ScrumNote[] }[]
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="card py-2 px-4 text-center">
      <div className="text-2xl font-bold text-mh-text">{value}</div>
      <div className="text-[10px] text-mh-muted uppercase tracking-widest mt-0.5">{label}</div>
    </div>
  )
}

export default function DailyScrumModule() {
  const [data, setData] = useState<ScrumData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState('')
  const [actionItems, setActionItems] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [expandedDate, setExpandedDate] = useState<string | null>(null)
  const [editingSlot, setEditingSlot] = useState<ScrumNote | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/scrum')
      const d = await res.json() as ScrumData
      setData(d)
      // Pre-fill with existing notes for today if any
      const existing = d.todayNotes[0]
      if (existing) {
        setNotes(existing.notes)
        setActionItems(existing.actionItems)
      }
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

  async function markSkipped(date: string, slotTime: string) {
    await fetch('/api/scrum', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, slotTime, notes: '', actionItems: '', meetingHappened: false }),
    })
    await load()
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

  return (
    <div className="space-y-6">

      {/* Today's Scrum */}
      <div className="space-y-4">
        <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest">Today's Scrum — {data.today}</p>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 max-w-sm">
          <StatPill label="Dialled" value={data.stats.dialled} />
          <StatPill label="Connected" value={data.stats.connected} />
          <StatPill label="Mtgs Booked" value={data.stats.meetingsBooked} />
        </div>

        {/* Suggested discussion items */}
        <div className="card py-3">
          <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest mb-2">Suggested Discussion Items</p>
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
              className="w-full bg-mh-card border border-mh-border rounded-lg px-3 py-2 text-sm text-mh-text placeholder:text-mh-muted resize-none outline-none focus:border-mh-vermillion/50"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest block mb-1">Action Items</label>
            <textarea
              value={actionItems}
              onChange={e => setActionItems(e.target.value)}
              rows={5}
              placeholder="One action per line..."
              className="w-full bg-mh-card border border-mh-border rounded-lg px-3 py-2 text-sm text-mh-text placeholder:text-mh-muted resize-none outline-none focus:border-mh-vermillion/50"
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
            onClick={() => markSkipped(data.today, 'N/A')}
            className="px-4 py-2 rounded-lg text-sm text-mh-muted hover:text-mh-text border border-mh-border"
          >
            Mark as Skipped
          </button>
        </div>
      </div>

      {/* Past Scrums */}
      {data.past.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest mb-3">Past Scrums</p>
          <div className="space-y-2">
            {data.past.map(({ date, slots }) => (
              <div key={date} className="card py-3">
                <button
                  onClick={() => setExpandedDate(expandedDate === date ? null : date)}
                  className="w-full flex items-center justify-between text-left"
                >
                  <span className="text-sm font-semibold text-mh-text">{date}</span>
                  <div className="flex items-center gap-2">
                    {slots.map(s => (
                      <span
                        key={s.rowIndex}
                        className="text-[10px] px-2 py-0.5 rounded-full"
                        style={{
                          background: s.meetingHappened ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)',
                          color: s.meetingHappened ? '#22C55E' : '#888899',
                        }}
                      >
                        {s.slotTime || 'Logged'} {s.meetingHappened ? '' : '· Skipped'}
                      </span>
                    ))}
                    <span className="text-mh-muted">{expandedDate === date ? '▲' : '▼'}</span>
                  </div>
                </button>

                {expandedDate === date && (
                  <div className="mt-3 pt-3 border-t border-mh-border space-y-3">
                    {slots.map(s => (
                      <div key={s.rowIndex}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-mh-muted">{s.slotTime}</span>
                          <button onClick={() => setEditingSlot({ ...s })} className="text-[10px] text-blue-400 hover:text-blue-300">Edit</button>
                        </div>
                        {s.notes && <p className="text-xs text-mh-text mb-1">{s.notes}</p>}
                        {s.actionItems && (
                          <div className="text-xs text-mh-muted space-y-0.5">
                            {s.actionItems.split('\n').filter(Boolean).map((a, i) => (
                              <p key={i}>→ {a}</p>
                            ))}
                          </div>
                        )}
                        {!s.notes && !s.actionItems && (
                          <p className="text-xs text-mh-muted italic">{s.meetingHappened ? 'No notes recorded.' : 'Skipped.'}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit Past Slot Modal */}
      {editingSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="card w-full max-w-md mx-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-mh-text">Edit Scrum — {editingSlot.date}</p>
              <label className="flex items-center gap-2 text-xs text-mh-muted">
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
              className="w-full bg-mh-card border border-mh-border rounded-lg px-3 py-2 text-sm text-mh-text placeholder:text-mh-muted resize-none outline-none"
            />
            <textarea
              value={editingSlot.actionItems}
              onChange={e => setEditingSlot(s => s ? { ...s, actionItems: e.target.value } : s)}
              rows={3}
              placeholder="Action items (one per line)..."
              className="w-full bg-mh-card border border-mh-border rounded-lg px-3 py-2 text-sm text-mh-text placeholder:text-mh-muted resize-none outline-none"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditingSlot(null)} className="px-4 py-1.5 text-sm text-mh-muted">Cancel</button>
              <button onClick={saveEditedSlot} className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white" style={{ background: 'linear-gradient(135deg, #E8341C, #FF5A3A)' }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
