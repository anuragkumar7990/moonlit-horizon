import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { format, startOfWeek, endOfWeek, isWithinInterval, parseISO } from 'date-fns'
import { getMeetings, getCalls, getTasks, getTargets, getLatestSummary, saveSummary } from '@/lib/sheets'
import { getDeals, getZohoCalls, ZOHO_CONNECTED_OUTCOMES } from '@/lib/zoho'

export const dynamic = 'force-dynamic'

export async function GET() {
  const summary = await getLatestSummary()
  if (!summary) return NextResponse.json({ summary: null })
  return NextResponse.json(summary)
}

export async function POST() {
  const [meetingsRes, callsRes, zohoCallsRes, tasksRes, dealsRes, targetsRes] = await Promise.allSettled([
    getMeetings(), getCalls(), getZohoCalls(), getTasks(), getDeals(), getTargets(),
  ])

  const meetings  = meetingsRes.status  === 'fulfilled' ? meetingsRes.value  : []
  const calls     = callsRes.status     === 'fulfilled' ? callsRes.value     : []
  const zohoCalls = zohoCallsRes.status === 'fulfilled' ? zohoCallsRes.value : []
  const tasks     = tasksRes.status     === 'fulfilled' ? tasksRes.value     : []
  const deals     = dealsRes.status     === 'fulfilled' ? dealsRes.value     : []
  const targets   = targetsRes.status   === 'fulfilled' ? targetsRes.value   : []

  const now       = new Date()
  const weekStart = startOfWeek(now, { weekStartsOn: 1 })
  const weekEnd   = endOfWeek(now, { weekStartsOn: 1 })

  const inWeek = (dateStr: string) => {
    try { return isWithinInterval(parseISO(dateStr), { start: weekStart, end: weekEnd }) }
    catch { return false }
  }

  // Calls this week — merge Sheet calls + Zoho calls (deduplicate by date+account)
  const weekSheetCalls = calls.filter(c => inWeek(c.date))
  const weekZohoCalls  = zohoCalls.filter(c => inWeek(c.date))

  // Use Zoho as primary source; Sheet calls are supplementary (Discord-logged)
  // Dedup: track seen date+account combos to avoid double-counting if both logged
  const seenCallKeys = new Set<string>()
  const allWeekCalls: { outcome: string }[] = []

  for (const c of weekZohoCalls) {
    const key = `${c.date}:${c.accountName.toLowerCase()}`
    seenCallKeys.add(key)
    allWeekCalls.push({ outcome: c.outcome })
  }
  for (const c of weekSheetCalls) {
    const key = `${c.date}:${c.account.toLowerCase()}`
    if (!seenCallKeys.has(key)) allWeekCalls.push({ outcome: c.outcome ?? '' })
  }

  const dialled        = allWeekCalls.length
  const connected      = allWeekCalls.filter(c => ZOHO_CONNECTED_OUTCOMES.has(c.outcome)).length
  const meetingsBooked = allWeekCalls.filter(c => c.outcome === 'Meeting Scheduled' || c.outcome === 'meeting booked').length

  // Meetings this week
  const weekMeetings = meetings.filter(m => m.meetingTime && inWeek(m.meetingTime))
  const l1Conducted  = weekMeetings.filter(m => m.meetingType === 'L1').length
  const l2Conducted  = weekMeetings.filter(m => m.meetingType === 'L2+').length

  // Monthly targets
  const monthKey  = format(now, 'yyyy-MM')
  const getTarget = (name: string) =>
    targets.find(t => t.month === monthKey && t.metricName === name)?.targetValue ?? 0

  // Pipeline breakdown
  const activeDeals = deals.filter(d => !['won', 'lost'].includes(d.stage.toLowerCase().trim()))
  const hotDeals    = activeDeals.filter(d => ['negotiation', 'payment pending'].includes(d.stage.toLowerCase().trim()))
  const warmDeals   = activeDeals.filter(d => ['discovery call conducted', 'outline meeting conducted'].includes(d.stage.toLowerCase().trim()))
  const wonDeals    = deals.filter(d => d.stage.toLowerCase().trim() === 'won')

  // P0 tasks completed this week
  const weekTasksDone = tasks.filter(t => {
    if (t.status !== 'Done' || !t.completedAt) return false
    return inWeek(t.completedAt.slice(0, 10))
  })
  const weekTasksOpen = tasks.filter(t => inWeek(t.date) && t.status !== 'Done')

  // Call-to-connect rate
  const connectRate = dialled > 0 ? Math.round((connected / dialled) * 100) : 0

  const weekLabel = `${format(weekStart, 'dd MMM')}–${format(weekEnd, 'dd MMM yyyy')}`

  const context = `
WEEK: ${weekLabel}

CALLING ACTIVITY:
- Calls dialled: ${dialled} (monthly target: ${getTarget('Calls Dialled')}, weekly pace needed: ~${Math.round(getTarget('Calls Dialled') / 4)})
- Calls connected: ${connected} (${connectRate}% connect rate)
- Meetings booked from calls: ${meetingsBooked}

MEETINGS:
- L1 discovery calls conducted: ${l1Conducted} (monthly target: ${getTarget('L1 Meetings Conducted')})
- L2+ meetings conducted: ${l2Conducted} (monthly target: ${getTarget('L2 Meetings Conducted')})

PIPELINE:
- Hot deals (Negotiation / Payment Pending): ${hotDeals.length}
${hotDeals.map(d => `  • ${d.dealName || d.accountName} — ${d.stage}`).join('\n') || '  (none)'}
- Warm deals (DC Conducted / Outline Conducted): ${warmDeals.length}
- Total Won deals (all time): ${wonDeals.length}

P0 TASKS THIS WEEK:
- Completed: ${weekTasksDone.length}
- Still open: ${weekTasksOpen.length}
`.trim()

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    messages: [{
      role: 'user',
      content: `You are a sharp sales ops analyst for The Test Tribe, a B2B corporate training company. Generate a weekly performance summary in exactly 5 bullet points based on the data below.

Rules:
- Be specific with numbers — don't round or generalise
- Each bullet must be one sentence
- Cover: (1) calling performance, (2) meetings, (3) pipeline health, (4) one concern or gap, (5) top priority for next week
- Tone: direct, no fluff, no filler phrases like "It's great to see..."

${context}

Output format (exactly):
• [bullet 1]
• [bullet 2]
• [bullet 3]
• [bullet 4]
• [bullet 5]`,
    }],
  })

  const summary = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
  const weekOf  = format(weekStart, 'yyyy-MM-dd')

  await saveSummary(weekOf, summary)

  return NextResponse.json({
    weekOf: weekLabel,
    summary,
    stats: { dialled, connected, connectRate, meetingsBooked, l1Conducted, l2Conducted, hotDeals: hotDeals.length, warmDeals: warmDeals.length },
  })
}
