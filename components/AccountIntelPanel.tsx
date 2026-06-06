'use client'

import { useState, useTransition } from 'react'
import type { AccountIntelligence } from '@/lib/sheets'
import { addManualNote, changeAccountStatus, updateLastContact } from '@/app/actions/intel'
import { lastContactRange, RANGE_COLOR } from '@/lib/intel-utils'

type Status = AccountIntelligence['status']

const STATUS_OPTIONS: Status[] = ['Active', 'Won', 'Warm', 'Cold', 'Dead']
const STATUS_ORDER: Record<string, number> = { Active: 0, Won: 1, Warm: 2, Cold: 3, Dead: 4 }

const STATUS_STYLE: Record<string, string> = {
  Won:    'bg-green-500/15 text-green-400',
  Active: 'bg-mh-vermillion/15 text-mh-vermillion',
  Warm:   'bg-mh-gold/15 text-mh-gold',
  Cold:   'bg-mh-surface border border-mh-border text-mh-muted',
  Dead:   'bg-mh-surface border border-mh-border text-mh-muted',
}

const STATUS_EMOJI: Record<string, string> = {
  Won: '✅', Active: '🔥', Warm: '🟡', Cold: '🔵', Dead: '⚫',
}

function IntelCard({ title, content, placeholder }: { title: string; content: string; placeholder: string }) {
  return (
    <div className="p-3 rounded-lg bg-mh-surface2 border border-mh-border flex flex-col gap-2">
      <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest">{title}</p>
      {content ? (
        <p className="text-xs text-mh-muted leading-relaxed whitespace-pre-line">{content}</p>
      ) : (
        <p className="text-xs text-mh-muted italic">{placeholder}</p>
      )}
    </div>
  )
}

