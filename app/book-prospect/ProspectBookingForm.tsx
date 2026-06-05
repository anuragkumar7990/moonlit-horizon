'use client'

import { useState } from 'react'

interface Lead {
  id: string
  firstName: string
  lastName: string
  email: string
  company: string
}

interface Props {
  leads: Lead[]
}

export default function ProspectBookingForm({ leads }: Props) {
  const [leadId, setLeadId] = useState('')
  const [meetingTime, setMeetingTime] = useState('')
  const [meetingType, setMeetingType] = useState<'L1' | 'L2+'>('L1')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [result, setResult] = useState<{ meetingId?: string; gMeetLink?: string; dealId?: string } | null>(null)

  const selectedLead = leads.find(l => l.id === leadId)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!leadId || !meetingTime) return
    setStatus('loading')
    setErrorMsg('')

    try {
      const res = await fetch('/api/book-prospect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, meetingTime, meetingType }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error ?? 'Unknown error')
      setResult(data)
      setStatus('success')
    } catch (err) {
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  if (status === 'success') {
    return (
      <div className="text-center py-12">
        <div className="text-5xl mb-4">🎉</div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Meeting Booked!</h2>
        <p className="text-slate-500 mb-1">Prospect converted to Contact. Calendar invites sent.</p>
        {result?.gMeetLink && (
          <a href={result.gMeetLink} target="_blank" rel="noreferrer"
            className="inline-block mt-3 text-sm text-blue-600 hover:underline">
            Open Google Meet link
          </a>
        )}
        <div className="mt-6">
          <button
            onClick={() => { setStatus('idle'); setLeadId(''); setMeetingTime(''); setResult(null) }}
            className="text-sm text-blue-600 hover:underline"
          >
            Book another meeting
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Prospect selector */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Prospect (Lead) *</label>
        <select
          value={leadId}
          onChange={e => setLeadId(e.target.value)}
          required
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        >
          <option value="">Select prospect…</option>
          {leads.map(l => (
            <option key={l.id} value={l.id}>
              {l.firstName} {l.lastName}{l.company ? ` — ${l.company}` : ''}
            </option>
          ))}
        </select>
        {selectedLead && (
          <p className="text-xs text-slate-400 mt-1">{selectedLead.email}</p>
        )}
      </div>

      {/* Meeting time */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Meeting Time *</label>
        <input
          type="datetime-local"
          value={meetingTime}
          onChange={e => setMeetingTime(e.target.value)}
          required
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
      </div>

      {/* Meeting type */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Meeting Type *</label>
        <div className="flex gap-4">
          {(['L1', 'L2+'] as const).map(t => (
            <label key={t} className={`flex items-center gap-2 cursor-pointer px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${meetingType === t ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
              <input type="radio" name="meetingType" value={t} checked={meetingType === t} onChange={() => setMeetingType(t)} className="sr-only" />
              {t === 'L1' ? '🔵 L1 — Discovery' : '🟣 L2+ — Next Steps'}
            </label>
          ))}
        </div>
      </div>

      {status === 'error' && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{errorMsg}</p>
      )}

      <button
        type="submit"
        disabled={status === 'loading' || !leadId || !meetingTime}
        className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {status === 'loading' ? 'Converting & booking…' : 'Convert Prospect & Book Meeting'}
      </button>
    </form>
  )
}
