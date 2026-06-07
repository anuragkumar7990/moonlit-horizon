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
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-[#111111] border border-[#2A2A2A] rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
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
              <label className="block text-[10px] font-semibold text-[#E8341C] uppercase tracking-[0.1em] mb-1">Account Name *</label>
              <input
                value={accountName}
                onChange={e => setAccountName(e.target.value)}
                placeholder="e.g. Stryker"
                className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-[13px] text-[#E5E7EB] outline-none focus:border-[#E8341C] transition-colors"
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
              <label className="block text-[10px] font-semibold text-[#E8341C] uppercase tracking-[0.1em] mb-1">Contact Name *</label>
              <input
                value={contactName}
                onChange={e => setContactName(e.target.value)}
                placeholder="e.g. Gurdeep Singh"
                className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-[13px] text-[#E5E7EB] outline-none focus:border-[#E8341C] transition-colors"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-[#E8341C] uppercase tracking-[0.1em] mb-1">Contact Email</label>
              <input
                type="email"
                value={contactEmail}
                onChange={e => setContactEmail(e.target.value)}
                placeholder="gurdeep@company.com"
                className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-[13px] text-[#E5E7EB] outline-none focus:border-[#E8341C] transition-colors"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-[#E8341C] uppercase tracking-[0.1em] mb-1">From (SDR) *</label>
              <select
                value={sdrName}
                onChange={e => setSdrName(e.target.value)}
                className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-[13px] text-[#E5E7EB] outline-none focus:border-[#E8341C] transition-colors"
              >
                {SDR_OPTIONS.map(s => <option key={s} value={s} style={{ background: '#1A1A1A' }}>{s}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-[#E8341C] uppercase tracking-[0.1em] mb-1">Meeting Date</label>
              <input
                type="date"
                value={meetingDate}
                onChange={e => setMeetingDate(e.target.value)}
                className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-[13px] text-[#E5E7EB] outline-none focus:border-[#E8341C] transition-colors"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-[#E8341C] uppercase tracking-[0.1em] mb-1">Meeting Time &amp; Type</label>
              <div className="flex gap-2">
                <input
                  type="time"
                  value={meetingTime}
                  onChange={e => setMeetingTime(e.target.value)}
                  className="flex-1 bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-[13px] text-[#E5E7EB] outline-none focus:border-[#E8341C] transition-colors"
                />
                <select
                  value={meetingType}
                  onChange={e => setMeetingType(e.target.value as 'L1' | 'L2+')}
                  className="w-20 bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-[13px] text-[#E5E7EB] outline-none focus:border-[#E8341C] transition-colors"
                >
                  <option value="L1" style={{ background: '#1A1A1A' }}>L1</option>
                  <option value="L2+" style={{ background: '#1A1A1A' }}>L2+</option>
                </select>
              </div>
            </div>
          </div>

          {/* ── Intel checklist ── */}
          <div>
            <p className="text-[10px] font-semibold text-[#E8341C] uppercase tracking-[0.1em] mb-2">Include in email (select intel layers)</p>
            <div className="grid grid-cols-2 gap-2">
              {INTEL_KEYS.map(({ key, label, field }) => {
                const hasContent = intel ? !!intel[field] : false
                const checked = selectedKeys.has(key)
                return (
                  <label
                    key={key}
                    className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors
                      ${checked
                        ? 'border-[#E8341C] bg-[#E8341C]/5'
                        : 'border-[#2A2A2A] hover:border-[#3A3A3A]'
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
                      <p className={`text-xs font-medium ${checked ? 'text-white' : 'text-[#999]'}`}>{label}</p>
                      {intel && intel[field] ? (
                        <p className="text-[10px] text-[#999] mt-0.5 line-clamp-2 leading-relaxed">
                          {String(intel[field]).slice(0, 80)}…
                        </p>
                      ) : (
                        <p className="text-[10px] text-[#999] mt-0.5">No data</p>
                      )}
                    </div>
                  </label>
                )
              })}
            </div>
          </div>

          {/* ── Additional context ── */}
          <div>
            <label className="block text-[10px] font-semibold text-[#E8341C] uppercase tracking-[0.1em] mb-1">Additional Context</label>
            <textarea
              value={addlContext}
              onChange={e => setAddlContext(e.target.value)}
              rows={2}
              placeholder="e.g. They mentioned budget approval in Dec, focus on ROI angle"
              className="w-full resize-none bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-[13px] text-[#E5E7EB] outline-none focus:border-[#E8341C] transition-colors"
            />
          </div>

          {/* ── Generated email ── */}
          {step === 2 && draft && (
            <div className="border border-[#2A2A2A] rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-[#0A0A0A] border-b border-[#2A2A2A]">
                <p className="text-xs font-semibold text-white">Generated Email</p>
                <button
                  onClick={copyAll}
                  className="text-[11px] px-3 py-1 border border-[#2A2A2A] rounded-lg text-[#999]
                    hover:text-white transition-colors"
                >
                  {copied ? '✓ Copied!' : 'Copy All'}
                </button>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <p className="text-[10px] font-semibold text-[#E8341C] uppercase tracking-widest mb-1">Subject</p>
                  <p className="text-sm text-white font-medium">{draft.subject}</p>
                </div>
                <div className="border-t border-[#2A2A2A] pt-3">
                  <p className="text-[10px] font-semibold text-[#E8341C] uppercase tracking-widest mb-1">Body</p>
                  <p className="text-sm text-[#999] leading-relaxed whitespace-pre-wrap">{draft.body}</p>
                </div>
              </div>
            </div>
          )}

          {genError && (
            <p className="text-red-400 text-xs">{genError}</p>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[#2A2A2A] px-6 py-4 flex items-center gap-3 justify-end shrink-0">
          {step === 2 && (
            <button
              onClick={() => { setStep(1); setDraft(null) }}
              className="px-4 py-2 text-sm text-[#999] border border-[#2A2A2A] rounded-lg hover:text-white transition-colors"
            >
              ← Edit
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-[#999] border border-[#2A2A2A] rounded-lg hover:text-white transition-colors"
          >
            Close
          </button>
          <button
            onClick={generate}
            disabled={!hasRequiredFields || generating}
            className="px-5 py-2 text-sm font-medium bg-[#E8341C] text-white rounded-lg
              hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-2"
          >
            {generating && (
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {generating ? 'Generating…' : step === 2 ? 'Regenerate' : 'Generate Email'}
          </button>
        </div>
      </div>
    </div>
  )
}
