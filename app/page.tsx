import { getCalls, getMeetings, getTargets } from '@/lib/sheets'
import { getDeals, getLeadsByStatus } from '@/lib/zoho'
import { buildCallsData, buildMeetingsData, buildFunnel, buildWeeklyTrend } from '@/lib/dashboard'
import MasterTrackerGrid from '@/components/MasterTrackerGrid'
import type { LeadCounts } from '@/lib/types'

export const revalidate = 60

export default async function HomePage() {
  const [callsRes, meetingsRes, dealsRes, leadsRes, targetsRes] = await Promise.allSettled([
    getCalls(),
    getMeetings(),
    getDeals(),
    getLeadsByStatus(),
    getTargets(),
  ])

  const calls    = callsRes.status    === 'fulfilled' ? callsRes.value    : []
  const meetings = meetingsRes.status === 'fulfilled' ? meetingsRes.value : []
  const deals    = dealsRes.status    === 'fulfilled' ? dealsRes.value    : []
  const targets  = targetsRes.status  === 'fulfilled' ? targetsRes.value  : []
  const leads: LeadCounts = leadsRes.status === 'fulfilled'
    ? leadsRes.value
    : { hot: 0, warm: 0, cold: 0, total: 0 }

  return (
    <MasterTrackerGrid
      callsData={buildCallsData(calls, meetings, targets)}
      meetingsData={buildMeetingsData(meetings, targets)}
      leads={leads}
      funnel={buildFunnel(deals)}
      weeklyTrend={buildWeeklyTrend(calls, meetings)}
    />
  )
}
