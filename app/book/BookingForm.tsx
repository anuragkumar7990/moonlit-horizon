'use client'

import { useState } from 'react'
import type { ZohoAccount, ZohoContact } from '@/lib/types'

interface Props {
  accounts: ZohoAccount[]
  contacts: ZohoContact[]
  defaultAccount?: string
}

export default function BookingForm({ accounts, contacts, defaultAccount }: Props) {
  const [accountId, setAccountId] = useState(
    defaultAccount ? (accounts.find(a => a.accountName === defaultAccount)?.id ?? '') : ''
  )
  const [contactId, setContactId] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [meetingTime, setMeetingTime] = useState('')
  const [meetingType, setMeetingType] = useState<'L1' | 'L2+'>('L1')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const selectedAccountName = accounts.find(a => a.id === accountId)?.accountName ?? ''
  const linkedContacts = contacts.filter(c => c.accountName === selectedAccountName)
  const filteredContacts = linkedContacts.length > 0 ? linkedContacts : contacts

  function handleContactChange(id: string) {
    setContactId(id)
    const contact = contacts.find(c => c.id === id)
    setContactEmail(contact?.email ?? '')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!accountId || !contactId || !meetingTime) return
    setStatus('loading')
    setErrorMsg('')

    const account = accounts.find(a => a.id === accountId)
    const contact = contacts.find(c => c.id === contactId)

    try {
      const res = await fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          accountName: account?.accountName,
          contactId,
          contactName: contact ? `${contact.firstName} ${contact.lastName}`.trim() : '',
          contactEmail,
          meetingTime,
          meetingType,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      setStatus('success')
    } catch (err) {
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  if (status === 'success') {
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-4">🎉</div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Meeting Booked!</h2>
        <p className="text-slate-500 mb-6">Calendar invites have been sent and the deal has been created in Zoho CRM.</p>
        <button onClick={() => setStatus('idle')} className="text-sm text-blue-600 hover:underline">
          Book another meeting
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Account */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Account Name *</label>
        <select
          value={accountId}
          onChange={e => { setAccountId(e.target.value); setContactId(''); setContactEmail('') }}
          required
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        >
          <option value="">Select account…</option>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.accountName}</option>)}
        </select>
      </div>

      {/* Contact */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Contact Name *</label>
        <select
          value={contactId}
          onChange={e => handleContactChange(e.target.value)}
          required
          disabled={!accountId}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-slate-50 disabled:text-slate-400"
        >
          <option value="">Select contact…</option>
          {filteredContacts.map(c => (
            <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
          ))}
        </select>
      </div>

      {/* Email (auto-filled) */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Contact Email</label>
        <input
          type="email"
          value={contactEmail}
          onChange={e => setContactEmail(e.target.value)}
          placeholder="Auto-filled from contact selection"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
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
        <p className="text-xs text-slate-400 mt-2">
          {meetingType === 'L1'
            ? 'Title: <Account> ↔ The Test Tribe | Upskilling for Teams'
            : 'Title: <Account> ↔ The Test Tribe | Training - Next Steps'}
        </p>
      </div>

      {status === 'error' && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{errorMsg || 'Something went wrong. Please try again.'}</p>
      )}

      <button
        type="submit"
        disabled={status === 'loading'}
        className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {status === 'loading' ? 'Booking meeting…' : 'Book Meeting & Send Invites'}
      </button>
    </form>
  )
}
