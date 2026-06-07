'use client'
import { useState, useEffect } from 'react'
import type { AccountIntelligence } from '@/lib/sheets'
import type { DraftEmailRequest, DraftEmailResponse } from '@/app/api/draft-email/route'

interface Props {
  onClose: () => void
  prefillAccount?: string
  prefillContact?: string
}

const INTEL_KEYS: { key: string; label: string; field: keyof AccountIntelligence }[] = [
  { key: 'cumulative',  label: 'Cumulative Summary',         field: 'cumulativeSummary' },
  { key: 'call',        label: 'Call Intelligence',          field: 'callIntelligence' },
  { key: 'circleback',  label: 'Meeting Notes (Circleback)', field: 'circlebakIntelligence' },
  { key: 'email',       label: 'Email Intelligence',         field: 'emailIntelligence' },
  { key: 'manual',      label: 'Manual Notes',               field: 'manualNotes' },
]

const SDR_OPTIONS = ['Anurag Kumar', 'Mahesh', 'Ashutosh', 'Tanishq']

export default function PreMeetingEmailModal({ onClose, prefillAccount = '', prefillContact = '' }: Props) {
  // Step 1 fields
  const [accountName,   setAccountName]   = useState(prefillAccount)
  const [contactName,   setContactName]   = useState(prefillContact)
  const [contactEmail,  setContactEmail]  = useState('')
  const [sdrName,       setSdrName]       = useState(SDR_OPTIONS[0])
  const [meetingDate,   setMeetingDate]   = useState('')
  const [meetingTime,   setMeetingTime]   = useState('')
  const [meetingType,   setMeetingType]   = useState<'L1' | 'L2+'>('L1')
  const [addlContext,   setAddlContext]   = useState('')

  // Account Intelligence
  const [intel,         setIntel]         = useState<AccountIntelligence | null>(null)
  const [intelLoading,  setIntelLoading]  = useState(false)
  const [selectedKeys,  setSelectedKeys]  = useState<Set<string>>(new Set(['cumulative', 'call']))

  // Generation
  const [generating,    setGenerating]    = useState(false)
  const [draft,         setDraft]         = useState<DraftEmailResponse | null>(null)
  const [genError,      setGenError]      = useState<string | null>(null)
  const [copied,        setCopied]        = useState(false)

  const [step, setStep] = useState<1 | 2>(1)

  // Auto-fetch intel when account name changes (debounced)
  useEffect(() => {
    if (!accountName.trim()) { setIntel(null); return }
    const t = setTimeout(async () => {
      setIntelLoading(true)
      try {
        const res = await fetch('/api/account-intel')
        const data = await res.json() as { intel?: AccountIntelligence[] }
        const found = (data.intel ?? []).find(
          i => i.account.toLowerCase() === accountName.trim().toLowerCase()
        )
        setIntel(found ?? null)
        // Auto-select keys that have content
        if (found) {
          const auto = new Set<string>()
          for (const { key, field } of INTEL_KEYS) {
            if (found[field]) auto.add(key)
          }
          setSelectedKeys(auto)
        }
      } catch { /* ignore */ }
      setIntelLoading(false)
    }, 600)
    return () => clearTimeout(t)
  }, [accountName])

  function toggleKey(key: string) {
    setSelectedKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function generate() {
    setGenerating(true)
    setGenError(null)
    setDraft(null)
    try {
      const payload: DraftEmailRequest = {
        accountName: accountName.trim(),
        contactName: contactName.trim(),
        contactEmail: contactEmail.trim() || undefined,
        sdrName,
        meetingDate: meetingDate || undefined,
        meetingTime: meetingTime || undefined,
        meetingType,
        selectedIntelKeys: Array.from(selectedKeys),
        additionalContext: addlContext.trim() || undefined,
      }
      const res = await fetch('/api/draft-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json() as DraftEmailResponse & { error?: string }
      if (data.error) { setGenError(data.error); return }
      setDraft(data)
      setStep(2)
    } catch (err) {
      setGenError(String(err))
    } finally {
      setGenerating(false)
    }
  }

  async function copyAll() {
    if (!draft) return
    const text = `Subject: ${draft.subject}\n\n${draft.body}`
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const hasRequiredFields = accountName.trim() && contactName.trim() && sdrName

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-mh-surface border border-mh-border rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-mh-border shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-mh-text">Draft Pre-Meeting Email</h2>
            <p className="text-[11px] text-mh-muted mt-0.5">Uses account intelligence to personalise the outreach</p>
          </div>
          <button onClick={onClose} className="text-mh-muted hover:text-mh-text transition-colors text-lg leading-none">✕</button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* ── Step 1: Inputs ── */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="field-label">Account Name *</label>
              <input
                value={accountName}
                onChange={e => setAccountName(e.target.value)}
                placeholder="e.g. Stryker"
                className="mh-input w-full"
              />
              {intelLoading && (
                <p className="text-[10px] text-mh-muted mt-1">Loading intelligence…</p>
              )}
              {!intelLoading && accountName && !intel && (
                <p className="text-[10px] text-yellow-400 mt-1">No Account Intelligence found for this account</p>
              )}
              {intel && (
                <p className="text-[10px] text-green-400 mt-1">✓ Intelligence loaded · Status: {intel.status}</p>
              )}
            </div>

            <div>
              <label className="field-label">Contact Name *</label>
              <input
                value={contactName}
                onChange={e => setContactName(e.target.value)}
                placeholder="e.g. Gurdeep Singh"
                className="mh-input w-full"
              />
            </div>

            <div>
              <label className="field-label">Contact Email</label>
              <input
                type="email"
                value={contactEmail}
                onChange={e => setContactEmail(e.target.value)}
                placeholder="gurdeep@company.com"
                className="mh-input w-full"
              />
            </div>

            <div>
              <label className="field-label">From (SDR) *</label>
              <select
                value={sdrName}
                onChange={e => setSdrName(e.target.value)}
                className="mh-input w-full"
              >
                {SDR_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label className="field-label">Meeting Date</label>
              <input
                type="date"
                value={meetingDate}
                onChange={e => setMeetingDate(e.target.value)}
                className="mh-input w-full"
              />
            </div>

            <div>
              <label className="field-label">Meeting Time &amp; Type</label>
              <div className="flex gap-2">
                <input
                  type="time"
                  value={meetingTime}
                  onChange={e => setMeetingTime(e.target.value)}
                  className="mh-input flex-1"
                />
                <select
                  value={meetingType}
                  onChange={e => setMeetingType(e.target.value as 'L1' | 'L2+')}
                  className="mh-input w-20"
                >
                  <option value="L1">L1</option>
                  <option value="L2+">L2+</option>
                </select>
              </div>
            </div>
          </div>

          {/* ── Intel checklist ── */}
          <div>
            <label className="field-label mb-2 block">Include in email (select intel layers)</label>
            <div className="grid grid-cols-2 gap-2">
              {INTEL_KEYS.map(({ key, label, field }) => {
                const hasContent = intel ? !!intel[field] : false
                const checked = selectedKeys.has(key)
                return (
                  <label
                    key={key}
                    className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors
                      ${checked
                        ? 'border-mh-vermillion bg-mh-vermillion/5'
                        : 'border-mh-border hover:border-mh-border/80'
                      }
                      ${!hasContent ? 'opacity-50' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleKey(key)}
                      disabled={!hasContent}
                      className="mt-0.5 shrink-0 accent-[#E8341C]"
                    />
                    <div className="min-w-0">
                      <p className={`text-xs font-medium ${checked ? 'text-mh-text' : 'text-mh-muted'}`}>{label}</p>
                      {intel && intel[field] ? (
                        <p className="text-[10px] text-mh-muted mt-0.5 line-clamp-2 leading-relaxed">
                          {String(intel[field]).slice(0, 80)}…
                        </p>
                      ) : (
                        <p className="text-[10px] text-mh-muted mt-0.5">No data</p>
                      )}
                    </div>
                  </label>
                )
              })}
            </div>
          </div>

          {/* ── Additional context ── */}
          <div>
            <label className="field-label">Additional Context</label>
            <textarea
              value={addlContext}
              onChange={e => setAddlContext(e.target.value)}
              rows={2}
              placeholder="e.g. They mentioned budget approval in Dec, focus on ROI angle"
              className="mh-input w-full resize-none"
            />
          </div>

          {/* ── Generated email ── */}
          {step === 2 && draft && (
            <div className="border border-mh-border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-mh-bg border-b border-mh-border">
                <p className="text-xs font-semibold text-mh-text">Generated Email</p>
                <button
                  onClick={copyAll}
                  className="text-[11px] px-3 py-1 border border-mh-border rounded-lg text-mh-muted
                    hover:text-mh-text transition-colors"
                >
                  {copied ? '✓ Copied!' : 'Copy All'}
                </button>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <p className="text-[10px] font-semibold text-mh-vermillion uppercase tracking-widest mb-1">Subject</p>
                  <p className="text-sm text-mh-text font-medium">{draft.subject}</p>
                </div>
                <div className="border-t border-mh-border pt-3">
                  <p className="text-[10px] font-semibold text-mh-vermillion uppercase tracking-widest mb-1">Body</p>
                  <p className="text-sm text-mh-muted leading-relaxed whitespace-pre-wrap">{draft.body}</p>
                </div>
              </div>
            </div>
          )}

          {genError && (
            <p className="text-red-400 text-xs">{genError}</p>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-mh-border px-6 py-4 flex items-center gap-3 justify-end shrink-0">
          {step === 2 && (
            <button
              onClick={() => { setStep(1); setDraft(null) }}
              className="px-4 py-2 text-sm text-mh-muted border border-mh-border rounded-lg hover:text-mh-text transition-colors"
            >
              ← Edit
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-mh-muted border border-mh-border rounded-lg hover:text-mh-text transition-colors"
          >
            Close
          </button>
          <button
            onClick={generate}
            disabled={!hasRequiredFields || generating}
            className="px-5 py-2 text-sm font-medium bg-mh-vermillion text-white rounded-lg
              hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-2"
          >
            {generating && (
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {generating ? 'Generating…' : step === 2 ? 'Regenerate' : 'Generate Email'}
          </button>
        </div>
      </div>

      <style jsx>{`
        .field-label { display: block; font-size: 10px; font-weight: 600; color: #E8341C; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px; }
        .mh-input { background: #0A0A0A; border: 1px solid #2A2A2A; border-radius: 8px; padding: 8px 12px; font-size: 13px; color: #E5E7EB; outline: none; transition: border-color 0.15s; }
        .mh-input:focus { border-color: #E8341C; }
        .mh-input option { background: #1A1A1A; }
      `}</style>
    </div>
  )
}
