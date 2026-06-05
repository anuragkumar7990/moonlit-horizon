import { getAccounts, getMeetings, getNotes } from '@/lib/sheets'
import ClientCard from '@/components/ClientCard'
import { isThisWeek, parseISO } from 'date-fns'
import type { Account, Meeting } from '@/lib/types'

export const revalidate = 60

function getNextMeeting(accountName: string, meetings: Meeting[]): Meeting | undefined {
  const now = new Date()
  return meetings
    .filter(m => m.accountName === accountName && new Date(m.meetingTime) > now)
    .sort((a, b) => new Date(a.meetingTime).getTime() - new Date(b.meetingTime).getTime())[0]
}

export default async function HomePage() {
  const [accounts, meetings, notes] = await Promise.all([
    getAccounts(),
    getMeetings(),
    getNotes(),
  ])

  const meetingsThisWeek = meetings.filter(m => {
    try { return isThisWeek(parseISO(m.meetingTime)) } catch { return false }
  }).length

  const openDeals = accounts.filter(a =>
    !['Closed Won', 'Closed Lost'].includes(a.stage)
  ).length

  const pendingActionables = notes.filter(n => n.actionables && n.actionables.trim()).length

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Sales Pipeline</h1>
        <p className="text-slate-500 text-sm mt-1">Live view of all active engagements</p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Meetings This Week" value={meetingsThisWeek} color="blue" />
        <StatCard label="Open Deals" value={openDeals} color="emerald" />
        <StatCard label="Notes with Actionables" value={pendingActionables} color="amber" />
      </div>

      {/* Client cards */}
      {accounts.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <p className="text-lg">No accounts yet.</p>
          <p className="text-sm mt-1">Use <code className="bg-slate-100 px-1 rounded">/book meeting</code> on Discord to add your first client.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {accounts.map((account: Account) => (
            <ClientCard
              key={account.accountName}
              account={account}
              nextMeeting={getNextMeeting(account.accountName, meetings)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: 'blue' | 'emerald' | 'amber' }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
  }
  return (
    <div className={`rounded-xl border p-5 ${colors[color]}`}>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-sm font-medium mt-1 opacity-80">{label}</p>
    </div>
  )
}
