import { getCalls, getMeetings, getTargets } from '@/lib/sheets'
import { buildTanishqMetrics, buildTodaysMeetings, buildFollowUps } from '@/lib/dashboard'
import PersonSelector from '@/components/PersonSelector'
import TanishqDashboard from '@/components/TanishqDashboard'

export const revalidate = 60

export default async function TanishqPage() {
  const [callsRes, meetingsRes, targetsRes] = await Promise.allSettled([
    getCalls(),
    getMeetings(),
    getTargets(),
  ])

  const calls    = callsRes.status    === 'fulfilled' ? callsRes.value    : []
  const meetings = meetingsRes.status === 'fulfilled' ? meetingsRes.value : []
  const targets  = targetsRes.status  === 'fulfilled' ? targetsRes.value  : []

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <PersonSelector />
      </div>
      <TanishqDashboard
        metrics={buildTanishqMetrics(calls, meetings, targets)}
        todaysMeetings={buildTodaysMeetings(meetings)}
        followUps={buildFollowUps(calls)}
      />
    </div>
  )
}
