import { NextResponse } from 'next/server'
import { format } from 'date-fns'
import { getCalls, getMeetings, getTargets } from '@/lib/sheets'
import { getDeals } from '@/lib/zoho'
import {
  buildTanishqMetrics,
  buildMeetingsData,
  buildLeadCounts,
  buildFunnel,
  buildTodaysMeetings,
} from '@/lib/dashboard'

export const dynamic = 'force-dynamic'

export async function GET() {
  const [callsRes, meetingsRes, dealsRes, targetsRes] = await Promise.allSettled([
    getCalls(), getMeetings(), getDeals(), getTargets(),
  ])

  const calls    = callsRes.status    === 'fulfilled' ? callsRes.value    : []
  const meetings = meetingsRes.status === 'fulfilled' ? meetingsRes.value : []
  const deals    = dealsRes.status    === 'fulfilled' ? dealsRes.value    : []
  const targets  = targetsRes.status  === 'fulfilled' ? targetsRes.value  : []

  return NextResponse.json({
    date:          format(new Date(), 'yyyy-MM-dd'),
    tanishq:       buildTanishqMetrics(calls, meetings, targets),
    meetingsData:  buildMeetingsData(meetings, targets),
    todayMeetings: buildTodaysMeetings(meetings).length,
    leads:         buildLeadCounts(deals),
    funnel:        buildFunnel(deals),
  })
}
