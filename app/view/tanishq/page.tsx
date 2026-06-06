import { getCalls, getMeetings, getTargets } from '@/lib/sheets'
import { getZohoCalls } from '@/lib/zoho'
import { buildTanishqMetrics, buildTodaysMeetings, buildFollowUps, mergeCallSources } from '@/lib/dashboard'
import PersonSelector from '@/components/PersonSelector'
import TanishqDashboard from '@/components/TanishqDashboard'

export const revalidate = 60

export default async function TanishqPage() {
  const [callsRes, meetingsRes, targetsRes, zohoCallsRes] = await Promise.allSettled([
    getCalls(),
    getMeetings(),
    getTargets(),
    getZohoCalls(),
  ])

  const calls     = callsRes.status     === 'fulfilled' ? callsRes.value     : []
  const meetings  = meetingsRes.status  === 'fulfilled' ? meetingsRes.value  : []
  const targets   = targetsRes.status   === 'fulfilled' ? targetsRes.value   : []
  const zohoCalls = zohoCallsRes.status === 'fulfilled' ? zohoCallsRes.value : []

  const allCalls = mergeCallSources(calls, zohoCalls)

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <PersonSelector />
      </div>
      <TanishqDashboard
        metrics={buildTanishqMetrics(allCalls, meetings, targets)}
        todaysMeetings={buildTodaysMeetings(meetings)}
        followUps={buildFollowUps(calls)}
      />
    </div>
  )
}
