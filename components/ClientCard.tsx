import Link from 'next/link'
import type { Account, Meeting } from '@/lib/types'
import { format, parseISO } from 'date-fns'

const STAGE_COLORS: Record<string, string> = {
  'Meeting Booked': 'bg-blue-100 text-blue-700',
  'Proposal Sent': 'bg-purple-100 text-purple-700',
  'Negotiation': 'bg-amber-100 text-amber-700',
  'Closed Won': 'bg-emerald-100 text-emerald-700',
  'Closed Lost': 'bg-red-100 text-red-700',
  'Nurturing': 'bg-slate-100 text-slate-600',
}

function formatDate(dateStr: string) {
  try { return format(parseISO(dateStr), 'dd MMM, h:mm a') }
  catch { return dateStr }
}

export default function ClientCard({
  account,
  nextMeeting,
}: {
  account: Account
  nextMeeting?: Meeting
}) {
  const stageColor = STAGE_COLORS[account.stage] ?? 'bg-slate-100 text-slate-600'
  const slug = encodeURIComponent(account.accountName)

  return (
    <Link href={`/client/${slug}`} className="block">
      <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md hover:border-blue-300 transition-all group">
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-semibold text-slate-800 group-hover:text-blue-700 transition-colors leading-tight">
            {account.accountName}
          </h3>
          <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ml-2 shrink-0 ${stageColor}`}>
            {account.stage || 'New'}
          </span>
        </div>

        <p className="text-sm text-slate-500 mb-4">{account.primaryContact}</p>

        <div className="space-y-1.5 text-xs">
          {nextMeeting ? (
            <div className="flex items-center gap-1.5 text-blue-600">
              <span>📅</span>
              <span className="font-medium">Next: {formatDate(nextMeeting.meetingTime)}</span>
              <span className="ml-auto bg-blue-50 px-1.5 py-0.5 rounded text-blue-500">{nextMeeting.meetingType}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-slate-400">
              <span>📅</span>
              <span>No upcoming meetings</span>
            </div>
          )}

          {account.lastActivity && (
            <div className="flex items-center gap-1.5 text-slate-400">
              <span>🕐</span>
              <span>Last active: {account.lastActivity}</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}