export function AccountIntelPanel({ intel: initialIntel }: { intel: AccountIntelligence[] }) {
  const sorted = [...initialIntel].sort(
    (a, b) => (STATUS_ORDER[a.status] ?? 5) - (STATUS_ORDER[b.status] ?? 5)
  )

  const [intel, setIntel] = useState<AccountIntelligence[]>(sorted)
  const [selectedAccount, setSelectedAccount] = useState<string>(sorted[0]?.account ?? '')
  const [noteInput, setNoteInput] = useState('')
  const [noteState, setNoteState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [editingDate, setEditingDate] = useState(false)
  const [dateSaving, setDateSaving] = useState(false)
  const [, startTransition] = useTransition()

  const account = intel.find(i => i.account === selectedAccount)

  async function handleSaveNote() {
    if (!noteInput.trim() || !selectedAccount || noteState === 'saving') return
    setNoteState('saving')
    try {
      const { updatedNotes, cumulativeSummary, nextAction, lastContactDate } = await addManualNote(
        selectedAccount,
        noteInput.trim()
      )
      setIntel(prev =>
        prev.map(i =>
          i.account === selectedAccount
            ? { ...i, manualNotes: updatedNotes, cumulativeSummary, nextAction, lastContactDate }
            : i
        )
      )
      setNoteInput('')
      setNoteState('saved')
      setTimeout(() => setNoteState('idle'), 2000)
    } catch {
      setNoteState('error')
      setTimeout(() => setNoteState('idle'), 3000)
    }
  }

  function handleStatusChange(newStatus: Status) {
    const prev = account?.status
    setIntel(p => p.map(i => i.account === selectedAccount ? { ...i, status: newStatus } : i))
    startTransition(async () => {
      try {
        await changeAccountStatus(selectedAccount, newStatus)
      } catch {
        if (prev) {
          setIntel(p => p.map(i => i.account === selectedAccount ? { ...i, status: prev } : i))
        }
      }
    })
  }

  async function handleDateUpdate(newDate: string) {
    if (!newDate || !selectedAccount) return
    setDateSaving(true)
    try {
      await updateLastContact(selectedAccount, newDate)
      setIntel(prev => prev.map(i =>
        i.account === selectedAccount ? { ...i, lastContactDate: newDate } : i
      ))
      setEditingDate(false)
    } catch { /* ignore */ }
    setDateSaving(false)
  }

  const range = account ? lastContactRange(account.lastContactDate) : '—'
  const rangeColor = RANGE_COLOR[range] ?? 'text-mh-muted'

  return (
    <div>
      {/* Selector row */}
      <div className="flex items-center gap-3 mb-4">
        <select
          value={selectedAccount}
          onChange={e => { setSelectedAccount(e.target.value); setEditingDate(false) }}
          className="flex-1 bg-mh-surface2 border border-mh-border rounded-lg px-3 py-2 text-sm text-mh-text focus:outline-none focus:border-mh-vermillion cursor-pointer"
        >
          {intel.map(i => (
            <option key={i.account} value={i.account} className="bg-mh-surface text-mh-text">
              {STATUS_EMOJI[i.status] ?? '⚪'} {i.account}
            </option>
          ))}
        </select>

        {account && (
          <select
            value={account.status}
            onChange={e => handleStatusChange(e.target.value as Status)}
            className={`shrink-0 text-[10px] font-semibold px-2.5 py-1.5 rounded uppercase tracking-wide border-0 bg-transparent focus:outline-none cursor-pointer ${STATUS_STYLE[account.status]}`}
          >
            {STATUS_OPTIONS.map(s => (
              <option key={s} value={s} className="bg-mh-surface text-mh-text normal-case text-xs">
                {s}
              </option>
            ))}
          </select>
        )}
      </div>

      {!account ? (
        <p className="text-mh-muted text-sm italic">Select an account above.</p>
      ) : (
        <>
          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-3 text-[10px] text-mh-muted">
            <span>
              {account.meetingCount} meeting{account.meetingCount !== 1 ? 's' : ''}
              {account.lastMeeting ? ` · last meeting ${account.lastMeeting.slice(0, 10)}` : ''}
              {account.updatedAt   ? ` · updated ${account.updatedAt.slice(0, 10)}` : ''}
            </span>

            {/* Last contact badge */}
            <span className="flex items-center gap-1">
              <span className="text-mh-muted">last contact</span>
              <span className={`font-medium ${rangeColor}`}>{range}</span>
              {account.lastContactDate && (
                <span className="text-mh-muted">({account.lastContactDate})</span>
              )}
              <button
                onClick={() => setEditingDate(e => !e)}
                title="Update last contact date"
                className="ml-1 text-mh-muted hover:text-mh-text transition-colors"
              >
                ✎
              </button>
            </span>
          </div>

          {/* Inline date picker */}
          {editingDate && (
            <div className="flex items-center gap-2 mb-3">
              <input
                type="date"
                defaultValue={account.lastContactDate || new Date().toISOString().slice(0, 10)}
                onChange={e => handleDateUpdate(e.target.value)}
                disabled={dateSaving}
                className="bg-mh-surface border border-mh-border rounded px-2 py-1 text-xs text-mh-text focus:outline-none focus:border-mh-vermillion disabled:opacity-50"
              />
              <button
                onClick={() => setEditingDate(false)}
                className="text-xs text-mh-muted hover:text-mh-text"
              >
                Cancel
              </button>
              {dateSaving && <span className="text-xs text-mh-muted">Saving…</span>}
            </div>
          )}

          {/* 4 intelligence panels */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <IntelCard
              title="Email Intelligence"
              content={account.emailIntelligence}
              placeholder="No email intel yet — run /sync-gmail in Claude Code to populate."
            />
            <IntelCard
              title="Circleback Intelligence"
              content={account.circlebakIntelligence}
              placeholder="No meeting notes synced yet."
            />
            <IntelCard
              title="Call Intelligence"
              content={account.callIntelligence}
              placeholder="No call logs found for this account."
            />

            {/* Manual Notes — editable */}
            <div className="p-3 rounded-lg bg-mh-surface2 border border-mh-border flex flex-col gap-2">
              <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest">Manual Notes</p>

              {account.manualNotes && (
                <pre className="text-xs text-mh-muted leading-relaxed whitespace-pre-wrap font-sans max-h-28 overflow-y-auto">
                  {account.manualNotes}
                </pre>
              )}

              <div className="flex gap-2 mt-auto">
                <input
                  type="text"
                  value={noteInput}
                  onChange={e => setNoteInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSaveNote()}
                  placeholder={account.manualNotes ? 'Append a note…' : 'Add a note…'}
                  className="flex-1 min-w-0 bg-mh-surface border border-mh-border rounded px-2 py-1 text-xs text-mh-text placeholder-mh-muted focus:outline-none focus:border-mh-vermillion"
                />
                <button
                  onClick={handleSaveNote}
                  disabled={noteState === 'saving' || !noteInput.trim()}
                  className={`shrink-0 text-xs px-2.5 py-1 rounded border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    noteState === 'saved'  ? 'border-green-500 text-green-400' :
                    noteState === 'error'  ? 'border-red-500 text-red-400' :
                    'border-mh-border text-mh-muted hover:border-mh-vermillion hover:text-mh-text'
                  }`}
                >
                  {noteState === 'saving' ? '…' : noteState === 'saved' ? '✓' : noteState === 'error' ? '✗' : 'Add'}
                </button>
              </div>
            </div>
          </div>

          {/* Cumulative Summary */}
          {account.cumulativeSummary ? (
            <div className="p-4 rounded-lg bg-mh-surface border border-mh-border">
              <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest mb-2">
                Cumulative Summary
              </p>
              <p className="text-sm text-mh-text leading-relaxed">{account.cumulativeSummary}</p>
              {account.nextAction && (
                <p className="text-xs text-mh-vermillion mt-2 font-medium">→ {account.nextAction}</p>
              )}
            </div>
          ) : (
            <div className="p-4 rounded-lg bg-mh-surface border border-mh-border">
              <p className="text-[10px] font-semibold text-mh-muted uppercase tracking-widest mb-2">
                Cumulative Summary
              </p>
              <p className="text-xs text-mh-muted italic">
                Run <span className="text-mh-text font-medium">/mh intel refresh {account.account}</span> in Discord to generate.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
