'use client'
import { useState } from 'react'

interface Props {
  accountName:  string
  contactName:  string
  contactEmail: string
  leadId?:      string
  contactId?:   string
  onClose:      () => void
  onSuccess?:   (gMeetLink: string, dealId: string) => void
}

type MtgType = 'L1' | 'L2+'

export default function BookMeetingModal({
  accountName, contactName, contactEmail, leadId, contactId, onClose, onSuccess,
}: Props) {
  const today = new Date().toISOString().split('T')[0]
  const [date,     setDate]    = useState(today)
  const [time,     setTime]    = useState('10:00')
  const [mtgType,  setMtgType] = useState<MtgType>('L1')
  const [loading,  setLoading] = useState(false)
  const [error,    setError]   = useState<string | null>(null)
  const [success,  setSuccess] = useState<{ gMeetLink: string; dealId: string } | null>(null)

  async function handleBook() {
    if (!date || !time) { setError('Please set both date and time.'); return }
    setLoading(true)
    setError(null)
    try {
      const meetingTime = `${date}T${time}:00`
      let res: Response
      if (leadId) {
        res = await fetch('/api/book-prospect', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ leadId, meetingTime, meetingType: mtgType }),
        })
      } else {
        res = await fetch('/api/book', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            accountId:    '',
            accountName,
            contactId:    contactId ?? '',
            contactName,
            contactEmail,
            meetingTime,
            meetingType:  mtgType,
          }),
        })
      }
      const data = await res.json() as { ok?: boolean; gMeetLink?: string; dealId?: string; error?: string }
      if (!res.ok || data.error) { setError(data.error ?? 'Booking failed'); return }
      setSuccess({ gMeetLink: data.gMeetLink ?? '', dealId: data.dealId ?? '' })
      onSuccess?.(data.gMeetLink ?? '', data.dealId ?? '')
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  const INPUT_CLS = 'bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2 text-[13px] text-[#E5E7EB] outline-none focus:border-[#E8341C] transition-colors'
  const LABEL_CLS = 'block text-[10px] font-semibold text-[#E8341C] uppercase tracking-[0.1em] mb-1'

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="rounded-2xl w-full max-w-md flex flex-col overflow-hidden"
        style={{
          background:       'rgba(8,8,16,0.94)',
          backdropFilter:   'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border:           '1px solid rgba(255,255,255,0.1)',
          boxShadow:        '0 24px 80px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div>
            <h2 className="text-sm font-semibold text-white">Book Meeting</h2>
            <p className="text-[11px] text-[#999] mt-0.5">
              {contactName} · {accountName}
            </p>
          </div>
          <button onClick={onClose} className="text-[#999] hover:text-white transition-colors text-lg leading-none">✕</button>
        </div>

        {/* Body */}
        {success ? (
          <div className="p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center"
              style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)' }}
            >
              <span className="text-2xl">✓</span>
            </div>
            <p className="text-white font-semibold">Meeting booked!</p>
            {success.gMeetLink && (
              <a
                href={success.gMeetLink}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-xs px-4 py-2.5 rounded-lg text-center font-medium transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg,#E8341C,#FF5A3A)', color: '#fff' }}
              >
                Open Google Meet →
              </a>
            )}
            <p className="text-[11px] text-[#666]">Invites sent to all attendees.</p>
            <button
              onClick={onClose}
              className="text-xs text-[#888] hover:text-white transition-colors underline underline-offset-2"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <div className="p-6 space-y-4">
              {/* Meeting type toggle */}
              <div>
                <label className={LABEL_CLS}>Meeting Type</label>
                <div className="flex gap-2">
                  {(['L1', 'L2+'] as MtgType[]).map(t => (
                    <button
                      key={t}
                      onClick={() => setMtgType(t)}
                      className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
                      style={mtgType === t
                        ? { background: 'linear-gradient(135deg,#E8341C,#FF5A3A)', color: '#fff', boxShadow: '0 0 10px rgba(232,52,28,0.35)' }
                        : { background: 'rgba(255,255,255,0.05)', color: '#888', border: '1px solid rgba(255,255,255,0.08)' }
                      }
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date */}
              <div>
                <label className={LABEL_CLS}>Date</label>
                <input
                  type="date"
                  value={date}
                  min={today}
                  onChange={e => setDate(e.target.value)}
                  className={INPUT_CLS + ' w-full'}
                />
              </div>

              {/* Time */}
              <div>
                <label className={LABEL_CLS}>Time (IST)</label>
                <input
                  type="time"
                  value={time}
                  onChange={e => setTime(e.target.value)}
                  className={INPUT_CLS + ' w-full'}
                />
              </div>

              {/* Contact info (read-only) */}
              <div className="rounded-lg px-3 py-2.5 text-[12px] space-y-0.5"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <p className="text-[#999]">Contact: <span className="text-white">{contactName}</span></p>
                <p className="text-[#999]">Email: <span className="text-[#aaa]">{contactEmail}</span></p>
                <p className="text-[#999]">Account: <span className="text-[#aaa]">{accountName}</span></p>
              </div>

              {error && <p className="text-red-400 text-xs">{error}</p>}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 flex gap-3 justify-end shrink-0"
              style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
            >
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-[#999] rounded-lg hover:text-white transition-colors"
                style={{ border: '1px solid rgba(255,255,255,0.1)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleBook}
                disabled={loading || !date || !time}
                className="btn-shimmer px-5 py-2 text-sm font-medium text-white rounded-lg
                  disabled:opacity-50 transition-all flex items-center gap-2"
                style={{
                  background:  'linear-gradient(135deg,#E8341C,#FF5A3A)',
                  boxShadow:   !loading ? '0 2px 14px rgba(232,52,28,0.4)' : undefined,
                }}
              >
                {loading && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {loading ? 'Booking…' : 'Book Meeting'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
