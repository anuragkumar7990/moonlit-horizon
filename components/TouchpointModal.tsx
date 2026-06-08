'use client'
import { useState } from 'react'

type TouchpointType = 'WhatsApp' | 'In-person'

interface Props {
  contactName: string
  email: string
  onClose: () => void
  onSuccess?: () => void
}

const TYPE_COLOR: Record<TouchpointType, string> = {
  WhatsApp:   '#25D366',
  'In-person': '#F59E0B',
}

export default function TouchpointModal({ contactName, email, onClose, onSuccess }: Props) {
  const todayIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const [type, setType]     = useState<TouchpointType>('WhatsApp')
  const [date, setDate]     = useState(todayIST)
  const [notes, setNotes]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')
  const [done, setDone]     = useState(false)

  async function handleSubmit() {
    if (!date) { setError('Date is required'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/manual-touchpoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, type, date, notes, loggedBy: 'Dashboard' }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!data.ok) throw new Error(data.error ?? 'Failed to log touchpoint')
      setDone(true)
      setTimeout(() => { onSuccess?.(); onClose() }, 1200)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-md rounded-xl p-6 shadow-2xl"
        style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[10px] font-semibold text-mh-vermillion uppercase tracking-widest">Log Touchpoint</p>
            <p className="text-sm text-white mt-0.5">{contactName}</p>
            <p className="text-[11px] text-mh-muted">{email}</p>
          </div>
          <button onClick={onClose} className="text-mh-muted hover:text-white text-xl leading-none ml-4">×</button>
        </div>

        {done ? (
          <div className="py-8 text-center">
            <p className="text-green-400 text-sm font-medium">Touchpoint logged</p>
          </div>
        ) : (
          <>
            {/* Type toggle */}
            <label className="block text-xs text-mh-muted mb-2">Channel</label>
            <div className="flex gap-2 mb-4">
              {(['WhatsApp', 'In-person'] as TouchpointType[]).map(t => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`flex-1 text-xs py-2 rounded border transition-all font-medium ${
                    type === t ? 'border-current' : 'border-transparent text-mh-muted hover:text-white'
                  }`}
                  style={type === t ? {
                    color: TYPE_COLOR[t],
                    background: `${TYPE_COLOR[t]}15`,
                    borderColor: `${TYPE_COLOR[t]}50`,
                  } : undefined}
                >
                  {t === 'WhatsApp' ? 'WhatsApp' : 'In-person'}
                </button>
              ))}
            </div>

            {/* Date */}
            <label className="block text-xs text-mh-muted mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full text-sm bg-transparent border border-mh-border rounded px-3 py-2 text-mh-text focus:outline-none focus:border-mh-vermillion/50 mb-4"
            />

            {/* Notes */}
            <label className="block text-xs text-mh-muted mb-1">Notes (optional)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="What was discussed?"
              className="w-full text-sm bg-transparent border border-mh-border rounded px-3 py-2 text-mh-text placeholder:text-mh-muted focus:outline-none focus:border-mh-vermillion/50 resize-none mb-4"
            />

            {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

            <div className="flex gap-2 justify-end">
              <button onClick={onClose} className="text-xs px-4 py-2 text-mh-muted hover:text-white transition-all">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="text-xs px-5 py-2 rounded border transition-all disabled:opacity-50"
                style={{ color: TYPE_COLOR[type], background: `${TYPE_COLOR[type]}15`, borderColor: `${TYPE_COLOR[type]}40` }}
              >
                {loading ? 'Logging…' : 'Log Touchpoint'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
