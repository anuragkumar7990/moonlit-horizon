'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import type { DraftEmailRequest, DraftEmailResponse } from '@/app/api/draft-email/route'
import type { MeetingPrepResponse } from '@/app/api/meeting-prep/route'
import type { ContactOption } from '@/app/api/contacts-list/route'

interface Props {
  onClose: () => void
  prefillAccount?: string
  prefillContact?: string
}

const SDR_OPTIONS = ['Anurag Kumar', 'Mahesh', 'Ashutosh', 'Tanishq']

const INPUT_CLS = 'w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2 text-[13px] text-[#E5E7EB] outline-none focus:border-[#E8341C] transition-colors placeholder:text-[#555]'
const LABEL_CLS = 'block text-[10px] font-semibold text-[#E8341C] uppercase tracking-[0.1em] mb-1'

// ── Searchable dropdown (portal-based — escapes overflow:hidden parents) ─────

function SearchableSelect({
  options, value, onChange, placeholder, disabled,
}: {
  options: string[]
  value: string
  onChange: (v: string) => void
  placeholder: string
  disabled?: boolean
}) {
  const [query,  setQuery]  = useState(value)
  const [open,   setOpen]   = useState(false)
  const [rect,   setRect]   = useState<DOMRect | null>(null)
  const inputRef            = useRef<HTMLInputElement>(null)
  const listRef             = useRef<HTMLDivElement>(null)

  useEffect(() => { setQuery(value) }, [value])

  const filtered = query
    ? options.filter(o => o.toLowerCase().includes(query.toLowerCase())).slice(0, 25)
    : options.slice(0, 25)

  function openDropdown() {
    if (inputRef.current) setRect(inputRef.current.getBoundingClientRect())
    setOpen(true)
  }

  function pick(option: string) {
    onChange(option)
    setQuery(option)
    setOpen(false)
  }

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      const t = e.target as Node
      if (inputRef.current?.contains(t) || listRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  // Reposition on scroll / resize while open
  useEffect(() => {
    if (!open) return
    function reposition() {
      if (inputRef.current) setRect(inputRef.current.getBoundingClientRect())
    }
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
    }
  }, [open])

  const dropdown = open && filtered.length > 0 && rect ? createPortal(
    <div
      ref={listRef}
      className="rounded-lg max-h-52 overflow-y-auto"
      style={{
        position: 'fixed',
        top:   rect.bottom + 4,
        left:  rect.left,
        width: rect.width,
        zIndex: 99999,
        background: 'rgba(8,8,18,0.97)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.12)',
        boxShadow: '0 16px 48px rgba(0,0,0,0.7)',
      }}
    >
      {filtered.map(o => (
        <button
          key={o}
          type="button"
          onMouseDown={() => pick(o)}
          className="w-full text-left px-3 py-2 text-[13px] text-[#E5E7EB] hover:bg-[#E8341C]/10 hover:text-white transition-colors"
        >
          {o}
        </button>
      ))}
    </div>,
    document.body
  ) : null

  return (
    <div className="relative">
      <input
        ref={inputRef}
        value={query}
        onChange={e => { setQuery(e.target.value); onChange(e.target.value); openDropdown() }}
        onFocus={openDropdown}
        placeholder={placeholder}
        disabled={disabled}
        className={INPUT_CLS + (disabled ? ' opacity-50 cursor-not-allowed' : '')}
      />
      {dropdown}
    </div>
  )
}

// ── Main modal ───────────────────────────────────────────────────────────────

