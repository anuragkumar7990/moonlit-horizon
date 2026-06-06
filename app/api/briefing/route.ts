import { NextResponse } from 'next/server'
import { format, parseISO, isToday } from 'date-fns'
import { getCalls, getMeetings, getTargets, getTasks } from '@/lib/sheets'
import { getDeals, getZohoCalls } from '@/lib/zoho'
import {
  buildLeadCounts,
  buildFunnel,
  mergeCallSources,
} from '@/lib/dashboard'

export const dynamic = 'force-dynamic'

const HOT_STAGES = new Set([
  'negotiation',
  'payment pending',
  'outline meeting conducted',
  'discovery call conducted',
])

export async function GET() {
  const [callsRes, meetingsRes, dealsRes, targetsRes, zohoCallsRes, tasksRes] = await Promise.allSettled([
    getCalls(), getMeetings(), getDeals(), getTargets(), getZohoCalls(), getTasks(),
  ])

  const calls     = callsRes.status     === 'fulfilled' ? callsRes.value     : []
  const meetings  = meetingsRes.status  === 'fulfilled' ? meetingsRes.value  : []
  const deals     = dealsRes.status     === 'fulfilled' ? dealsRes.value     : []
  const targets   = targetsRes.status   === 'fulfilled' ? targetsRes.value   : []
  const zohoCalls = zohoCallsRes.status === 'fulfilled' ? zohoCallsRes.value : []
  const allTasks  = tasksRes.status     === 'fulfilled' ? tasksRes.value     : []

  const allCalls = mergeCallSources(calls, zohoCalls)

  // Today's meetings (full objects)
  const todayMeetings = meetings.filter(m => {
    try { return isToday(parseISO(m.meetingTime)) } catch { return false }
  }).sort((a, b) => a.meetingTime.localeCompare(b.meetingTime))

  // Today's calls summary
  const today = format(new Date(), 'yyyy-MM-dd')
  const todayCalls = allCalls.filter(c => c.date === today)
  const dialled   = todayCalls.length
  const connected = todayCalls.filter(c => {
    const o = c.outcome.toLowerCase().trim()
    return o !== '' && !['no answer','voicemail','busy','wrong number','call dropped','disconnected','invalid number','no response','unanswered'].includes(o)
  }).length
  const booked = todayCalls.filter(c => c.outcome.toLowerCase() === 'meeting booked').length

  // Daily targets (monthly ÷ 22)
  const currentMonth = format(new Date(), 'yyyy-MM')
  const tgt = (name: string) => {
    const t = targets.find(t => t.month === currentMonth && t.metricName === name)
    return t ? Math.round(t.targetValue / 22) : null
  }

  // Hot pipeline (active stages)
  const hotDeals = deals
    .filter(d => HOT_STAGES.has((d.stage || '').toLowerCase()))
    .map(d => ({
      dealName:   d.dealName,
      accountName: d.accountName,
      stage:      d.stage,
      amount:     d.amount ? Number(d.amount) : 0,
    }))
    .sort((a, b) => b.amount - a.amount)

  // Open tasks
  const openTasks = allTasks
    .filter(t => t.status === 'Open')
    .map(t => ({ task: t.task, type: t.type, assignedTo: t.assignedTo, linkedDeal: t.linkedDeal }))

  return NextResponse.json({
    date: format(new Date(), 'yyyy-MM-dd'),
    todayMeetings: todayMeetings.map(m => ({
      accountName: m.accountName,
      contactName: m.contactName,
      meetingTime: m.meetingTime,
      meetingType: m.meetingType,
      gMeetLink:   m.gMeetLink,
    })),
    callsToday: {
      dialled,
      connected,
      booked,
      targets: { dialled: tgt('Calls Dialled'), connected: tgt('Calls Connected'), booked: tgt('Meetings Booked') },
    },
    hotDeals,
    openTasks,
    leads: buildLeadCounts(deals),
    funnel: buildFunnel(deals),
  })
}
