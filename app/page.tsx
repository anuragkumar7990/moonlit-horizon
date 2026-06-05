import { getCalls, getMeetings, getTargets } from '@/lib/sheets'
import { getDeals } from '@/lib/zoho'
import { buildCallsData, buildMeetingsData, buildFunnel, buildLeadCounts, buildWeeklyTrend } from '@/lib/dashboard'
import MasterTrackerGrid from '@/components/MasterTrackerGrid'

export const revalidate = 60

export default async function HomePage() {
  const [callsRes, meetingsRes, dealsRes, targetsRes] = await Promise.allSettled([
    getCalls(),
    getMeetings(),
    getDeals(),
    getTargets(),
  ])

  const calls    = callsRes.status    === 'fulfilled' ? callsRes.value    : []
  const meetings = meetingsRes.status === 'fulfilled' ? meetingsRes.value : []
  const deals    = dealsRes.status    === 'fulfilled' ? dealsRes.value    : []
  const targets  = targetsRes.status  === 'fulfilled' ? targetsRes.value  : []

  return (
    <MasterTrackerGrid
      callsData={buildCallsData(calls, meetings, targets)}
      meetingsData={buildMeetingsData(meetings, targets)}
      leads={buildLeadCounts(deals)}
      funnel={buildFunnel(deals)}
      weeklyTrend={buildWeeklyTrend(calls, meetings)}
    />
  )
}