export default function PreMeetingEmailModal({ onClose, prefillAccount = '', prefillContact = '' }: Props) {
  // Form fields
  const [accountName,  setAccountName]  = useState(prefillAccount)
  const [contactName,  setContactName]  = useState(prefillContact)
  const [contactEmail, setContactEmail] = useState('')
  const [sdrName,      setSdrName]      = useState(SDR_OPTIONS[0])
  const [meetingDate,  setMeetingDate]  = useState('')
  const [meetingTime,  setMeetingTime]  = useState('')
  const [meetingType,  setMeetingType]  = useState<'L1' | 'L2+'>('L1')
  const [addlContext,  setAddlContext]  = useState('')

  // Dropdowns
  const [accountsList,  setAccountsList]  = useState<string[]>([])
  const [contactsList,  setContactsList]  = useState<ContactOption[]>([])
  const [loadingAccts,  setLoadingAccts]  = useState(true)
  const [loadingConts,  setLoadingConts]  = useState(false)

  // Analysis
  const [analyzing,       setAnalyzing]       = useState(false)
  const [insights,        setInsights]        = useState<MeetingPrepResponse['insights']>([])
  const [checkedInsights, setCheckedInsights] = useState<Set<string>>(new Set())
  const [accountFound,    setAccountFound]    = useState<boolean | null>(null)
  const [contactFound,    setContactFound]    = useState<boolean | null>(null)
  const [analyzeError,    setAnalyzeError]    = useState<string | null>(null)

  // Email generation
  const [generating, setGenerating] = useState(false)
  const [draft,      setDraft]      = useState<DraftEmailResponse | null>(null)
  const [genError,   setGenError]   = useState<string | null>(null)
  const [copied,     setCopied]     = useState(false)

  // Load accounts on mount
  useEffect(() => {
    fetch('/api/accounts-list')
      .then(r => r.json())
      .then((d: { accounts?: string[] }) => setAccountsList(d.accounts ?? []))
      .catch(() => {})
      .finally(() => setLoadingAccts(false))
  }, [])

  // Load contacts when account changes
  useEffect(() => {
    if (!accountName.trim()) { setContactsList([]); return }
    setLoadingConts(true)
    fetch(`/api/contacts-list?account=${encodeURIComponent(accountName.trim())}`)
      .then(r => r.json())
      .then((d: { contacts?: ContactOption[] }) => setContactsList(d.contacts ?? []))
      .catch(() => setContactsList([]))
      .finally(() => setLoadingConts(false))
  }, [accountName])

  // Auto-populate contact email when contact is selected
  useEffect(() => {
    const match = contactsList.find(c => c.name.toLowerCase() === contactName.toLowerCase())
    if (match?.email) setContactEmail(match.email)
  }, [contactName, contactsList])

  // Run analysis when both account + contact are filled
  const runAnalysis = useCallback(async () => {
    if (!accountName.trim() || !contactName.trim()) return
    setAnalyzing(true)
    setAnalyzeError(null)
    setInsights([])
    setCheckedInsights(new Set())
    setDraft(null)
    try {
      const res = await fetch('/api/meeting-prep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountName: accountName.trim(), contactName: contactName.trim(), additionalContext: addlContext.trim() || undefined }),
      })
      const data = await res.json() as MeetingPrepResponse & { error?: string }
      if (data.error) { setAnalyzeError(data.error); return }
      setInsights(data.insights ?? [])
      setAccountFound(data.accountFound)
      setContactFound(data.contactFound)
      // Pre-check all returned insight points
      const allPoints = new Set<string>()
      for (const cat of (data.insights ?? [])) {
        for (const p of cat.points) allPoints.add(p)
      }
      setCheckedInsights(allPoints)
    } catch (err) {
      setAnalyzeError(String(err))
    } finally {
      setAnalyzing(false)
    }
  }, [accountName, contactName, addlContext])

  function toggleInsight(point: string) {
    setCheckedInsights(prev => {
      const next = new Set(prev)
      if (next.has(point)) next.delete(point)
      else next.add(point)
      return next
    })
  }

  async function generate() {
    setGenerating(true)
    setGenError(null)
    setDraft(null)
    try {
      const payload: DraftEmailRequest = {
        accountName:       accountName.trim(),
        contactName:       contactName.trim(),
        contactEmail:      contactEmail.trim() || undefined,
        sdrName,
        meetingDate:       meetingDate || undefined,
        meetingTime:       meetingTime || undefined,
        meetingType,
        selectedInsights:  Array.from(checkedInsights),
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
    } catch (err) {
      setGenError(String(err))
    } finally {
      setGenerating(false)
    }
  }

  async function copyAll() {
    if (!draft) return
    await navigator.clipboard.writeText(`Subject: ${draft.subject}\n\n${draft.body}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const contactNames = contactsList.map(c => c.name)
  const hasRequiredFields = accountName.trim() && contactName.trim() && sdrName
  const totalInsights = insights.reduce((n, c) => n + c.points.length, 0)

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="rounded-2xl w-full max-w-2xl flex flex-col max-h-[92vh]"
        style={{
          background: 'rgba(8,8,16,0.94)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
      >

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div>
            <h2 className="text-sm font-semibold text-white">Draft Pre-Meeting Email</h2>
            <p className="text-[11px] text-[#999] mt-0.5">Select account + contact → auto-analysis → generate personalised email</p>
          </div>
          <button onClick={onClose} className="text-[#999] hover:text-white transition-colors text-lg leading-none">✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* ── Account + Contact ── */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLS}>
                Account *
                {loadingAccts && <span className="ml-2 text-[#555] normal-case font-normal">loading…</span>}
              </label>
              <SearchableSelect
                options={accountsList}
                value={accountName}
                onChange={v => { setAccountName(v); setContactName(''); setInsights([]); setDraft(null) }}
                placeholder="e.g. Stryker"
              />
            </div>

            <div>
              <label className={LABEL_CLS}>
                Contact *
                {loadingConts && <span className="ml-2 text-[#555] normal-case font-normal">loading…</span>}
              </label>
              <SearchableSelect
                options={contactNames}
                value={contactName}
                onChange={v => { setContactName(v); setInsights([]); setDraft(null) }}
                placeholder={accountName ? 'Select contact…' : 'Select account first'}
                disabled={!accountName.trim()}
              />
            </div>

            <div>
              <label className={LABEL_CLS}>Contact Email</label>
              <input
                type="email"
                value={contactEmail}
                onChange={e => setContactEmail(e.target.value)}
                placeholder="auto-filled or enter manually"
                className={INPUT_CLS}
              />
            </div>

            <div>
              <label className={LABEL_CLS}>From (SDR) *</label>
              <select
                value={sdrName}
                onChange={e => setSdrName(e.target.value)}
                className={INPUT_CLS}
              >
                {SDR_OPTIONS.map(s => <option key={s} value={s} style={{ background: '#1A1A1A' }}>{s}</option>)}
              </select>
            </div>

            <div>
              <label className={LABEL_CLS}>Meeting Date</label>
              <input type="date" value={meetingDate} onChange={e => setMeetingDate(e.target.value)} className={INPUT_CLS} />
            </div>

            <div>
              <label className={LABEL_CLS}>Time &amp; Type</label>
              <div className="flex gap-2">
                <input type="time" value={meetingTime} onChange={e => setMeetingTime(e.target.value)} className={INPUT_CLS + ' flex-1'} />
                <select value={meetingType} onChange={e => setMeetingType(e.target.value as 'L1' | 'L2+')} className={INPUT_CLS + ' w-20'}>
                  <option value="L1" style={{ background: '#1A1A1A' }}>L1</option>
                  <option value="L2+" style={{ background: '#1A1A1A' }}>L2+</option>
                </select>
              </div>
            </div>
          </div>

          {/* ── Additional context ── */}
          <div>
            <label className={LABEL_CLS}>Additional Context</label>
            <textarea
              value={addlContext}
              onChange={e => setAddlContext(e.target.value)}
              rows={2}
              placeholder="e.g. Budget approved in Dec, focus on ROI — added to analysis"
              className={INPUT_CLS + ' resize-none'}
            />
          </div>

          {/* ── Analyse button ── */}
          {accountName && contactName && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={runAnalysis}
                disabled={analyzing}
                className="flex items-center gap-2 px-4 py-2 text-xs font-medium border border-[#E8341C] text-[#E8341C]
                  rounded-lg hover:bg-[#E8341C]/10 disabled:opacity-50 transition-colors"
              >
                {analyzing && <span className="w-3 h-3 border-2 border-[#E8341C] border-t-transparent rounded-full animate-spin" />}
                {analyzing ? 'Analysing…' : insights.length > 0 ? '↻ Re-analyse' : '✦ Analyse Account + Contact'}
              </button>
              {accountFound !== null && (
                <div className="flex gap-2 text-[10px]">
                  <span className={accountFound ? 'text-green-400' : 'text-yellow-400'}>
                    {accountFound ? '✓ Account intel found' : '⚠ No account intel'}
                  </span>
                  <span className="text-[#444]">·</span>
                  <span className={contactFound ? 'text-green-400' : 'text-yellow-400'}>
                    {contactFound ? '✓ Contact intel found' : '⚠ No contact intel'}
                  </span>
                </div>
              )}
            </div>
          )}

          {analyzeError && <p className="text-red-400 text-xs">{analyzeError}</p>}

          {/* ── Insight checkboxes ── */}
          {insights.length > 0 && (
            <div className="rounded-xl overflow-hidden"
              style={{ border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(255,255,255,0.02)' }}
            >
              <div className="flex items-center justify-between px-4 py-2.5"
                style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
              >
                <p className="text-xs font-semibold text-white">
                  Meeting Intelligence
                  <span className="ml-2 text-[#555] font-normal">{Array.from(checkedInsights).length}/{totalInsights} selected</span>
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const all = new Set<string>()
                      insights.forEach(c => c.points.forEach(p => all.add(p)))
                      setCheckedInsights(all)
                    }}
                    className="text-[10px] text-[#999] hover:text-white transition-colors"
                  >
                    Select all
                  </button>
                  <span className="text-[#444]">·</span>
                  <button
                    type="button"
                    onClick={() => setCheckedInsights(new Set())}
                    className="text-[10px] text-[#999] hover:text-white transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="p-4 space-y-4">
                {insights.map(({ category, points }) => (
                  <div key={category}>
                    <p className="text-[10px] font-semibold text-[#E8341C] uppercase tracking-widest mb-2">{category}</p>
                    <div className="space-y-1.5">
                      {points.map(point => (
                        <label key={point} className="flex items-start gap-2.5 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={checkedInsights.has(point)}
                            onChange={() => toggleInsight(point)}
                            className="mt-0.5 shrink-0 accent-[#E8341C]"
                          />
                          <span className={`text-xs leading-relaxed transition-colors ${checkedInsights.has(point) ? 'text-white' : 'text-[#666]'}`}>
                            {point}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Generated email ── */}
          {draft && (
            <div className="rounded-xl overflow-hidden"
              style={{ border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(255,255,255,0.02)' }}
            >
              <div className="flex items-center justify-between px-4 py-2.5"
                style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
              >
                <p className="text-xs font-semibold text-white">Generated Email</p>
                <button
                  onClick={copyAll}
                  className="text-[11px] px-3 py-1 rounded-lg text-[#999] hover:text-white transition-colors"
                  style={{ border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  {copied ? '✓ Copied!' : 'Copy All'}
                </button>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <p className="text-[10px] font-semibold text-[#E8341C] uppercase tracking-widest mb-1">Subject</p>
                  <p className="text-sm text-white font-medium">{draft.subject}</p>
                </div>
                <div className="pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                  <p className="text-[10px] font-semibold text-[#E8341C] uppercase tracking-widest mb-1">Body</p>
                  <p className="text-sm text-[#bbb] leading-relaxed whitespace-pre-wrap">{draft.body}</p>
                </div>
              </div>
            </div>
          )}

          {genError && <p className="text-red-400 text-xs">{genError}</p>}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex items-center gap-3 justify-end shrink-0"
          style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
        >
          {draft && (
            <button
              onClick={() => setDraft(null)}
              className="px-4 py-2 text-sm text-[#999] rounded-lg hover:text-white transition-colors"
              style={{ border: '1px solid rgba(255,255,255,0.1)' }}
            >
              ← Edit
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-[#999] rounded-lg hover:text-white transition-colors"
            style={{ border: '1px solid rgba(255,255,255,0.1)' }}
          >
            Close
          </button>
          <button
            onClick={generate}
            disabled={!hasRequiredFields || generating}
            className="btn-shimmer px-5 py-2 text-sm font-medium text-white rounded-lg
              disabled:opacity-50 transition-all flex items-center gap-2"
            style={{
              background: 'linear-gradient(135deg, #E8341C, #FF5A3A)',
              boxShadow: hasRequiredFields && !generating ? '0 2px 14px rgba(232,52,28,0.4)' : undefined,
            }}
          >
            {generating && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {generating ? 'Generating…' : draft ? 'Regenerate' : 'Generate Email'}
          </button>
        </div>
      </div>
    </div>
  )
}
