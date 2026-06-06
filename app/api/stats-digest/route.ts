import { NextResponse } from 'next/server'
import { format } from 'date-fns'
import { getCalls, getMeetings, getTargets } from '@/lib/sheets'
import { getDeals, getZohoCalls } from '@/lib/zoho'
import {
  buildTanishqMetrics,
  buildMeetingsData,
  buildLeadCounts,
  buildFunnel,
  buildTodaysMeetings,
  mergeCallSources,
} from '@/lib/dashboard'

export const dynamic = 'force-dynamic'

export async function GET() {
  const [callsRes, meetingsRes, dealsRes, targetsRes, zohoCallsRes] = await Promise.allSettled([
    getCalls(), getMeetings(), getDeals(), getTargets(), getZohoCalls(),
  ])

  const calls     = callsRes.status     === 'fulfilled' ? callsRes.value     : []
  const meetings  = meetingsRes.status  === 'fulfilled' ? meetingsRes.value  : []
  const deals     = dealsRes.status     === 'fulfilled' ? dealsRes.value     : []
  const targets   = targetsRes.status   === 'fulfilled' ? targetsRes.value   : []
  const zohoCalls = zohoCallsRes.status === 'fulfilled' ? zohoCallsRes.value : []

  const allCalls = mergeCallSources(calls, zohoCalls)

  return NextResponse.json({
    date:          format(new Date(), 'yyyy-MM-dd'),
    tanishq:       buildTanishqMetrics(allCalls, meetings, targets),
    meetingsData:  buildMeetingsData(meetings, targets),
    todayMeetings: buildTodaysMeetings(meetings).length,
    leads:         buildLeadCounts(deals),
    funnel:        buildFunnel(deals),
  })
}
