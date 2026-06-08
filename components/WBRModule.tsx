'use client'
import { useState, useEffect, useRef } from 'react'

interface WBRSession {
  rowIndex: number
  sessionNumber: number
  date: string
  notes: string
  actionItems: string
  meetingHappened: boolean
}

interface WBRData {
  today: string
  sessions: WBRSession[]
  suggestedItems: string[]
}

function DateEditor({ session, onSave }: {
  session: WBRSession
  onSave: (sessionNumber: number, date: string, rowIndex: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(session.date)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing && ref.current) ref.current.focus()
  }, [editing])

  return (
    <div className="flex items-center gap-1">
      {editing ? (
        <input
          ref={ref}
          type="date"
          value={val}
          onChange={e => setVal(e.target.value)}
          onBlur={() => { setEditing(false); if (val !== session.date) onSave(session.sessionNumber, val, session.rowIndex) }}
          onKeyDown={e => { if (e.key === 'Enter') { setEditing(false); onSave(session.sessionNumber, val, session.rowIndex) } if (e.key === 'Escape') { setEditing(false); setVal(session.date) } }}
          className="bg-mh-card border border-mh-border rounded px-2 py-0.5 text-xs text-mh-text outline-none"
        />
      ) : (
        <>
          <span className="text-sm font-semibold text-mh-text">{session.date || '(no date)'}</span>
          <button onClick={() => setEditing(true)} className="text-mh-muted/50 hover:text-mh-muted text-xs ml-1" title="Edit date">✏️</button>
        </>
      )}
    </div>
  )
}

