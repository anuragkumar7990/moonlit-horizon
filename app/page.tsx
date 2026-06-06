import { getCalls, getMeetings, getTargets, getLatestSummary } from '@/lib/sheets'
import { getDeals, getZohoCalls } from '@/lib/zoho'
import { buildCallsData, buildMeetingsData, buildFunnel, buildLeadCounts, buildWeeklyTrend, mergeCallSources } from '@/lib/dashboard'
import HomeTabs from '@/components/HomeTabs'

export const revalidate = 60

export default async function HomePage() {
  const [callsRes, meetingsRes, dealsRes, targetsRes, zohoCallsRes, summaryRes] = await Promise.allSettled([
    getCalls(),
    getMeetings(),
    getDeals(),
    getTargets(),
    getZohoCalls(),
    getLatestSummary(),
  ])

  const calls      = callsRes.status      === 'fulfilled' ? callsRes.value      : []
  const meetings   = meetingsRes.status   === 'fulfilled' ? meetingsRes.value   : []
  const deals      = dealsRes.status      === 'fulfilled' ? dealsRes.value      : []
  const targets    = targetsRes.status    === 'fulfilled' ? targetsRes.value    : []
  const zohoCalls  = zohoCallsRes.status  === 'fulfilled' ? zohoCallsRes.value  : []
  const summary    = summaryRes.status    === 'fulfilled' ? summaryRes.value    : null

  const allCalls = mergeCallSources(calls, zohoCalls)

  return (
    <HomeTabs
      callsData={buildCallsData(allCalls, meetings, targets)}
      meetingsData={buildMeetingsData(meetings, targets)}
      leads={buildLeadCounts(deals)}
      funnel={buildFunnel(deals)}
      weeklyTrend={buildWeeklyTrend(allCalls, meetings)}
      weeklySummary={summary?.summary ?? null}
      rawCalls={allCalls}
    />
  )
}
