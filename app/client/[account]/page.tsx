import { getMeetings, getNotes, getCommunications, getAccounts } from '@/lib/sheets'
import { getDealByAccount } from '@/lib/zoho'
import MeetingTimeline from '@/components/MeetingTimeline'
import NotesPanel from '@/components/NotesPanel'
import CommsTimeline from '@/components/CommsTimeline'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const revalidate = 60

const STAGE_COLORS: Record<string, string> = {
  'Meeting Booked': 'bg-blue-100 text-blue-700',
  'Proposal Sent': 'bg-purple-100 text-purple-700',
  'Negotiation': 'bg-amber-100 text-amber-700',
  'Closed Won': 'bg-emerald-100 text-emerald-700',
  'Closed Lost': 'bg-red-100 text-red-700',
  'Nurturing': 'bg-slate-100 text-slate-600',
}

export default async function ClientPage({ params }: { params: { account: string } }) {
  const accountName = decodeURIComponent(params.account)

  const [accounts, meetings, notes, comms, deal] = await Promise.all([
    getAccounts(),
    getMeetings(),
    getNotes(),
    getCommunications(),
    getDealByAccount(accountName).catch(() => null),
  ])

  const account = accounts.find(a => a.accountName === accountName)
  if (!account) notFound()

  const accountMeetings = meetings.filter(m => m.accountName === accountName)
  const accountNotes = notes.filter(n => n.accountName === accountName)
  const accountComms = comms.filter(c => c.accountName === accountName)
  const stageColor = STAGE_COLORS[account.stage] ?? 'bg-slate-100 text-slate-600'

  return (
    <div>
      {/* Breadcrumb */}
      <Link href="/" className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1 mb-6">
        ← All clients
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{account.accountName}</h1>
          <p className="text-slate-500 mt-1">{account.primaryContact} · {account.contactEmail}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-sm font-medium px-3 py-1 rounded-full ${stageColor}`}>
            {account.stage || 'New'}
          </span>
          <Link href={`/book?account=${encodeURIComponent(accountName)}`}
            className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded-full hover:bg-blue-700 font-medium transition-colors">
            + Book Meeting
          </Link>
        </div>
      </div>

      {/* Zoho CRM Deal card */}
      {deal && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6 flex items-center gap-6">
          <div>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">CRM Deal</p>
            <p className="font-semibold text-slate-800 mt-0.5">{deal.dealName}</p>
          </div>
          <div className="h-10 w-px bg-slate-200" />
          <div>
            <p className="text-xs text-slate-400">Stage</p>
            <p className="font-medium text-slate-700">{deal.stage}</p>
          </div>
          <div className="h-10 w-px bg-slate-200" />
          <div>
            <p className="text-xs text-slate-400">Amount</p>
            <p className="font-medium text-slate-700">{deal.amount ? `₹${deal.amount}` : '—'}</p>
          </div>
          <div className="h-10 w-px bg-slate-200" />
          <div>
            <p className="text-xs text-slate-400">Closing</p>
            <p className="font-medium text-slate-700">{deal.closingDate || '—'}</p>
          </div>
        </div>
      )}

      {/* Three-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Section title="Meetings" count={accountMeetings.length}>
          <MeetingTimeline meetings={accountMeetings} />
        </Section>
        <Section title="Meeting Notes" count={accountNotes.length}>
          <NotesPanel notes={accountNotes} />
        </Section>
        <Section title="Communications" count={accountComms.length}>
          <CommsTimeline comms={accountComms} />
        </Section>
      </div>
    </div>
  )
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-slate-800">{title}</h2>
        <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">{count}</span>
      </div>
      {children}
    </div>
  )
}