export default function WBRModule() {
  const [data, setData] = useState<WBRData | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedSession, setExpandedSession] = useState<number | null>(null)
  const [editingSession, setEditingSession] = useState<WBRSession | null>(null)
  const [notes, setNotes] = useState('')
  const [actionItems, setActionItems] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/wbr')
      setData(await res.json() as WBRData)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function saveSession(session: WBRSession, sessionNotes: string, sessionActionItems: string) {
    setSaving(true)
    await fetch('/api/wbr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionNumber: session.sessionNumber,
        date: session.date,
        notes: sessionNotes,
        actionItems: sessionActionItems,
        meetingHappened: true,
        rowIndex: session.rowIndex > 0 ? session.rowIndex : undefined,
      }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setEditingSession(null)
    await load()
  }

  async function markSkipped(session: WBRSession) {
    await fetch('/api/wbr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionNumber: session.sessionNumber,
        date: session.date,
        notes: '',
        actionItems: '',
        meetingHappened: false,
        rowIndex: session.rowIndex > 0 ? session.rowIndex : undefined,
      }),
    })
    await load()
  }

  async function updateDate(sessionNumber: number, date: string, rowIndex: number) {
    if (rowIndex > 0) {
      await fetch('/api/wbr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionNumber, date, rowIndex, updateDateOnly: true }),
      })
    }
    await load()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-mh-vermillion border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!data) return <p className="text-mh-muted text-sm italic">Failed to load WBR data.</p>

  const today = data.today
  const currentOrNext = data.sessions.find(s => s.date >= today && !s.notes) ?? data.sessions[0]
  const past = data.sessions.filter(s => s.rowIndex > 0 && (s.notes || !s.meetingHappened))

  return (
    <div className="space-y-6">

      {/* Upcoming / Current WBR */}
      {currentOrNext && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest">
              WBR #{currentOrNext.sessionNumber}
            </p>
            <DateEditor session={currentOrNext} onSave={updateDate} />
          </div>

          {/* Suggested Discussion Items */}
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
                placeholder="What was reviewed? Key decisions?"
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
              onClick={() => saveSession(currentOrNext, notes, actionItems)}
              disabled={saving}
              className="px-5 py-2 rounded-lg text-sm font-semibold text-white transition-all"
              style={{ background: 'linear-gradient(135deg, #E8341C, #FF5A3A)', opacity: saving ? 0.6 : 1 }}
            >
              {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save WBR Notes'}
            </button>
            <button
              onClick={() => markSkipped(currentOrNext)}
              className="px-4 py-2 rounded-lg text-sm text-mh-muted hover:text-mh-text border border-mh-border"
            >
              Mark as Skipped
            </button>
          </div>
        </div>
      )}

      {/* Upcoming Sessions (future, unrecorded) */}
      <div>
        <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest mb-3">Upcoming Sessions</p>
        <div className="space-y-1">
          {data.sessions.filter(s => s.rowIndex < 0 || (s.date > today && !s.notes)).map(s => (
            <div key={s.sessionNumber} className="flex items-center gap-3 py-1.5 px-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <span className="text-xs font-semibold text-mh-muted w-12">#{s.sessionNumber}</span>
              <DateEditor session={s} onSave={updateDate} />
              <span className="text-[10px] text-mh-muted/50 ml-auto">Not yet recorded</span>
            </div>
          ))}
        </div>
      </div>

      {/* Past WBRs */}
      {past.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest mb-3">Past WBRs</p>
          <div className="space-y-2">
            {past.map(s => (
              <div key={s.rowIndex} className="card py-3">
                <button
                  onClick={() => setExpandedSession(expandedSession === s.sessionNumber ? null : s.sessionNumber)}
                  className="w-full flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-mh-muted">#{s.sessionNumber}</span>
                    <span className="text-sm font-semibold text-mh-text">{s.date}</span>
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full"
                      style={{
                        background: s.meetingHappened ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)',
                        color: s.meetingHappened ? '#22C55E' : '#888899',
                      }}
                    >
                      {s.meetingHappened ? 'Conducted' : 'Skipped'}
                    </span>
                  </div>
                  <span className="text-mh-muted">{expandedSession === s.sessionNumber ? '▲' : '▼'}</span>
                </button>

                {expandedSession === s.sessionNumber && (
                  <div className="mt-3 pt-3 border-t border-mh-border space-y-3">
                    {s.notes && (
                      <div>
                        <p className="text-[10px] text-mh-muted uppercase tracking-widest mb-1">Notes</p>
                        <p className="text-sm text-mh-text">{s.notes}</p>
                      </div>
                    )}
                    {s.actionItems && (
                      <div>
                        <p className="text-[10px] text-mh-muted uppercase tracking-widest mb-1">Action Items</p>
                        <div className="space-y-0.5">
                          {s.actionItems.split('\n').filter(Boolean).map((a, i) => (
                            <p key={i} className="text-sm text-mh-muted">→ {a}</p>
                          ))}
                        </div>
                      </div>
                    )}
                    {!s.notes && !s.actionItems && (
                      <p className="text-xs text-mh-muted italic">{s.meetingHappened ? 'No notes recorded.' : 'Skipped.'}</p>
                    )}
                    <button
                      onClick={() => { setEditingSession(s); setNotes(s.notes); setActionItems(s.actionItems) }}
                      className="text-xs text-blue-400 hover:text-blue-300"
                    >
                      Edit
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit Past WBR Modal */}
      {editingSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="card w-full max-w-md mx-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-mh-text">WBR #{editingSession.sessionNumber} — {editingSession.date}</p>
              <label className="flex items-center gap-2 text-xs text-mh-muted">
                <input
                  type="checkbox"
                  checked={editingSession.meetingHappened}
                  onChange={e => setEditingSession(s => s ? { ...s, meetingHappened: e.target.checked } : s)}
                  className="accent-mh-vermillion"
                />
                Meeting happened
              </label>
            </div>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={4}
              placeholder="Notes..."
              className="w-full bg-mh-card border border-mh-border rounded-lg px-3 py-2 text-sm text-mh-text placeholder:text-mh-muted resize-none outline-none"
            />
            <textarea
              value={actionItems}
              onChange={e => setActionItems(e.target.value)}
              rows={3}
              placeholder="Action items (one per line)..."
              className="w-full bg-mh-card border border-mh-border rounded-lg px-3 py-2 text-sm text-mh-text placeholder:text-mh-muted resize-none outline-none"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditingSession(null)} className="px-4 py-1.5 text-sm text-mh-muted">Cancel</button>
              <button
                onClick={() => saveSession(editingSession, notes, actionItems)}
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
