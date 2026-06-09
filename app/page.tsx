import { getCalls, getMeetings, getTargets, getRecentSummaries } from '@/lib/sheets'
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
    getRecentSummaries(4),
  ])

  const calls      = callsRes.status      === 'fulfilled' ? callsRes.value      : []
  const meetings   = meetingsRes.status   === 'fulfilled' ? meetingsRes.value   : []
  const deals      = dealsRes.status      === 'fulfilled' ? dealsRes.value      : []
  const targets    = targetsRes.status    === 'fulfilled' ? targetsRes.value    : []
  const zohoCalls  = zohoCallsRes.status  === 'fulfilled' ? zohoCallsRes.value  : []
  const summaries  = summaryRes.status    === 'fulfilled' ? summaryRes.value    : []

  const allCalls = mergeCallSources(calls, zohoCalls)
  const weeklySummary  = summaries[0]?.summary ?? null
  const monthlySummary = summaries.length > 0
    ? summaries.map((s, i) => `**Week ${i + 1} (${s.weekOf || s.generatedAt.slice(0, 10)}):**\n${s.summary}`).join('\n\n---\n\n')
    : null

  return (
    <HomeTabs
      callsData={buildCallsData(allCalls, meetings, targets)}
      meetingsData={buildMeetingsData(meetings, targets)}
      leads={buildLeadCounts(deals)}
      funnel={buildFunnel(deals)}
      weeklyTrend={buildWeeklyTrend(allCalls, meetings)}
      weeklySummary={weeklySummary}
      monthlySummary={monthlySummary}
      rawCalls={allCalls}
    />
  )
}
